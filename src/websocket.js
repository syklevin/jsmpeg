var WSSource = function(url, options) {
	this.url = url;
	this.options = options;
	this.socket = null;	

	this.callbacks = {connect: [], data: []};
	this.destination = null;

	this.reconnectInterval = options.reconnectInterval !== undefined
		? options.reconnectInterval
		: 5;
	this.shouldAttemptReconnect = !!this.reconnectInterval;

	this.completed = false;
	this.established = false;
	this.progress = 0;

	this.reconnectTimeoutId = 0;
};

WSSource.prototype.connect = function(destination) {
	this.destination = destination;
};

WSSource.prototype.destroy = function() {
	clearTimeout(this.reconnectTimeoutId);
	this.shouldAttemptReconnect = false;
	this.socket.close();
};

WSSource.prototype.start = function() {
	var WebSocketCls = WebSocket || MozWebSocket;
	this.shouldAttemptReconnect = !!this.reconnectInterval;
	this.progress = 0;
	this.established = false;
	this.socket = this.options.protocols ? new WebSocketCls(this.url, this.options.protocols) : new WebSocketCls(this.url);
	this.socket.binaryType = 'arraybuffer';
	this.socket.onmessage = this.onMessage.bind(this);
	this.socket.onopen = this.onOpen.bind(this);
	this.socket.onerror = this.onClose.bind(this);
	this.socket.onclose = this.onClose.bind(this);
};

WSSource.prototype.resume = function(secondsHeadroom) {
	// Nothing to do here
};

WSSource.prototype.onOpen = function() {
	this.progress = 1;
	this.established = true;
};

WSSource.prototype.onClose = function() {
	if (this.shouldAttemptReconnect) {
		clearTimeout(this.reconnectTimeoutId);
		this.reconnectTimeoutId = setTimeout(function(){
			this.start();	
		}.bind(this), this.reconnectInterval*1000);
	}
};

WSSource.prototype.onMessage = function(ev) {
	if (this.destination) {
		// var ba = new Uint8Array(ev.data)
		this.destination.write(ev.data);
	}
};

export default WSSource;

