import {
  type MuxStrategy,
  AACRawStrategy,
  AACSEStrategy,
  AVCSEStrategy,
  AVCNALUStrategy,
} from "../strategies/mux-strategy";
import { Logger } from "../utils/logger";
import { AudioEncoderTrack, VideoEncoderTrack } from "./encoder-track";
import { EventBus } from "./event-bus";
import { FlvEncoder } from "./flv-encoder";
import { StreamProcessor, type TrackChunk } from "./stream-processor";

export type MuxerMode = "record" | "live";

export interface MuxerOptions {
  mode: MuxerMode;
  video: {
    track: MediaStreamTrack;
    config: VideoEncoderConfig;
  };
  audio: {
    track: MediaStreamTrack;
    config: AudioEncoderConfig;
  };
  chunked: boolean;
}
export type MuxerState = "recording" | "paused" | "stopped";

/**
 * FLV 多路复用器类
 */
export class FlvMuxer {
  readonly #encoder: FlvEncoder;
  readonly #eventBus: EventBus;
  readonly #streamProcessor: StreamProcessor;

  #options: MuxerOptions | undefined;
  #sourceStream: ReadableStream | undefined;
  #sourceStreamController: ReadableStreamDefaultController | undefined;
  #muxStream: TransformStream | undefined;
  #outputStream: WritableStream | undefined;
  #strategies: { [key: string]: MuxStrategy } = {};

  #readableHandler: undefined | ((chunk: Uint8Array) => void);

  /**
   * 构造函数
   * @param writable - 输出的可写流
   */
  constructor(writable: WritableStream) {
    this.#encoder = new FlvEncoder();
    this.#eventBus = EventBus.getInstance();
    this.#streamProcessor = StreamProcessor.getInstance();

    this.#outputStream = writable;

    // 初始化策略
    this.#initStrategies();
  }

  /**
   * 初始化多路复用策略
   */
  #initStrategies() {
    this.#strategies["AAC_SE"] = new AACSEStrategy();
    this.#strategies["AVC_SE"] = new AVCSEStrategy();
    this.#strategies["AAC_RAW"] = new AACRawStrategy();
    this.#strategies["AVC_NALU"] = new AVCNALUStrategy();
  }

  /**
   * 配置多路复用器选项
   * @param options - 多路复用器选项
   */
  configure(options: MuxerOptions) {
    this.#options = options;

    const { track: audioTrack, config: audioConfig } = options.audio;

    if (audioTrack && audioConfig) {
      this.#streamProcessor.addAudioTrack(
        new AudioEncoderTrack(audioTrack, audioConfig, this.#options.mode)
      );
    }

    const { track: videoTrack, config: videoConfig } = options.video;

    if (videoTrack && videoConfig) {
      this.#streamProcessor.addVideoTrack(
        new VideoEncoderTrack(videoTrack, videoConfig, this.#options.mode)
      );
    }
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

      this.#eventBus.emit("START_MUXER");

      this.#streamProcessor.start();

      await this.#sourceStream
        .pipeThrough(this.#muxStream)
        .pipeTo(this.#outputStream);

      // 取消流
      this.#sourceStream?.cancel();
    } catch (error) {
      throw new Error(`Error starting Muxer: ${error}`);
    }
  }

  pause() {
    if (!this.#sourceStream || !this.#muxStream || !this.#outputStream) {
      throw new Error("Muxer is not running.");
    }

    this.#eventBus.emit("PAUSE_MUXER");
  }

  /**
   * 恢复多路复用器
   */
  resume() {
    if (!this.#sourceStream || !this.#muxStream || !this.#outputStream) {
      throw new Error("Muxer is not running.");
    }

    this.#eventBus.emit("RESUME_MUXER");
  }

  /**
   * 停止多路复用器
   */
  stop() {
    try {
      this.#eventBus.emit("STOP_MUXER");
      this.#streamProcessor.close();
      this.#sourceStreamController?.close();

      if (this.#readableHandler) {
        this.#eventBus.off("CHUNK_PUBLISH", this.#readableHandler);
      }

      this.#readableHandler = undefined;
      this.#sourceStream = undefined;
    } catch (error) {
      Logger.error(`Error stopping Muxer: ${error}`);
    }
  }

  /**
   * 初始化源流
   */
  #initSourceStream() {
    this.#sourceStream = new ReadableStream({
      start: (controller) => {
        this.#sourceStreamController = controller;
        this.#readableHandler = (chunk: Uint8Array) => {
          controller.enqueue(chunk);
        };

        this.#eventBus.on("CHUNK_PUBLISH", this.#readableHandler);
      },
    });
  }

  /**
   * 初始化多路复用流（将 TrackChunk 转换为 FLV 包）
   */
  #initMuxStream() {
    this.#muxStream = new TransformStream({
      start: async (controller) => {
        const header = this.#encoder.encodeFlvHeader(
          !!this.#options?.video.track,
          !!this.#options?.audio.track
        );
        const metadata = this.#encodeMetadata();
        controller.enqueue(header);
        controller.enqueue(metadata);
      },
      transform: (chunk, controller) => {
        const tag = this.#muxChunk(chunk);
        controller.enqueue(tag);
      },
      flush: () => {
        this.#muxStream = undefined;
      },
    });
  }

  /**
   * 将元数据写入FLV流。
   */
  #encodeMetadata() {
    try {
      const metadata: Record<string, unknown> = {
        duration: 0,
        encoder: "flv-muxer.js",
      };

      if (this.#options?.video.track) {
        const { config } = this.#options.video;

        Object.assign(metadata, {
          videocodecid: 7,
          width: config.width,
          height: config.height,
          framerate: config.framerate,
        });
      }

      if (this.#options?.audio.track) {
        const { config } = this.#options.audio;

        Object.assign(metadata, {
          audiocodecid: 10,
          audiodatarate: (config.bitrate ?? 0) / 1000,
          stereo: config.numberOfChannels === 2,
          audiosamplerate: config.sampleRate,
        });
      }

      const scriptData = this.#encoder.encodeScriptDataTag(metadata);

      return scriptData;
    } catch (error) {
      Logger.error(`Failed to write metadata: ${error}`);
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
  }
}
