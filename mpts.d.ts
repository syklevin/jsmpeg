declare module "mpts" {

  export class Player {
      options: PlayerOptions;
      source: any;

      maxAudioLag: number;
      loop: boolean;
      autoplay: boolean;
      isPlaying: boolean;

      demuxer: any;

      constructor(url: string, options: PlayerOptions);

      showHide(): void;
      switch(url: string);
      play(): void;
      pause(): void;
      stop(): void;
      destroy(): void;
      update(): void;
      updateForStreaming(): void;
      updateForStaticFile(): void;

      seek(): void;

      getCurrentTime(): number;
      getVolume(): number;
      setVolume(level:number): void;
  }

  export interface PlayerOptions {
      canvas?: Element;
      protocols?: string;
      audio?: boolean;
      loop?: boolean;
      streaming?: boolean;
      poster?: string;
      pauseWhenHidden?: boolean;
      source?: boolean;
      progressive?: boolean;
      maxAudioLag?: number;
      autoplay?: boolean;
      video?: boolean;
      disableGl?: boolean;
  }
}