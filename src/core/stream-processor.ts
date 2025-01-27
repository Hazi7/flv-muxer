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
  audioEncoderTrack: AudioEncoderTrack | undefined;
  videoEncoderTrack: VideoEncoderTrack | undefined;
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
    this.audioEncoderTrack = track;
  }

  addVideoTrack(track: VideoEncoderTrack) {
    this.videoEncoderTrack = track;
  }

  handleTrackChunk(chunk: TrackChunk) {
    // 如果只有单个轨道，则发出该数据块
    if (!this.audioEncoderTrack || !this.videoEncoderTrack) {
      this.#eventBus.emit("chunk", chunk);
      return;
    }

    // 如果数据块是配置头（AAC_SE 或 AVC_SE），则发出该数据块
    if (chunk.type === "AAC_SE" || chunk.type === "AVC_SE") {
      this.#eventBus.emit("chunk", chunk);
      return;
    }

    if (chunk.type === "AAC_RAW") {
      // 如果是音频包
      this.#processAudioChunk(chunk);
      return;
    }

    // 如果是视频包
    if (chunk.type === "AVC_NALU") {
      this.#processVideoChunk(chunk);
      return;
    }
  }

  start() {
    if (this.#isProcessing) {
      throw new Error("已经开始");
    }

    this.audioEncoderTrack?.start();
    this.videoEncoderTrack?.start();

    this.#isProcessing = true;
  }

  flush() {}

  close() {}

  #processAudioChunk(chunk: TrackChunk) {
    const track = this.audioEncoderTrack!;

    if (!this.#audioConfigReady || !this.#videoConfigReady) {
      track.enqueue(chunk);
      return;
    }

    while (!track.isEmpty() && track.peek()!.timestamp <= chunk.timestamp) {
      this.#eventBus.emit("chunk", track.dequeue());
    }

    if (chunk.timestamp <= this.videoEncoderTrack!.lastTimestamp) {
      this.#eventBus.emit("chunk", chunk);
    } else {
      track.enqueue(chunk);
    }
  }

  #processVideoChunk(chunk: TrackChunk) {
    const track = this.videoEncoderTrack!;

    if (!this.#audioConfigReady || !this.#videoConfigReady) {
      track.enqueue(chunk);
      return;
    }

    while (!track.isEmpty() && track.peek()!.timestamp <= chunk.timestamp) {
      this.#eventBus.emit("chunk", track.dequeue());
    }

    if (chunk.timestamp <= this.audioEncoderTrack!.lastTimestamp) {
      this.#eventBus.emit("chunk", chunk);
    } else {
      track.enqueue(chunk);
    }
  }
}
