import {
  type MuxStrategy,
  AACRawStrategy,
  AACSEStrategy,
  AVCSEStrategy,
  AVCNALUStrategy,
} from "../strategies/mux-strategy";
import { EventBus } from "./event-bus";
import { FlvEncoder } from "./flv-encoder";
import { type TrackChunk } from "./stream-merge";

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

export class FlvMuxer {
  readonly #encoder: FlvEncoder;
  readonly #eventBus: EventBus;
  #options: MuxerOptions | undefined;
  #sourceStream: ReadableStream | undefined;
  #muxStream: TransformStream | undefined;
  #outputStream: WritableStream | undefined;
  #strategies: { [key: string]: MuxStrategy } = {};

  constructor(writable: WritableStream) {
    this.#encoder = new FlvEncoder();
    this.#eventBus = EventBus.getInstance();

    this.#outputStream = writable;

    // 初始化策略
    this.initStrategies();
  }

  private initSourceStream() {
    this.#sourceStream = new ReadableStream({
      start: (controller) => {
        this.#eventBus.on("chunk", (chunk) => {
          controller.enqueue(chunk);
        });
      },
      cancel: () => {},
    });
  }

  private initMuxStream() {
    this.#muxStream = new TransformStream({
      start: async (controller) => {
        const header = this.#encoder.encodeFlvHeader(
          !!this.#options?.video,
          !!this.#options?.audio
        );
        const metadata = this.encodeMetadata();
        controller.enqueue(header);
        controller.enqueue(metadata);
      },
      transform: (chunk, controller) => {
        const tag = this.muxChunk(chunk);
        controller.enqueue(tag);
      },
      flush: (controller) => {},
    });
  }

  private initStrategies() {
    this.#strategies["AAC_RAW"] = new AACRawStrategy();
    this.#strategies["AAC_SE"] = new AACSEStrategy();
    this.#strategies["AVC_SE"] = new AVCSEStrategy();
    this.#strategies["AVC_NALU"] = new AVCNALUStrategy();
  }

  async start() {
    if (!this.#options) {
      throw new Error("Muxer not configured. Call configure() first.");
    }

    try {
      this.initSourceStream();
      this.initMuxStream();

      if (!this.#sourceStream || !this.#muxStream || !this.#outputStream) {
        throw new Error("Failed to initialize streams");
      }

      this.#sourceStream
        .pipeThrough(this.#muxStream)
        .pipeTo(this.#outputStream);
    } catch (error) {
      throw new Error(`Error starting Muxer: ${error}`);
    }

    // this.#mediaHub.start(!!this.#options.audio, !!this.#options.video);
  }

  async configure(config: MuxerOptions) {
    this.#options = config;
  }

  async stop() {
    try {
      this.#eventBus;

      this.#sourceStream = undefined;
      this.#outputStream = undefined;
    } catch (error) {}
  }

  /**
   * 将元数据写入FLV流。
   */
  private encodeMetadata() {
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
          audiodatarate: config.bitrate,
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

  private muxChunk(chunk: TrackChunk) {
    if (!chunk) return;

    const strategy = this.#strategies[chunk.type];
    if (strategy) {
      return strategy.process(chunk, this.#encoder);
    }

    return;
  }
}
