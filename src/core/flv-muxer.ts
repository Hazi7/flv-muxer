import {
  type MuxStrategy,
  AACRawStrategy,
  AACSEStrategy,
  AVCSEStrategy,
  AVCNALUStrategy,
} from "../strategies/mux-strategy";
import { AudioEncoderTrack, VideoEncoderTrack } from "./encoder-track";
import { FlvEncoder } from "./flv-encoder";
import { MediaHub, type MediaChunk } from "./media-hub";

export interface MuxerOptions {
  video: VideoEncoderConfig;
  audio: AudioEncoderConfig;
}

export class FlvMuxer {
  private readonly strategies: { [key: string]: MuxStrategy } = {};
  private readonly options;
  private encoder: FlvEncoder;
  private mediaHub: MediaHub;
  private rawStream: ReadableStream;
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

    this.mediaHub = MediaHub.getInstance();

    if (audioTrack) {
      const track = new AudioEncoderTrack(audioTrack, this.options.audio);
      this.mediaHub.audioEncoderTrack = track;
    }

    if (videoTrack) {
      const track = new VideoEncoderTrack(videoTrack, this.options.video);
      this.mediaHub.videoEncoderTrack = track;
    }

    // 初始化策略
    this.initStrategies();

    this.rawStream = new ReadableStream({
      start: (controller) => {
        this.mediaHub.on("chunk", (chunk) => {
          controller.enqueue(chunk);
        });
      },
    });

    // 初始化转换流
    this.initTransform();
  }

  async start() {
    if (!this.transform) return;
    if (!this.writable) return;

    try {
      this.rawStream.pipeThrough(this.transform).pipeTo(this.writable);
    } catch (error) {
      throw new Error(`Error starting Muxer: ${error}`);
    }

    this.mediaHub.start(!!this.options.audio, !!this.options.video);
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
          // audiodatarate: this.options.audio.bitrate || 128,
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
      },
      transform: (chunk, controller) => {
        const tag = this.muxChunk(chunk);
        controller.enqueue(tag);
      },
    });
  }
}
