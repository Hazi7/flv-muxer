import {
  type AudioEncoderTrack,
  type VideoEncoderTrack,
} from "./encoder-track";
import { EventBus } from "./event-bus";

export interface MediaChunk {
  type: "AAC_RAW" | "AAC_SE" | "AVC_SE" | "AVC_NALU";
  data: Uint8Array;
  // PTS
  // [https://w3c.github.io/webcodecs/#dom-encodedvideochunk-timestamp-slot]
  timestamp: number;
  isKey: boolean;
}

export class MediaHub extends EventBus {
  static #instance: MediaHub;
  #tracks: [AudioEncoderTrack | undefined, VideoEncoderTrack | undefined] = [
    undefined,
    undefined,
  ];

  get audioEncoderTrack(): AudioEncoderTrack | undefined {
    return this.#tracks[0];
  }

  set audioEncoderTrack(track: AudioEncoderTrack) {
    this.#tracks[0] = track;
  }

  get videoEncoderTrack(): VideoEncoderTrack | undefined {
    return this.#tracks[1];
  }

  set videoEncoderTrack(track: VideoEncoderTrack) {
    this.#tracks[1] = track;
  }

  /**
   * 创建FlvStreamer的实例。
   * @param writable - 用于写入FLV数据的可写流。
   * @param options - FLV流的配置选项。
   */
  constructor() {
    super();
  }

  static getInstance(): MediaHub {
    if (!MediaHub.#instance) {
      MediaHub.#instance = new MediaHub();
    }

    return MediaHub.#instance;
  }

  pushAudioChunk(chunk: MediaChunk) {
    if (chunk.type === "AAC_SE") {
      this.emit("chunk", chunk);
    }
  }

  pushVideoChunk(chunk: MediaChunk) {
    if (chunk.type === "AAC_SE") {
      this.emit("chunk", chunk);
    }
  }

  processQueue() {}

  start(audio: boolean, video: boolean) {
    if (audio && this.audioEncoderTrack) {
      this.audioEncoderTrack.start();
    }
    if (video && this.videoEncoderTrack) {
      this.videoEncoderTrack.start();
    }
  }

  flush() {}
}
