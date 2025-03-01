import {
  type AudioEncoderTrack,
  type VideoEncoderTrack,
} from "./encoder-track";
import { EventBus } from "./event-bus";

export type ProcessorState = "recording" | "paused" | "inactive";

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

  state: ProcessorState = "inactive";

  #eventBus: EventBus;
  #audioEncoderTrack: AudioEncoderTrack | undefined;
  #videoEncoderTrack: VideoEncoderTrack | undefined;
  #audioConfigReady: boolean = false;
  #videoConfigReady: boolean = false;

  private constructor() {
    this.#eventBus = EventBus.getInstance();

    this.#initListeners();
  }

  #initListeners(): void {
    this.#eventBus.on("TRACK_CHUNK", (chunk) => {
      this.handleTrackChunk(chunk as TrackChunk);
    });
  }

  setAudioConfigReady(): void {
    this.#audioConfigReady = true;
  }

  setVideoConfigReady(): void {
    this.#videoConfigReady = true;
  }

  static getInstance(): StreamProcessor {
    if (!this.instance) {
      this.instance = new this();
    }

    return this.instance;
  }

  addTrackChunk(type: "audio" | "video", chunk: VideoFrame | AudioData): void {
    if (this.state !== "recording") {
      chunk.close();
      return;
    }

    if (type === "audio") {
      this.#audioEncoderTrack?.addTrackChunk(chunk);
    } else if (type === "video") {
      this.#videoEncoderTrack?.addTrackChunk(chunk);
    }
  }

  addAudioTrack(track: AudioEncoderTrack): void {
    this.#audioEncoderTrack = track;
  }

  addVideoTrack(track: VideoEncoderTrack): void {
    this.#videoEncoderTrack = track;
  }

  handleTrackChunk(chunk: TrackChunk): void {
    // 如果只有单个轨道，则发出该数据块
    if (!this.#audioEncoderTrack || !this.#videoEncoderTrack) {
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

    // 如果是音频包
    if (chunk.type === "AAC_RAW") {
      this.#processAudioChunk(chunk);
      return;
    }

    // 如果是视频包
    if (chunk.type === "AVC_NALU") {
      this.#processVideoChunk(chunk);
      return;
    }
  }

  start(): void {
    if (this.state !== "inactive") {
      return;
    }

    this.state = "recording";
  }

  async pause(): Promise<void> {
    if (this.state !== "recording") {
      return;
    }

    await this.#flush();

    this.state = "paused";
  }

  resume(): void {
    if (this.state !== "paused") {
      return;
    }

    this.state = "recording";
  }

  async stop(): Promise<void> {
    if (this.state !== "recording") {
      return;
    }

    await this.#flush();

    this.reset();

    this.state = "inactive";
  }

  reset(): void {
    this.#videoEncoderTrack?.reset();
    this.#videoConfigReady = false;

    this.#audioEncoderTrack?.reset();
    this.#audioConfigReady = false;
  }

  async #flush(): Promise<void> {
    await this.#audioEncoderTrack?.flush();
    await this.#videoEncoderTrack?.flush();
  }

  #processAudioChunk(chunk: TrackChunk): void {
    const audioTrack = this.#audioEncoderTrack!;
    const videoTrack = this.#videoEncoderTrack!;

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

  #processVideoChunk(chunk: TrackChunk): void {
    const audioTrack = this.#audioEncoderTrack!;
    const videoTrack = this.#videoEncoderTrack!;

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

  #publishChunk(chunk: TrackChunk | undefined): void {
    if (!chunk) return;
    this.#eventBus.emit("CHUNK_PUBLISH", chunk);
  }
}
