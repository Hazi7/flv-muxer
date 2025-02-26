import { Logger } from "../utils/logger";
import { EventBus } from "./event-bus";
import type { MuxerMode, MuxerState } from "./flv-muxer";
import { type TrackChunk } from "./stream-processor";

/**
 * 表示编码后的媒体数据块，可以是音频或视频数据块
 */
type EncodedMediaChunk = EncodedAudioChunk | EncodedVideoChunk;

/**
 * 表示编码后的媒体数据块的元数据，可以是音频或视频数据块的元数据
 */
type MediaDecoderConfig = AudioDecoderConfig | VideoDecoderConfig;

/**
 * 单例类，用于管理轨道状态
 */
class TrackState {
  static #instance: TrackState;

  baseTimestamp: number = 0;

  /**
   * 获取 TrackState 的单例实例
   *
   * @returns TrackState 的单例实例
   */
  static getInstance() {
    if (!this.#instance) {
      this.#instance = new this();
    }

    return this.#instance;
  }
}

/**
 * 抽象基类，用于处理编码轨道
 */
export abstract class BaseEncoderTrack {
  readonly eventBus: EventBus;
  readonly queue: TrackChunk[] = [];
  readonly mode: MuxerMode;
  readonly config: VideoEncoderConfig | AudioEncoderConfig;

  encoder: VideoEncoder | AudioEncoder | undefined;
  trackState: TrackState;
  muxerState: MuxerState | undefined;
  lastTimestamp: number = 0;

  private _decoderConfig: AudioDecoderConfig | VideoDecoderConfig | undefined;

  get decoderConfig(): VideoDecoderConfig | undefined {
    return this._decoderConfig;
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

  /**
   * 构造函数
   * @param track 媒体流轨道
   * @param config 编码器配置
   */
  constructor(
    config: VideoEncoderConfig | AudioEncoderConfig,
    mode: MuxerMode
  ) {
    this.eventBus = EventBus.getInstance();
    this.trackState = TrackState.getInstance();
    this.config = config;
    this.mode = mode;

    this.initEncoder(config);
  }

  abstract addTrackChunk(chunk: VideoFrame | AudioData): void;

  /**
   * 处理编码输出
   * @param chunk 编码后的媒体数据块
   * @param metadata 编码后的媒体数据块的元数据
   */
  protected abstract handleOutput(
    chunk: EncodedMediaChunk,
    metadata?: EncodedAudioChunkMetadata | EncodedVideoChunkMetadata
  ): void;

  /**
   * 初始化编码器
   * @param config 编码器配置
   */
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

  /**
   * 启动编码轨道
   * @returns Promise<void>
   */
  start() {
    this.muxerState = "recording";
  }

  /**
   * 停止编码轨道
   * @returns Promise<void>
   */
  async flush(): Promise<void> {
    if (!this.encoder) {
      throw new Error("Encoder is not initialized.");
    }

    this.muxerState = "paused";
    return this.encoder.flush();
  }

  /**
   * 关闭编码轨道
   * @returns Promise<void>
   */
  close(): void {
    if (!this.encoder) {
      throw new Error("Encoder is not initialized.");
    }

    this.muxerState = "stopped";
    this.encoder.close();
  }

  /**
   * 计算相对时间戳
   * @param timestamp 时间戳
   * @returns 相对时间戳
   */
  protected calculateTimestamp(timestamp: number) {
    if (!this.trackState.baseTimestamp) {
      this.trackState.baseTimestamp = timestamp;
    }

    return Math.max(0, (timestamp - this.trackState.baseTimestamp) / 1000);
  }
}

/**
 * 视频编码轨道类，继承自 BaseEncoderTrack
 */
export class VideoEncoderTrack extends BaseEncoderTrack {
  private frameCount: number = 0;
  private keyframeInterval: number = 90;

  /**
   * 构造函数
   * @param track 媒体流轨道
   * @param config 视频编码器配置
   */
  constructor(
    config: VideoEncoderConfig,
    mode: MuxerMode,
    keyframeInterval: number
  ) {
    super(config, mode);

    this.keyframeInterval = keyframeInterval;
  }

  /**
   * 初始化视频编码器
   * @param config 视频编码器配置
   */
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

  addTrackChunk(chunk: VideoFrame | AudioData): void {
    if (this.muxerState !== "recording") {
      chunk.close();
      return;
    }

    if (!this.encoder) {
      throw new Error("Encoder is not initialized.");
    }

    if (this.encoder.encodeQueueSize < 2) {
      this.frameCount++;

      this.encoder.encode(chunk as VideoFrame & AudioData, {
        keyFrame: this.frameCount % this.keyframeInterval === 0,
      });
    }

    chunk.close();
  }

  /**
   * 处理视频编码输出
   * @param chunk 编码后的视频数据块
   * @param metadata 编码后的视频数据块的元数据
   */
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
}

/**
 * 音频编码轨道类，继承自 BaseEncoderTrack
 */
export class AudioEncoderTrack extends BaseEncoderTrack {
  /**
   * 初始化音频编码器
   * @param config 音频编码器配置
   */
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
    if (this.muxerState !== "recording") {
      chunk.close();
      return;
    }

    if (!this.encoder) {
      throw new Error("Encoder is not initialized.");
    }

    if (this.encoder.encodeQueueSize < 2) {
      this.encoder.encode(chunk as VideoFrame & AudioData);
    }
    chunk.close();
  }

  /**
   * 处理音频编码输出
   * @param chunk 编码后的音频数据块
   * @param metadata 编码后的音频数据块的元数据
   */
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
