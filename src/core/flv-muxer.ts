import {
  type MediaChunkStrategy,
  AACRawStrategy,
  AACSEStrategy,
  AVCSEStrategy,
  AVCNALUStrategy,
} from "../strategies/buffer-strategy";
import { FlvEncoder } from "./flv-encoder";
import type { MediaChunk } from "./media-buffer";
import { MediaProcessor } from "./media-processor";

export interface MuxerOptions {
  video: VideoEncoderConfig | undefined;
  audio: AudioEncoderConfig | undefined;
}

export class FlvMuxer {
  private readonly strategies: { [key: string]: MediaChunkStrategy } = {};
  private processor: MediaProcessor;
  private encoder: FlvEncoder;
  private transform: TransformStream | null = null;
  private writable: WritableStream | null = null;
  private readonly options;
  private readonly writer: WritableStreamDefaultWriter<Uint8Array>;

  constructor(
    writable: WritableStream<Uint8Array>,
    audioTrack: MediaStreamTrack,
    videoTrack: MediaStreamTrack,
    options: MuxerOptions
  ) {
    this.writable = writable;
    this.writer = writable.getWriter();
    this.options = options;

    this.encoder = new FlvEncoder();
    this.processor = new MediaProcessor(audioTrack, videoTrack, options);

    // 初始化策略
    this.strategies["AAC_RAW"] = new AACRawStrategy();
    this.strategies["AAC_SE"] = new AACSEStrategy();
    this.strategies["AVC_SE"] = new AVCSEStrategy();
    this.strategies["AVC_NALU"] = new AVCNALUStrategy();

    // 初始化转换流
    this.initTransform();
  }

  private initTransform() {
    let muxer = this;

    this.transform = new TransformStream({
      async start() {
        const header = muxer.encoder.createFlvHeader(
          !!muxer.options.video,
          !!muxer.options.audio
        );
        await muxer.writer.write(header);
        await muxer.writeMetadata();
        muxer.processor.start();
      },
      transform(chunk, controller) {
        const tag = muxer.processChunk(chunk);
        controller.enqueue(tag);
      },
    });
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
  private async writeMetadata() {
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

      const scriptData = this.encoder.createScriptDataTag(metadata);
      await this.writer.write(scriptData);
    } catch (error) {
      console.error(`Failed to write metadata: ${error}`);
    }
  }

  private processChunk(chunk: MediaChunk) {
    const strategy = this.strategies[chunk.type];
    if (strategy) {
      strategy.process(chunk, this.encoder);
    }
  }
}
