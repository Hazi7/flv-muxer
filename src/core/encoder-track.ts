import { Logger } from "../utils/logger";
import { EventBus } from "./event-bus";
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
  isStill: boolean = false;

  /**
   * 获取 TrackState 的单例实例
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
  readonly trackProcessor: MediaStreamTrackProcessor;
  readonly queue: TrackChunk[] = [];
  readonly eventBus: EventBus;

  transform: TransformStream | undefined;
  writable: WritableStream | undefined;
  encoder!: VideoEncoder | AudioEncoder;
  state: TrackState;
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
    track: MediaStreamTrack,
    config: VideoEncoderConfig | AudioEncoderConfig,
    transform?: TransformStream
  ) {
    this.trackProcessor = new MediaStreamTrackProcessor({ track });
    this.eventBus = EventBus.getInstance();
    this.transform = transform;

    this.initEncoder(config);

    this.state = TrackState.getInstance();
  }

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

  protected abstract initWritable(): void;

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
  async start(): Promise<void> {
    if (this.writable) {
      if (this.transform) {
        await this.trackProcessor.readable
          .pipeThrough(this.transform)
          .pipeTo(this.writable);
      } else {
        await this.trackProcessor.readable.pipeTo(this.writable);
      }
    }
  }

  /**
   * 停止编码轨道
   * @returns Promise<void>
   */
  async flush(): Promise<void> {
    await this.encoder.flush();
  }

  /**
   * 关闭编码轨道
   * @returns Promise<void>
   */
  async close(): Promise<void> {
    await this.trackProcessor.readable.cancel();
    await this.writable?.close();
  }

  async cleanup(): Promise<void> {
    this.encoder.close();
    this.writable = undefined;
  }

  /**
   * 计算相对时间戳
   * @param timestamp 时间戳
   * @returns 相对时间戳
   */
  protected calculateTimestamp(timestamp: number) {
    if (!this.state.baseTimestamp) {
      this.state.baseTimestamp = timestamp;
    }

    return Math.max(0, (timestamp - this.state.baseTimestamp) / 1000);
  }
}

/**
 * 视频编码轨道类，继承自 BaseEncoderTrack
 */
export class VideoEncoderTrack extends BaseEncoderTrack {
  private frameCount: number = 0;
  private timer: number = 0;
  private lastFrame: VideoFrame | undefined;

  /**
   * 构造函数
   * @param track 媒体流轨道
   * @param config 视频编码器配置
   */
  constructor(
    track: MediaStreamTrack,
    config: VideoEncoderConfig,
    transform?: TransformStream
  ) {
    super(track, config, transform);
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

  protected initWritable(): void {
    this.writable = new WritableStream({
      write: (frame) => {
        // 浏览器的静态帧策略是为录制设计的，直播时需要直接 close 掉所有静态帧，自己手动实现静态帧策略

        if (this.state.isStill) {
          this.state.isStill = false;

          if (frame.timestamp <= this.lastTimestamp) {
            frame.close();
            return;
          }
        }

        this.#scheduleFrameProcessing(frame.clone());

        if (this.encoder.encodeQueueSize < 2) {
          this.frameCount++;
          this.encoder.encode(frame, {
            keyFrame: this.frameCount % 60 === 0,
          });
        }
        frame.close();
      },
    });
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

  #scheduleFrameProcessing(frame: VideoFrame) {
    clearTimeout(this.timer);

    this.lastFrame?.close();
    this.lastFrame = frame;

    this.timer = setTimeout(() => {
      if (frame) {
        this.state.isStill = true;
        if (!this.lastFrame) return;
        const videoFrame = new VideoFrame(frame, {
          duration: 100000,
          timestamp: this.lastFrame.timestamp + 100000,
        });

        this.encoder.encode(videoFrame as VideoFrame & AudioData, {
          keyFrame: true,
        });

        this.#scheduleFrameProcessing(videoFrame);
      }
    }, 100);
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

  protected initWritable(): void {
    this.writable = new WritableStream({
      write: (frame) => {
        if (this.encoder.encodeQueueSize < 2) {
          this.encoder.encode(frame);
        }
        frame.close();
      },
      close: () => {
        this.cleanup();
        Logger.info("AudioEncoderTrack: WritableStream closed");
      },
    });
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
