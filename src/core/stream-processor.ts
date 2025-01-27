import {
  type AudioEncoderTrack,
  type VideoEncoderTrack,
} from "./encoder-track";
import { EventBus } from "./event-bus";

export interface TrackChunk {
  type: "AAC_RAW" | "AAC_SE" | "AVC_SE" | "AVC_NALU";
  data: Uint8Array;
  // PTS
  // [https://w3c.github.io/webcodecs/#dom-encodedvideochunk-timestamp-slot]
  timestamp: number;
  isKey: boolean;
}

export class StreamProcessor {
  static instance: StreamProcessor;
  #eventBus: EventBus;
  #audioEncoderTrack: AudioEncoderTrack | undefined;
  #videoEncoderTrack: VideoEncoderTrack | undefined;
  #isProcessing: boolean = false;
  #audioConfigReady: boolean = false;
  #videoConfigReady: boolean = false;

  /**
   * 创建FlvStreamer的实例。
   * @param writable - 用于写入FLV数据的可写流。
   * @param options - FLV流的配置选项。
   */
  private constructor() {
    this.#eventBus = EventBus.getInstance();
  }

  setAudioConfigReady() {
    this.#audioConfigReady = true;
  }

  setVideoConfigReady() {
    this.#videoConfigReady = true;
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new this();
    }

    return this.instance;
  }

  addAudioTrack(track: AudioEncoderTrack) {
    this.#audioEncoderTrack = track;
  }

  addVideoTrack(track: VideoEncoderTrack) {
    this.#videoEncoderTrack = track;
  }

  addChunk(chunk: TrackChunk) {
    if (!this.#audioEncoderTrack || !this.#videoEncoderTrack) {
      this.#eventBus.emit("chunk", chunk);
      return;
    }

    const audioQueue = this.#audioEncoderTrack?.queue;
    const videoQueue = this.#videoEncoderTrack?.queue;

    if (chunk.type === "AAC_RAW") {
      while (
        videoQueue.length > 0 &&
        videoQueue[0].timestamp <= chunk.timestamp
      ) {
        if (
          audioQueue.length > 0 &&
          audioQueue[0].timestamp < videoQueue[0].timestamp
        ) {
          const cacheChunk = audioQueue.shift();
          if (cacheChunk) {
            this.#eventBus.emit("chunk", chunk);
          }
        } else {
          const cacheChunk = videoQueue.shift();
          if (cacheChunk) {
            this.#eventBus.emit("chunk", chunk);
          }
        }
      }

      if (chunk.timestamp <= this.#videoEncoderTrack.lastTimestamp) {
        this.#eventBus.emit("chunk", chunk);
      } else {
        audioQueue.push(chunk);
      }

      return;
    }

    if (chunk.type === "AVC_NALU") {
      while (
        audioQueue.length > 0 &&
        audioQueue[0].timestamp < chunk.timestamp
      ) {
        if (
          videoQueue.length > 0 &&
          videoQueue[0].timestamp < audioQueue[0].timestamp
        ) {
          const cacheChunk = videoQueue.shift();
          if (cacheChunk) {
            this.#eventBus.emit("chunk", chunk);
          }
        } else {
          const cacheChunk = audioQueue.shift();
          if (cacheChunk) {
            this.#eventBus.emit("chunk", chunk);
          }
        }
      }

      if (chunk.timestamp <= this.#audioEncoderTrack.lastTimestamp) {
        this.#eventBus.emit("chunk", chunk);
      } else {
        videoQueue.push(chunk);
      }
    }
  }

  start() {
    if (this.#isProcessing) {
      throw new Error("已经开始");
    }

    this.#audioEncoderTrack?.start();
    this.#videoEncoderTrack?.start();

    this.#isProcessing = true;
  }

  flush() {}

  close() {}
}
