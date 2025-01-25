import { MediaHub } from "./media-hub";
import { RingBuffer } from "./ring-buffer";

export interface TrackChunk {
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
  static #instance: TrackState;
  baseTimestamp: number = 0;
  constructor() {}

  static getInstance() {
    if (!TrackState.#instance) {
      TrackState.#instance = new TrackState();
    }

    return TrackState.#instance;
  }
}

export abstract class BaseEncoderTrack {
  readonly processor: MediaStreamTrackProcessor;
  readonly mediaHub: MediaHub;
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

  constructor(
    track: MediaStreamTrack,
    config: VideoEncoderConfig | AudioEncoderConfig
  ) {
    this.processor = new MediaStreamTrackProcessor({ track });
    this.mediaHub = MediaHub.getInstance();
    this.buffer = new RingBuffer(16);

    this.initEncoder(config);

    this.state = TrackState.getInstance();
  }

  protected abstract handleOutput(
    chunk: EncodedMediaChunk,
    metadata?: EncodedMediaChunkMetadata
  ): void;

  protected abstract initEncoder(
    config: VideoEncoderConfig | AudioEncoderConfig
  ): void;

  abstract start(): Promise<void>;

  async stop(): Promise<void> {
    await this.encoder.flush();
  }

  async close(): Promise<void> {
    this.encoder.close();
  }

  calculateTimestamp(timestamp: number) {
    if (!this.state.baseTimestamp) {
      this.state.baseTimestamp = timestamp;
    }

    return Math.max(0, (timestamp - this.state.baseTimestamp) / 1000);
  }
}

export class VideoEncoderTrack extends BaseEncoderTrack {
  private frameCount: number = 0;

  constructor(track: MediaStreamTrack, config: VideoEncoderConfig) {
    super(track, config);
  }

  protected initEncoder(config: VideoEncoderConfig): void {
    this.encoder = new VideoEncoder({
      output: this.handleOutput.bind(this),
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
          frame.close();
        },
      })
    );
  }

  handleOutput(chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata) {
    try {
      // 添加视频元数据到缓冲区
      if (metadata?.decoderConfig?.description) {
        this.mediaHub.pushVideoChunk({
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
      this.mediaHub.pushVideoChunk({
        type: "AVC_NALU",
        data,
        timestamp,
        isKey: chunk.type === "key",
      });
      this.lastTimestamp = chunk.timestamp;
    } catch (error) {
      console.error(`Failed to handle video chunk: ${error}`);
    }
  }
}

export class AudioEncoderTrack extends BaseEncoderTrack {
  protected initEncoder(config: AudioEncoderConfig): void {
    this.encoder = new AudioEncoder({
      output: this.handleOutput.bind(this),
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
          frame.close();
        },
      })
    );
  }

  handleOutput(chunk: EncodedMediaChunk, metadata?: EncodedMediaChunkMetadata) {
    try {
      // 如果是关键帧，则添加音频解码器配置
      if (metadata?.decoderConfig?.description) {
        this.mediaHub.pushAudioChunk({
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
      this.mediaHub.pushAudioChunk({
        type: "AAC_RAW",
        data,
        timestamp,
        isKey: chunk.type === "key",
      });
      this.lastTimestamp = chunk.timestamp;
    } catch (error) {
      console.error(`Failed to handle audio chunk: ${error}`);
    }
  }
}
