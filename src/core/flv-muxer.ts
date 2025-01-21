import {
  type MuxStrategy,
  AACRawStrategy,
  AACSEStrategy,
  AVCSEStrategy,
  AVCNALUStrategy,
} from "../strategies/mux-strategy";
import { FlvEncoder } from "./flv-encoder";
import type { MediaChunk } from "./media-hub";
import { MediaProcessor } from "./media-processor";

export interface MuxerOptions {
  video: VideoEncoderConfig | undefined;
  audio: AudioEncoderConfig | undefined;
}

export class FlvMuxer {
  private readonly strategies: { [key: string]: MuxStrategy } = {};
  private readonly options;
  private processor: MediaProcessor;
  private encoder: FlvEncoder;
  private transform: TransformStream | null = null;
  private writable: WritableStream | null = null;

  constructor(
    writable: WritableStream<Uint8Array>,
    audioTrack: MediaStreamTrack,
    videoTrack: MediaStreamTrack,
    options: MuxerOptions
  ) {
    this.writable = writable;
    this.options = options;
    this.encoder = new FlvEncoder();
    this.processor = new MediaProcessor(audioTrack, videoTrack, options);

    // 初始化策略
    this.initStrategies();

    // 初始化转换流
    this.initTransform();
  }

  async start() {
    if (!this.transform) return;
    if (!this.writable) return;

    try {
      this.processor
        .getOutputStream()
        ?.pipeThrough(this.transform)
        .pipeTo(this.writable);
    } catch (error) {
      throw new Error(`Error starting Muxer: ${error}`);
    }
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

      if (this.options.video) {
        Object.assign(metadata, {
          width: this.options.video.width,
          height: this.options.video.height,
          framerate: 30,
          videocodecid: 7,
        });
      }

      if (this.options.audio) {
        Object.assign(metadata, {
          audiocodecid: 10,
          audiodatarate: this.options.audio.bitrate || 128,
          stereo: true,
          audiosamplerate: this.options.audio.sampleRate,
        });
      }

      const scriptData = this.encoder.encodeScriptDataTag(metadata);

      return scriptData;
    } catch (error) {
      console.error(`Failed to write metadata: ${error}`);
    }
  }

  private muxChunk(chunk: MediaChunk) {
    if (!chunk) return;

    const strategy = this.strategies[chunk.type];
    if (strategy) {
      return strategy.process(chunk, this.encoder);
    }

    return;
  }

  private initStrategies() {
    this.strategies["AAC_RAW"] = new AACRawStrategy();
    this.strategies["AAC_SE"] = new AACSEStrategy();
    this.strategies["AVC_SE"] = new AVCSEStrategy();
    this.strategies["AVC_NALU"] = new AVCNALUStrategy();
  }

  private initTransform() {
    this.transform = new TransformStream({
      start: async (controller) => {
        const header = this.encoder.encodeFlvHeader(
          !!this.options.video,
          !!this.options.audio
        );
        const metadata = this.encodeMetadata();
        controller.enqueue(header);
        controller.enqueue(metadata);

        this.processor.start();
      },
      transform: (chunk, controller) => {
        const tag = this.muxChunk(chunk);
        controller.enqueue(tag);
      },
    });
  }
}
