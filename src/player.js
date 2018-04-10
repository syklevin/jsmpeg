import WebSocket from './websocket';
import Ajax from './ajax';
import TS from './ts';
import MPEG1Video from './mpeg1';
import WebGL from './webgl';
import Canvas2D from './canvas2d';
import MP2Audio from './mp2';
import WebAudio from './webaudio';
import {now} from './utils';

var Player = function(url, options) {
	this.options = options || {};
	this.init(url)
};

Player.prototype.init = function(url) {
	var options = this.options
	if (options.source) {
		this.source = new options.source(url, options);
		options.streaming = !!this.source.streaming;
	}
	else if (url.match(/^wss?:\/\//)) {
		this.source = new WebSocket(url, options);
		options.streaming = true;
	}
	else {
		this.source = new Ajax(url, options);
		options.streaming = false;
	}

	this.maxAudioLag = options.maxAudioLag || 0.25;
	this.loop = options.loop !== false;
	this.autoplay = !!options.autoplay || options.streaming;

	this.demuxer = new TS(options);
	this.source.connect(this.demuxer);

	if (options.video !== false) {
		this.video = new MPEG1Video(options);
		this.renderer = !options.disableGl && WebGL.IsSupported()
			? new WebGL(options)
			: new Canvas2D(options);
		this.demuxer.connect(TS.STREAM.VIDEO_1, this.video);
		this.video.connect(this.renderer);
	}

	if (options.audio !== false && WebAudio.IsSupported()) {
		this.audio = new MP2Audio(options);
		this.audioOut = new WebAudio(options);
		this.demuxer.connect(TS.STREAM.AUDIO_1, this.audio);
		this.audio.connect(this.audioOut);
	}

	Object.defineProperty(this, 'currentTime', {
		get: this.getCurrentTime,
		set: this.setCurrentTime
	});
	Object.defineProperty(this, 'volume', {
		get: this.getVolume,
		set: this.setVolume
	});

	this.unpauseOnShow = false;
	if (options.pauseWhenHidden !== false) {
		document.addEventListener('visibilitychange', this.showHide.bind(this));
	}

	this.source.start();

	if (this.autoplay) {
		this.play();
	}
}

Player.prototype.showHide = function(ev) {
	if (document.visibilityState === 'hidden') {
		this.unpauseOnShow = this.wantsToPlay;
		this.pause();
	}
	else if (this.unpauseOnShow) {
		this.play();
	}
};

Player.prototype.play = function(ev) {
	this.animationId = requestAnimationFrame(this.update.bind(this));
	this.wantsToPlay = true;
};

Player.prototype.pause = function(ev) {
	cancelAnimationFrame(this.animationId);
	this.wantsToPlay = false;
	this.isPlaying = false;

	if (this.audio && this.audio.canPlay) {
		// Seek to the currentTime again - audio may already be enqueued a bit
		// further, so we have to rewind it.
		this.audioOut.stop();
		this.seek(this.currentTime);
	}
};

Player.prototype.switch = function(url) {
	this.destroy()
	this.init(url)
}

Player.prototype.getVolume = function() {
	return this.audioOut ? this.audioOut.volume : 0;
};

Player.prototype.setVolume = function(volume) {
	if (this.audioOut) {
		this.audioOut.volume = volume;
	}
};

Player.prototype.stop = function(ev) {
	this.pause();
	this.seek(0);
	if (this.video && this.options.decodeFirstFrame !== false) {
		this.video.decode();
	}
};

Player.prototype.destroy = function() {
	this.pause();
	this.source.destroy();
	if (this.renderer) {
		this.renderer.destroy();
	}
	if (this.audioOut) {
		this.audioOut.destroy();
	}
};

Player.prototype.seek = function(time) {
	var startOffset = this.audio && this.audio.canPlay
		? this.audio.startTime
		: this.video.startTime;

	if (this.video) {
		this.video.seek(time + startOffset);
	}
	if (this.audio) {
		this.audio.seek(time + startOffset);
	}

	this.startTime = now() - time;
};

Player.prototype.getCurrentTime = function() {
	return this.audio && this.audio.canPlay
		? this.audio.currentTime - this.audio.startTime
		: this.video.currentTime - this.video.startTime;
};

Player.prototype.setCurrentTime = function(time) {
	this.seek(time);
};

Player.prototype.update = function() {
	this.animationId = requestAnimationFrame(this.update.bind(this));

	if (!this.source.established) {
		if (this.renderer) {
			this.renderer.renderProgress(this.source.progress);
		}
		return;
	}

	if (!this.isPlaying) {
		this.isPlaying = true;
		this.startTime = now() - this.currentTime;
	}

	if (this.options.streaming) {
		this.updateForStreaming();
	}
	else {
		this.updateForStaticFile();
	}
};

Player.prototype.updateForStreaming = function() {
	// When streaming, immediately decode everything we have buffered up until
	// now to minimize playback latency.

	if (this.video) {
		this.video.decode();
	}

	if (this.audio) {
		var decoded = false;
		do {
			// If there's a lot of audio enqueued already, disable output and
			// catch up with the encoding.
			if (this.audioOut.enqueuedTime > this.maxAudioLag) {
				this.audioOut.resetEnqueuedTime();
				this.audioOut.enabled = false;
			}
			decoded = this.audio.decode();		
		} while (decoded);
		this.audioOut.enabled = true;
	}
};

Player.prototype.updateForStaticFile = function() {
	var notEnoughData = false,
		headroom = 0;

	// If we have an audio track, we always try to sync the video to the audio.
	// Gaps and discontinuities are far more percetable in audio than in video.

	if (this.audio && this.audio.canPlay) {
		// Do we have to decode and enqueue some more audio data?
		while (
			!notEnoughData && 
			this.audio.decodedTime - this.audio.currentTime < 0.25
		) {
			notEnoughData = !this.audio.decode();
		}

		// Sync video to audio
		if (this.video && this.video.currentTime < this.audio.currentTime) {
			notEnoughData = !this.video.decode();
		}

		headroom = this.demuxer.currentTime - this.audio.currentTime;
	}


	else if (this.video) {
		// Video only - sync it to player's wallclock
		var targetTime = (now() - this.startTime) + this.video.startTime,
			lateTime = targetTime - this.video.currentTime,
			frameTime = 1/this.video.frameRate;

		if (this.video && lateTime > 0) {
			// If the video is too far behind (>2 frames), simply reset the
			// target time to the next frame instead of trying to catch up.
			if (lateTime > frameTime * 2) {
				this.startTime += lateTime;
			}

			notEnoughData = !this.video.decode();
		}

		headroom = this.demuxer.currentTime - targetTime;
	}

	// Notify the source of the playhead headroom, so it can decide whether to
	// continue loading further data.
	this.source.resume(headroom);

	// If we failed to decode and the source is complete, it means we reached
	// the end of our data. We may want to loop.
	if (notEnoughData && this.source.completed) {
		if (this.loop) {
			this.seek(0);
		}
		else {
			this.pause();
		}
	}
};

export default Player;

