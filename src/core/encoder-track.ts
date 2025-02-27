import { Logger } from "../utils/logger";
import { EventBus } from "./event-bus";
import type { MuxerMode } from "./flv-muxer";
import { StreamProcessor, type TrackChunk } from "./stream-processor";

type EncodedMediaChunk = EncodedAudioChunk | EncodedVideoChunk;

type MediaDecoderConfig = AudioDecoderConfig | VideoDecoderConfig;

class TrackState {
  static #instance: TrackState;

  baseTimestamp: number = 0;

  static getInstance() {
    if (!this.#instance) {
      this.#instance = new this();
    }

    return this.#instance;
  }
}

export abstract class BaseEncoderTrack {
  readonly eventBus: EventBus;
  readonly queue: TrackChunk[] = [];
  readonly mode: MuxerMode = "record";
  readonly config: VideoEncoderConfig | AudioEncoderConfig;

  encoder: VideoEncoder | AudioEncoder | undefined;
  trackState: TrackState;
  lastTimestamp: number = 0;

  private _decoderConfig: AudioDecoderConfig | VideoDecoderConfig | undefined;

  get decoderConfig(): VideoDecoderConfig | undefined {
    return this._decoderConfig;
  }

  get state() {
    return StreamProcessor.getInstance().state;
  }

  set decoderConfig(config: MediaDecoderConfig) {
    if (this._decoderConfig) return;
    this._decoderConfig = config;

    if (this instanceof AudioEncoderTrack) {
      this.eventBus.emit("TRACK_CHUNK", {
        type: "AAC_SE",
        data: new Uint8Array(config.description as ArrayBuffer),
        timestamp: 0,
        isKey: true,
      });
    } else {
      this.eventBus.emit("TRACK_CHUNK", {
        type: "AVC_SE",
        data: new Uint8Array(config.description as ArrayBuffer),
        timestamp: 0,
        isKey: true,
      });
    }
  }

  constructor(config: VideoEncoderConfig | AudioEncoderConfig) {
    this.eventBus = EventBus.getInstance();
    this.trackState = TrackState.getInstance();
    this.config = config;

    this.initEncoder(config);
  }

  abstract addTrackChunk(chunk: VideoFrame | AudioData): void;

  protected abstract handleOutput(
    chunk: EncodedMediaChunk,
    metadata?: EncodedAudioChunkMetadata | EncodedVideoChunkMetadata
  ): void;

  protected abstract initEncoder(
    config: VideoEncoderConfig | AudioEncoderConfig
  ): void;

  enqueue(chunk: TrackChunk): void {
    this.queue.push(chunk);
  }

  dequeue(): TrackChunk | undefined {
    return this.queue.shift();
  }

  peek(): TrackChunk | undefined {
    return this.queue[0];
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  length() {
    return this.queue.length;
  }

  close(): void {
    if (this.state !== "recording") {
      throw new Error("Cannot stop track as it is not currently recording.");
    }

    if (!this.encoder) {
      throw new Error("Encoder is not initialized.");
    }

    this.encoder.close();
  }

  reset(): void {
    if (this.trackState.baseTimestamp !== 0) {
      this.trackState.baseTimestamp = 0;
    }

    this._decoderConfig = undefined;
  }

  async flush(): Promise<void> {
    if (!this.encoder) {
      throw new Error("Encoder is not initialized.");
    }

    return this.encoder.flush();
  }

  protected calculateTimestamp(timestamp: number) {
    if (!this.trackState.baseTimestamp) {
      this.trackState.baseTimestamp = timestamp;
    }

    return Math.max(0, (timestamp - this.trackState.baseTimestamp) / 1000);
  }
}

export class VideoEncoderTrack extends BaseEncoderTrack {
  #frameCount: number = 0;
  #keyframeInterval: number = 90;

  constructor(config: VideoEncoderConfig, keyframeInterval: number) {
    super(config);

    this.#keyframeInterval = keyframeInterval;
  }

  protected initEncoder(config: VideoEncoderConfig): void {
    this.encoder = new VideoEncoder({
      output: this.handleOutput.bind(this),
      error: (error) => {
        Logger.error(`VideoEncoder error: ${error}`);
        throw new Error(error.message);
      },
    });

    this.encoder.configure(config);
  }

  addTrackChunk(frame: VideoFrame | AudioData): void {
    if (this.state !== "recording") {
      frame.close();
      return;
    }

    if (!this.encoder) {
      throw new Error("Encoder is not initialized.");
    }

    this.encoder.encode(frame as VideoFrame & AudioData, {
      keyFrame: this.#frameCount % this.#keyframeInterval === 0,
    });

    this.#frameCount++;

    frame.close();
  }

  protected handleOutput(
    chunk: EncodedVideoChunk,
    metadata?: EncodedVideoChunkMetadata
  ) {
    try {
      // 添加视频元数据到缓冲区
      if (metadata?.decoderConfig?.description) {
        this.decoderConfig = metadata.decoderConfig;
      }

      // 将 EncodedVideoChunk 转为 Uint8Array
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);

      // 添加视频数据到缓冲区
      const timestamp = this.calculateTimestamp(chunk.timestamp);
      this.eventBus.emit("TRACK_CHUNK", {
        type: "AVC_NALU",
        data,
        timestamp,
        isKey: chunk.type === "key",
      });

      this.lastTimestamp = timestamp;
    } catch (error) {
      Logger.error(`Failed to handle video chunk: ${error}`);
    }
  }

  reset(): void {
    super.reset();
    this.#frameCount = 0;
  }
}

export class AudioEncoderTrack extends BaseEncoderTrack {
  protected initEncoder(config: AudioEncoderConfig): void {
    this.encoder = new AudioEncoder({
      output: this.handleOutput.bind(this),
      error: (error) => {
        Logger.error(`AudioEncoder error:", ${error.message} `);
        throw new Error(error.message);
      },
    });

    this.encoder.configure(config);
  }

  addTrackChunk(chunk: VideoFrame | AudioData): void {
    if (this.state !== "recording") {
      chunk.close();
      return;
    }

    if (!this.encoder) {
      throw new Error("Encoder is not initialized.");
    }

    this.encoder.encode(chunk as VideoFrame & AudioData);

    chunk.close();
  }

  protected handleOutput(
    chunk: EncodedMediaChunk,
    metadata?: EncodedAudioChunkMetadata
  ) {
    try {
      // 如果是关键帧，则添加音频解码器配置
      if (metadata?.decoderConfig?.description) {
        this.decoderConfig = metadata.decoderConfig;
      }

      // 将 EncodedAudioChunk 转为 Uint8Array
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);

      // 添加音频数据到缓冲区
      const timestamp = super.calculateTimestamp(chunk.timestamp); // 转换成相对时间
      this.eventBus.emit("TRACK_CHUNK", {
        type: "AAC_RAW",
        data,
        timestamp,
        isKey: chunk.type === "key",
      });

      this.lastTimestamp = timestamp;
    } catch (error) {
      Logger.error(`Failed to handle audio chunk: ${error}`);
    }
  }
}
