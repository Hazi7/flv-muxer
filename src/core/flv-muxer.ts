import {
  type MuxStrategy,
  AACRawStrategy,
  AACSEStrategy,
  AVCSEStrategy,
  AVCNALUStrategy,
} from "../strategies/mux-strategy";
import { AudioEncoderTrack, VideoEncoderTrack } from "./encoder-track";
import { EventBus } from "./event-bus";
import { FlvEncoder } from "./flv-encoder";
import { StreamProcessor, type TrackChunk } from "./stream-processor";

export interface MuxerOptions {
  video: {
    track: MediaStreamTrack;
    config: VideoEncoderConfig;
  };
  audio: {
    track: MediaStreamTrack;
    config: AudioEncoderConfig;
  };
}

/**
 * FLV 多路复用器类
 */
export class FlvMuxer {
  readonly #encoder: FlvEncoder;
  readonly #eventBus: EventBus;
  readonly #streamProcessor: StreamProcessor;
  #options: MuxerOptions | undefined;
  #sourceStream: ReadableStream | undefined;
  #muxStream: TransformStream | undefined;
  #outputStream: WritableStream | undefined;
  #strategies: { [key: string]: MuxStrategy } = {};

  /**
   * 构造函数
   * @param writable - 输出的可写流
   */
  constructor(writable: WritableStream) {
    this.#encoder = new FlvEncoder();
    this.#eventBus = EventBus.getInstance();
    this.#streamProcessor = new StreamProcessor();

    this.#outputStream = writable;

    // 初始化策略
    this.#initStrategies();
  }

  /**
   * 初始化多路复用策略
   */
  #initStrategies() {
    this.#strategies["AAC_RAW"] = new AACRawStrategy();
    this.#strategies["AAC_SE"] = new AACSEStrategy();
    this.#strategies["AVC_SE"] = new AVCSEStrategy();
    this.#strategies["AVC_NALU"] = new AVCNALUStrategy();
  }

  /**
   * 初始化源流
   */
  #initSourceStream() {
    this.#sourceStream = new ReadableStream({
      start: (controller) => {
        this.#eventBus.on("chunk", (chunk) => {
          controller.enqueue(chunk);
        });
      },
      cancel: () => {
        // TODO 释放资源
      },
    });
  }

  /**
   * 初始化多路复用流
   */
  #initMuxStream() {
    this.#muxStream = new TransformStream({
      start: async (controller) => {
        const header = this.#encoder.encodeFlvHeader(
          !!this.#options?.video,
          !!this.#options?.audio
        );
        const metadata = this.#encodeMetadata();
        controller.enqueue(header);
        controller.enqueue(metadata);
      },
      transform: (chunk, controller) => {
        const tag = this.#muxChunk(chunk);
        controller.enqueue(tag);
      },
      flush: (controller) => {
        // TODO 释放资源
      },
    });
  }

  /**
   * 启动多路复用器
   */
  async start() {
    if (!this.#options) {
      throw new Error("Muxer not configured. Call configure() first.");
    }

    try {
      this.#initSourceStream();
      this.#initMuxStream();

      if (!this.#sourceStream || !this.#muxStream || !this.#outputStream) {
        throw new Error("Failed to initialize streams");
      }

      this.#sourceStream
        .pipeThrough(this.#muxStream)
        .pipeTo(this.#outputStream);
    } catch (error) {
      throw new Error(`Error starting Muxer: ${error}`);
    }

    this.#streamProcessor.start();
  }

  /**
   * 配置多路复用器选项
   * @param options - 多路复用器选项
   */
  async configure(options: MuxerOptions) {
    this.#options = options;

    const { track: audioTrack, config: audioConfig } = options.audio;

    if (audioTrack && audioConfig) {
      this.#streamProcessor.audioEncoderTrack = new AudioEncoderTrack(
        audioTrack,
        audioConfig
      );
    }

    const { track: videoTrack, config: videoConfig } = options.video;

    if (videoTrack && videoConfig) {
      this.#streamProcessor.videoEncoderTrack = new VideoEncoderTrack(
        videoTrack,
        videoConfig
      );
    }
  }

  /**
   * 停止多路复用器
   */
  async stop() {
    try {
      this.#sourceStream = undefined;
      this.#outputStream = undefined;
    } catch (error) {}
  }

  /**
   * 将元数据写入FLV流。
   */
  #encodeMetadata() {
    try {
      const metadata: Record<string, any> = {
        duration: 0,
        encoder: "flv-muxer.js",
      };

      if (this.#options?.video) {
        const { config } = this.#options.video;

        Object.assign(metadata, {
          width: config.width,
          height: config.height,
          framerate: 30,
          videocodecid: 7,
        });
      }

      if (this.#options?.audio) {
        const { config } = this.#options.audio;

        Object.assign(metadata, {
          audiocodecid: 10,
          audiodatarate: config.bitrate || 128,
          stereo: true,
          audiosamplerate: config.sampleRate,
        });
      }

      const scriptData = this.#encoder.encodeScriptDataTag(metadata);

      return scriptData;
    } catch (error) {
      console.error(`Failed to write metadata: ${error}`);
    }
  }

  /**
   * 处理数据块
   * @param chunk - 数据块
   */
  #muxChunk(chunk: TrackChunk) {
    if (!chunk) return;

    const strategy = this.#strategies[chunk.type];
    if (strategy) {
      return strategy.process(chunk, this.#encoder);
    }

    return;
  }
}
