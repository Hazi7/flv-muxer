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

    this.#initListeners();
  }

  #initListeners() {
    this.#eventBus.on("TRACK_CHUNK", (chunk) => {
      this.handleTrackChunk(chunk as TrackChunk);
    });
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

  addTrackChunk(type: "audio" | "video", chunk: VideoFrame | AudioData) {
    if (type === "audio") {
      this.audioEncoderTrack?.addTrackChunk(chunk);
    } else if (type === "video") {
      this.videoEncoderTrack?.addTrackChunk(chunk);
    }
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
      this.#publishChunk(chunk);
      return;
    }

    if (chunk.type === "AAC_SE") {
      if (!this.#audioConfigReady) {
        this.setAudioConfigReady();
      }

      this.#publishChunk(chunk);
      return;
    }

    if (chunk.type === "AVC_SE") {
      if (!this.#videoConfigReady) {
        this.setVideoConfigReady();
      }

      this.#publishChunk(chunk);
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
      throw new Error("Stream processor is already processing");
    }

    this.audioEncoderTrack?.start();
    this.videoEncoderTrack?.start();

    this.#isProcessing = true;
  }

  async pause() {
    if (!this.#isProcessing) {
      throw new Error(
        "StreamProcessor is not currently processing. Please call the 'start' method before proceeding."
      );
    }

    await this.audioEncoderTrack?.flush();
    this.audioEncoderTrack?.stop();

    await this.videoEncoderTrack?.flush();
    this.videoEncoderTrack?.stop();

    this.#isProcessing = false;
  }

  resume() {
    if (this.#isProcessing) {
      throw new Error("StreamProcessor is currently processing");
    }

    this.audioEncoderTrack?.resume();
    this.videoEncoderTrack?.resume();

    this.#isProcessing = true;
  }

  async stop() {
    if (!this.#isProcessing) {
      throw new Error(
        "StreamProcessor is not currently processing. Please call the 'start' method before proceeding."
      );
    }

    await this.audioEncoderTrack?.flush();
    this.audioEncoderTrack?.stop();

    await this.videoEncoderTrack?.flush();
    this.videoEncoderTrack?.stop();

    this.#isProcessing = false;
  }

  #processAudioChunk(chunk: TrackChunk) {
    const audioTrack = this.audioEncoderTrack!;
    const videoTrack = this.videoEncoderTrack!;

    if (!this.#audioConfigReady || !this.#videoConfigReady) {
      audioTrack.enqueue(chunk);
      return;
    }

    while (
      !videoTrack.isEmpty() &&
      videoTrack.peek()!.timestamp <= chunk.timestamp
    ) {
      this.#publishChunk(videoTrack.dequeue());
    }

    if (chunk.timestamp <= videoTrack.lastTimestamp) {
      this.#publishChunk(chunk);
    } else {
      audioTrack.enqueue(chunk);
    }
  }

  #processVideoChunk(chunk: TrackChunk) {
    const audioTrack = this.audioEncoderTrack!;
    const videoTrack = this.videoEncoderTrack!;

    if (!this.#audioConfigReady || !this.#videoConfigReady) {
      videoTrack.enqueue(chunk);
      return;
    }

    while (
      !audioTrack.isEmpty() &&
      audioTrack.peek()!.timestamp <= chunk.timestamp
    ) {
      this.#publishChunk(audioTrack.dequeue());
    }

    if (chunk.timestamp <= audioTrack.lastTimestamp) {
      this.#publishChunk(chunk);
    } else {
      videoTrack.enqueue(chunk);
    }
  }

  #publishChunk(chunk: TrackChunk | undefined) {
    if (!chunk) return;
    this.#eventBus.emit("CHUNK_PUBLISH", chunk);
  }
}
