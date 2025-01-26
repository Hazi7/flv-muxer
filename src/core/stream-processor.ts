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

  /**
   * 创建FlvStreamer的实例。
   * @param writable - 用于写入FLV数据的可写流。
   * @param options - FLV流的配置选项。
   */
  private constructor() {
    this.#eventBus = EventBus.getInstance();
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

  pushAudioChunk(chunk: TrackChunk) {
    if (!this.#videoEncoderTrack) {
      this.#eventBus.emit("chunk", chunk);
      return;
    }

    if (chunk.type === "AAC_SE") {
      this.#eventBus.emit("chunk", chunk);
      return;
    }

    if (chunk.type === "AAC_RAW") {
      if (chunk.timestamp < this.#videoEncoderTrack.lastTimestamp) {
        this.#eventBus.emit("chunk", chunk);
        return;
      }

      if (this.#hasBufferedData()) {
        this.#processQueue();
        return;
      }

      this.#audioEncoderTrack?.buffer.enqueue(chunk);
    }
  }

  pushVideoChunk(chunk: TrackChunk) {
    if (!this.#audioEncoderTrack) {
      this.#eventBus.emit("chunk", chunk);
      return;
    }

    if (chunk.type === "AVC_SE") {
      this.#eventBus.emit("chunk", chunk);
      return;
    }

    if (chunk.type === "AVC_NALU") {
      if (chunk.timestamp < this.#audioEncoderTrack.lastTimestamp) {
        this.#eventBus.emit("chunk", chunk);
        return;
      }

      if (this.#hasBufferedData()) {
        this.#processQueue();
        return;
      }

      this.#videoEncoderTrack?.buffer.enqueue(chunk);
    }
  }

  start() {
    if (this.#audioEncoderTrack) {
      this.#audioEncoderTrack.start();
    }
    if (this.#videoEncoderTrack) {
      this.#videoEncoderTrack.start();
    }
  }

  flush() {}

  close() {}

  #processQueue() {
    while (this.#hasBufferedData()) {
      const audioTimestamp =
        this.#audioEncoderTrack?.buffer.peek()?.timestamp ?? 0;
      const videoTimestamp =
        this.#videoEncoderTrack?.buffer.peek()?.timestamp ?? 0;

      if (audioTimestamp <= videoTimestamp) {
        this.#eventBus.emit("chunk", this.#audioEncoderTrack?.buffer.dequeue());
      } else {
        this.#eventBus.emit("chunk", this.#videoEncoderTrack?.buffer.dequeue());
      }
    }
  }

  #hasBufferedData(): boolean {
    if (!this.#audioEncoderTrack || !this.#videoEncoderTrack) {
      throw new Error("不存在音频或视频轨道");
    }

    return (
      this.#audioEncoderTrack.buffer.length > 0 &&
      this.#videoEncoderTrack.buffer.length > 0
    );
  }
}
