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

export type MuxerMode = "record" | "live";

interface VideoOptions {
  encoderConfig: VideoEncoderConfig;
  keyframeInterval: number;
}

interface AudioOptions {
  encoderConfig: AudioEncoderConfig;
}

interface MuxerOptions {
  mode: MuxerMode;
  chunked: boolean;
  video?: VideoOptions;
  audio?: AudioOptions;
}

export class FlvMuxer {
  readonly #encoder: FlvEncoder;
  readonly #eventBus: EventBus;
  readonly #streamProcessor: StreamProcessor;
  readonly #outputStream: WritableStream | undefined;

  #options: MuxerOptions;
  #sourceStream: ReadableStream | undefined;
  #sourceStreamController: ReadableStreamDefaultController | undefined;
  #muxStream: TransformStream | undefined;
  #strategies: { [key: string]: MuxStrategy } = {};
  #readableHandler: undefined | ((chunk: Uint8Array) => void);

  get state() {
    return this.#streamProcessor.state;
  }

  constructor(
    writable: WritableStream,
    options: {
      mode: MuxerMode;
      chunked: boolean;
    }
  ) {
    if (!(writable instanceof WritableStream)) {
      throw new Error(
        "The provided 'writable' is not an instance of WritableStream."
      );
    }

    this.#encoder = new FlvEncoder();
    this.#eventBus = EventBus.getInstance();
    this.#streamProcessor = StreamProcessor.getInstance();
    this.#outputStream = writable;
    this.#options = options;

    // 初始化策略
    this.#initStrategies();
  }

  #initStrategies(): void {
    this.#strategies["AAC_SE"] = new AACSEStrategy();
    this.#strategies["AVC_SE"] = new AVCSEStrategy();
    this.#strategies["AAC_RAW"] = new AACRawStrategy();
    this.#strategies["AVC_NALU"] = new AVCNALUStrategy();
  }

  addRawChunk(type: "audio" | "video", chunk: VideoFrame | AudioData): void {
    this.#streamProcessor.addTrackChunk(type, chunk);
  }

  configureAudio(options: AudioOptions): void {
    if (!options.encoderConfig) {
      throw new Error("Audio encoder configuration cannot be empty");
    }

    this.#options.audio = options;

    this.#streamProcessor.addAudioTrack(
      new AudioEncoderTrack(options.encoderConfig)
    );
  }

  configureVideo(options: VideoOptions): void {
    if (!options.encoderConfig) {
      throw new Error("Video encoder configuration cannot be empty");
    }

    this.#options.video = options;

    this.#streamProcessor.addVideoTrack(
      new VideoEncoderTrack(options.encoderConfig, options.keyframeInterval)
    );
  }

  async start(): Promise<void> {
    if (!this.#options?.audio && !this.#options?.video) {
      throw new Error(
        "Muxer is not configured with audio or video tracks. Please call configureAudio() or configureVideo() first."
      );
    }

    try {
      this.#initSourceStream();
      this.#initMuxStream();

      if (!this.#sourceStream || !this.#muxStream || !this.#outputStream) {
        throw new Error("Failed to initialize streams");
      }

      this.#streamProcessor.start();

      return this.#sourceStream
        .pipeThrough(this.#muxStream)
        .pipeTo(this.#outputStream, {
          preventClose: true,
        });
    } catch (error) {
      throw new Error(`Error starting Muxer: ${error}`);
    }
  }

  pause(): Promise<void> {
    return this.#streamProcessor.pause();
  }

  resume(): void {
    this.#streamProcessor.resume();
  }

  stop(): Promise<void> {
    if (this.#readableHandler) {
      this.#eventBus.off("CHUNK_PUBLISH", this.#readableHandler);
    }

    this.#sourceStreamController?.close();
    return this.#streamProcessor.stop();
  }

  #initSourceStream(): void {
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

  #initMuxStream(): void {
    this.#muxStream = new TransformStream({
      start: async (controller) => {
        const header = this.#encoder.encodeFlvHeader(
          !!this.#options.video,
          !!this.#options.audio
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

  #encodeMetadata(): Uint8Array {
    const metadata: Record<string, unknown> = {
      duration: 0,
      encoder: "flv-muxer.js",
    };

    if (this.#options.video) {
      const { encoderConfig } = this.#options.video;

      Object.assign(metadata, {
        videocodecid: 7,
        width: encoderConfig.width,
        height: encoderConfig.height,
        framerate: encoderConfig.framerate,
      });
    }

    if (this.#options.audio) {
      const { encoderConfig } = this.#options.audio;

      Object.assign(metadata, {
        audiocodecid: 10,
        audiodatarate: (encoderConfig.bitrate ?? 0) / 1000,
        stereo: encoderConfig.numberOfChannels === 2,
        audiosamplerate: encoderConfig.sampleRate,
      });
    }

    const scriptData = this.#encoder.encodeScriptDataTag(metadata);

    return scriptData;
  }

  #muxChunk(chunk: TrackChunk): Uint8Array | undefined {
    if (!chunk) return;

    const strategy = this.#strategies[chunk.type];
    if (strategy) {
      return strategy.process(chunk, this.#encoder);
    }
  }
}
