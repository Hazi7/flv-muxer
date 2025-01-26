import { StreamProcessor, type TrackChunk } from "./stream-processor";
import { RingBuffer } from "./ring-buffer";

/**
 * 表示编码后的媒体数据块，可以是音频或视频数据块
 */
type EncodedMediaChunk = EncodedAudioChunk | EncodedVideoChunk;

/**
 * 表示编码后的媒体数据块的元数据，可以是音频或视频数据块的元数据
 */
type EncodedMediaChunkMetadata =
  | EncodedAudioChunkMetadata
  | EncodedVideoChunkMetadata;

/**
 * 单例类，用于管理轨道状态
 */
class TrackState {
  static #instance: TrackState;

  baseTimestamp: number = 0;

  /**
   * 获取 TrackState 的单例实例
   * @returns TrackState 的单例实例
   */
  static getInstance() {
    if (!TrackState.#instance) {
      TrackState.#instance = new TrackState();
    }

    return TrackState.#instance;
  }
}

/**
 * 抽象基类，用于处理编码轨道
 */
export abstract class BaseEncoderTrack {
  readonly processor: MediaStreamTrackProcessor;
  readonly streamProcessor: StreamProcessor;
  readonly buffer: RingBuffer<TrackChunk>;

  encoder!: VideoEncoder | AudioEncoder;
  state: TrackState;
  lastTimestamp: number = 0;

  private _decoderConfig: AudioDecoderConfig | VideoDecoderConfig | undefined;

  get decoderConfig(): VideoDecoderConfig | undefined {
    return this._decoderConfig;
  }

  set decoderConfig(config: VideoDecoderConfig) {
    this._decoderConfig = config;
  }

  /**
   * 构造函数
   * @param track 媒体流轨道
   * @param config 编码器配置
   */
  constructor(
    track: MediaStreamTrack,
    config: VideoEncoderConfig | AudioEncoderConfig
  ) {
    this.processor = new MediaStreamTrackProcessor({ track });
    this.streamProcessor = StreamProcessor.getInstance();
    this.buffer = new RingBuffer(16);

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
    metadata?: EncodedMediaChunkMetadata
  ): void;

  /**
   * 初始化编码器
   * @param config 编码器配置
   */
  protected abstract initEncoder(
    config: VideoEncoderConfig | AudioEncoderConfig
  ): void;

  /**
   * 启动编码轨道
   * @returns Promise<void>
   */
  abstract start(): Promise<void>;

  /**
   * 停止编码轨道
   * @returns Promise<void>
   */
  async stop(): Promise<void> {
    await this.encoder.flush();
  }

  /**
   * 关闭编码轨道
   * @returns Promise<void>
   */
  async close(): Promise<void> {
    this.encoder.close();
  }

  /**
   * 计算相对时间戳
   * @param timestamp 时间戳
   * @returns 相对时间戳
   */
  calculateTimestamp(timestamp: number) {
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

  /**
   * 构造函数
   * @param track 媒体流轨道
   * @param config 视频编码器配置
   */
  constructor(track: MediaStreamTrack, config: VideoEncoderConfig) {
    super(track, config);
  }

  /**
   * 初始化视频编码器
   * @param config 视频编码器配置
   */
  protected initEncoder(config: VideoEncoderConfig): void {
    this.encoder = new VideoEncoder({
      output: this.handleOutput.bind(this),
      error: (e) => {
        console.error("VideoEncoder error:", e);
      },
    });

    this.encoder.configure(config);
  }

  /**
   * 启动视频编码轨道
   * @returns Promise<void>
   */
  async start(): Promise<void> {
    await this.processor.readable.pipeTo(
      new WritableStream({
        write: (frame) => {
          if (this.encoder.encodeQueueSize < 2) {
            this.frameCount++;
            this.encoder.encode(frame, {
              keyFrame: this.frameCount % 60 === 0,
            });
          }
          frame.close();
        },
      })
    );
  }

  /**
   * 处理视频编码输出
   * @param chunk 编码后的视频数据块
   * @param metadata 编码后的视频数据块的元数据
   */
  handleOutput(chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata) {
    try {
      // 添加视频元数据到缓冲区
      if (metadata?.decoderConfig?.description) {
        this.streamProcessor.pushVideoChunk({
          type: "AVC_SE",
          data: new Uint8Array(
            metadata?.decoderConfig?.description as ArrayBuffer
          ),
          timestamp: 0,
          isKey: true,
        });
      }

      // 将 EncodedVideoChunk 转为 Uint8Array
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);

      // 添加视频数据到缓冲区
      const timestamp = this.calculateTimestamp(chunk.timestamp);
      this.streamProcessor.pushVideoChunk({
        type: "AVC_NALU",
        data,
        timestamp,
        isKey: chunk.type === "key",
      });
      this.lastTimestamp = timestamp;
    } catch (error) {
      console.error(`Failed to handle video chunk: ${error}`);
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
      error: (e) => {
        console.error("AudioEncoder error:", e);
      },
    });

    this.encoder.configure(config);
  }

  /**
   * 启动音频编码轨道
   * @returns Promise<void>
   */
  async start(): Promise<void> {
    await this.processor.readable.pipeTo(
      new WritableStream({
        write: (frame) => {
          if (this.encoder.encodeQueueSize < 2) {
            this.encoder.encode(frame);
          }
          frame.close();
        },
      })
    );
  }

  /**
   * 处理音频编码输出
   * @param chunk 编码后的音频数据块
   * @param metadata 编码后的音频数据块的元数据
   */
  handleOutput(chunk: EncodedMediaChunk, metadata?: EncodedMediaChunkMetadata) {
    try {
      // 如果是关键帧，则添加音频解码器配置
      if (metadata?.decoderConfig?.description) {
        this.streamProcessor.pushAudioChunk({
          type: "AAC_SE",
          data: new Uint8Array(
            metadata?.decoderConfig?.description as ArrayBuffer
          ),
          timestamp: 0,
          isKey: true,
        });
      }

      // 将 EncodedAudioChunk 转为 Uint8Array
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);

      // 添加音频数据到缓冲区
      const timestamp = super.calculateTimestamp(chunk.timestamp); // 转换成相对时间戳
      this.streamProcessor.pushAudioChunk({
        type: "AAC_RAW",
        data,
        timestamp,
        isKey: chunk.type === "key",
      });
      this.lastTimestamp = timestamp;
    } catch (error) {
      console.error(`Failed to handle audio chunk: ${error}`);
    }
  }
}
