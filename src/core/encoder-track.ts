import { MediaHub } from "./media-hub";
import { RingBuffer } from "./ring-buffer";

interface TrackChunk {
  type: "AAC_RAW" | "AAC_SE" | "AVC_SE" | "AVC_NALU";
  data: Uint8Array;
  // PTS
  // [https://w3c.github.io/webcodecs/#dom-encodedvideochunk-timestamp-slot]
  timestamp: number;
  isKey: boolean;
}

type EncodedMediaChunk = EncodedAudioChunk | EncodedVideoChunk;
type EncodedMediaChunkMetadata =
  | EncodedAudioChunkMetadata
  | EncodedVideoChunkMetadata;

class TrackState {
  private static instance: TrackState;
  baseTimestamp: number = 0;
  constructor() {}

  static getInstance() {
    if (!TrackState.instance) {
      TrackState.instance = new TrackState();
    }

    return TrackState.instance;
  }
}

export abstract class BaseEncoderTrack {
  processor: MediaStreamTrackProcessor;
  encoder!: VideoEncoder | AudioEncoder;
  buffer: RingBuffer<TrackChunk>;
  mediaHub: MediaHub;
  state: TrackState;
  _decoderConfig: AudioDecoderConfig | VideoDecoderConfig | undefined;

  get decoderConfig(): VideoDecoderConfig | undefined {
    return this._decoderConfig;
  }

  set decoderConfig(config: VideoDecoderConfig) {
    this._decoderConfig = config;
  }

  constructor(
    track: MediaStreamTrack,
    config: VideoEncoderConfig | AudioEncoderConfig
  ) {
    // 初始化 Processor
    this.processor = new MediaStreamTrackProcessor({
      track,
    });

    // 初始化编码器
    this.initEncoder(config);

    this.mediaHub = MediaHub.getInstance();
    this.state = TrackState.getInstance();
    this.buffer = new RingBuffer(16);
  }

  protected abstract initEncoder(
    config: VideoEncoderConfig | AudioEncoderConfig
  ): void;

  addMetadata(config: VideoDecoderConfig) {
    this._decoderConfig = config;
  }

  enqueue(chunk: TrackChunk) {
    this.buffer.enqueue(chunk);
  }

  calculateTimestamp(timestamp: number) {
    if (!this.state.baseTimestamp) {
      this.state.baseTimestamp = timestamp;
    }

    return Math.max(0, (timestamp - this.state.baseTimestamp) / 1000);
  }

  async stop(): Promise<void> {
    await this.encoder.flush();
  }

  abstract start(): Promise<void>;

  abstract handleOutput(
    chunk: EncodedMediaChunk,
    metadata?: EncodedMediaChunkMetadata
  ): void;
}

export class VideoEncoderTrack extends BaseEncoderTrack {
  private frameCount: number = 0;
  constructor(track: MediaStreamTrack, config: VideoEncoderConfig) {
    super(track, config);
  }

  protected initEncoder(config: VideoEncoderConfig): void {
    this.encoder = new VideoEncoder({
      output: this.handleOutput,
      error: (e) => {
        console.error("VideoEncoder error:", e);
      },
    });

    this.encoder.configure(config);
  }

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
        },
      })
    );
  }

  handleOutput(chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata) {
    try {
      // 添加视频元数据到缓冲区
      if (metadata?.decoderConfig?.description) {
      }

      // 将 EncodedVideoChunk 转为 Uint8Array
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);

      // 添加视频数据到缓冲区
      const timestamp = this.calculateTimestamp(chunk.timestamp);
      this.mediaHub.addChunk({
        type: "AVC_NALU",
        data,
        timestamp,
        isKey: chunk.type === "key",
      });
    } catch (error) {
      console.error(`Failed to handle video chunk: ${error}`);
    }
  }
}

export class AudioEncoderTrack extends BaseEncoderTrack {
  handleOutput(chunk: EncodedMediaChunk, metadata?: EncodedMediaChunkMetadata) {
    try {
      // 如果是关键帧，则添加音频解码器配置
      if (metadata?.decoderConfig?.description) {
        this.addMetadata(metadata.decoderConfig);
      }

      // 将 EncodedAudioChunk 转为 Uint8Array
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);

      // 添加音频数据到缓冲区
      const timestamp = this.calculateTimestamp(chunk.timestamp); // 转换成相对时间戳
      this.mediaHub.addChunk({
        type: "AAC_RAW",
        data,
        timestamp,
        isKey: chunk.type === "key",
      });
    } catch (error) {
      console.error(`Failed to handle audio chunk: ${error}`);
    }
  }

  protected initEncoder(config: AudioEncoderConfig): void {
    this.encoder = new AudioEncoder({
      output: this.handleOutput,
      error: (e) => {
        console.error("VideoEncoder error:", e);
      },
    });

    this.encoder.configure(config);
  }

  async start(): Promise<void> {
    await this.processor.readable.pipeTo(
      new WritableStream({
        write: (frame) => {
          if (this.encoder.encodeQueueSize < 2) {
            this.encoder.encode(frame);
          }
        },
      })
    );
  }
}
