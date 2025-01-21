import type { MuxerOptions } from "./flv-muxer";
import { MediaBuffer } from "./media-buffer";

/**
 * 用于将FLV数据流式传输到可写流的类。
 */
export class MediaProcessor {
  private readonly options: MuxerOptions;
  private readonly buffer: MediaBuffer;
  private audioStream: ReadableStream | null = null;
  private videoStream: ReadableStream | null = null;
  private outputStream: ReadableStream | null = null;
  private audioEncoder: AudioEncoder | null = null;
  private videoEncoder: VideoEncoder | null = null;
  private baseTimestamp: number | null = null;
  private frameCount: number = 0;
  private _audioDecConfig: AudioDecoderConfig | null = null;
  private _videoDecConfig: VideoDecoderConfig | null = null;

  get audioDecConfig(): AudioDecoderConfig | null {
    return this._audioDecConfig;
  }

  set audioDecConfig(config: AudioDecoderConfig) {
    if (this._audioDecConfig) return;
    this._audioDecConfig = config;

    this.buffer.addChunk({
      type: "AAC_SE",
      data: new Uint8Array(config.description as ArrayBuffer),
      timestamp: 0,
      isKey: true,
    });
  }

  get videoDecConfig(): VideoDecoderConfig | null {
    return this._videoDecConfig;
  }

  set videoDecConfig(config: VideoDecoderConfig) {
    if (this._videoDecConfig) return;
    this._videoDecConfig = config;

    this.buffer.addChunk({
      type: "AVC_SE",
      data: new Uint8Array(config.description as ArrayBuffer),
      timestamp: 0,
      isKey: true,
    });
  }

  /**
   * 创建FlvStreamer的实例。
   * @param writable - 用于写入FLV数据的可写流。
   * @param options - FLV流的配置选项。
   */
  constructor(
    audioTrack: MediaStreamTrack,
    videoTrack: MediaStreamTrack,
    options: MuxerOptions
  ) {
    if (!options) {
      throw new Error("Missing parameters: <writable> or <options> or both");
    }

    this.options = options;
    this.buffer = new MediaBuffer();

    // 初始化编码器
    this.initEncoder();

    // 初始化媒体处理器
    this.initProcessor(audioTrack, videoTrack);
  }

  async start() {
    // 存存在音频轨道，进行编码
    if (this.audioStream) {
      this.audioStream.pipeTo(
        new WritableStream({
          write: (frame) => {
            if (this.audioEncoder) {
              // 当编码器不过载时候才处理帧，否则丢弃当前帧
              if (this.audioEncoder.encodeQueueSize < 2) {
                this.audioEncoder.encode(frame);
              }
              frame.close();
            }
          },
        })
      );
    }

    // 如存在视频轨道，进行编码
    if (this.videoStream) {
      this.videoStream.pipeTo(
        new WritableStream({
          write: (frame) => {
            if (this.videoEncoder) {
              if (this.videoEncoder.encodeQueueSize < 2) {
                this.frameCount++;
                this.videoEncoder.encode(frame, {
                  keyFrame: this.frameCount % 60 === 0,
                });
              }
              frame.close();
            }
          },
        })
      );
    }

    // 创建输出流
    this.outputStream = new ReadableStream({
      start: (controller) => {
        this.buffer.subscribe(() => {
          const chunk = this.buffer.getNextChunk();
          controller.enqueue(chunk);
        });
      },
      cancel: () => {},
    });
  }

  getOutputStream() {
    return this.outputStream;
  }

  /**
   * 关闭FLV流。
   */
  async close() {
    try {
    } catch (error) {
      console.error(`Failed to close writer: ${error}`);
    }
  }

  /**
   * 处理传入的音频块并将其写入FLV流。
   * @param chunk - 要处理的音频块。
   * @param metadata - 与音频块关联的可选元数据。
   */
  private async handleAudioChunk(
    chunk: EncodedAudioChunk,
    metadata?: EncodedAudioChunkMetadata
  ) {
    try {
      // 如果是关键帧，则添加音频解码器配置
      if (metadata?.decoderConfig?.description) {
        this.audioDecConfig = metadata.decoderConfig;
      }

      // 将 EncodedAudioChunk 转为 Uint8Array
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);

      // 添加音频数据到缓冲区
      const timestamp = this.calculateTimestamp(chunk.timestamp); // 转换成相对时间戳
      this.buffer.addChunk({
        type: "AAC_RAW",
        data,
        timestamp,
        isKey: chunk.type === "key",
      });
    } catch (error) {
      console.error(`Failed to handle audio chunk: ${error}`);
    }
  }

  /**
   * 处理传入的视频块并将其写入FLV流。
   * @param chunk - 要处理的视频块。
   */
  private async handleVideoChunk(
    chunk: EncodedVideoChunk,
    metadata?: EncodedVideoChunkMetadata
  ) {
    try {
      // 添加视频元数据到缓冲区
      if (metadata?.decoderConfig?.description) {
        this.videoDecConfig = metadata.decoderConfig;
      }

      // 将 EncodedVideoChunk 转为 Uint8Array
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);

      // 添加视频数据到缓冲区
      const timestamp = this.calculateTimestamp(chunk.timestamp);
      this.buffer.addChunk({
        type: "AVC_NALU",
        data,
        timestamp,
        isKey: chunk.type === "key",
      });
    } catch (error) {
      console.error(`Failed to handle video chunk: ${error}`);
    }
  }

  /**
   * 计算视频块的时间戳。
   * @param timestamp - 块的原始时间戳。
   * @returns 调整后的时间戳。
   */
  private calculateTimestamp(timestamp: number) {
    if (this.baseTimestamp === null) {
      this.baseTimestamp = timestamp;
    }

    return Math.max(0, (timestamp - this.baseTimestamp) / 1000);
  }

  private initEncoder() {
    // 初始化音频编码器
    this.audioEncoder = new AudioEncoder({
      output: (chunk, metadata) => {
        this.handleAudioChunk(chunk, metadata);
      },
      error: (error) => {
        console.log(error);
      },
    });
    if (this.options.audio) {
      this.audioEncoder.configure(this.options.audio);
    }

    // 初始化视频编码器
    this.videoEncoder = new VideoEncoder({
      output: (chunk, metadata) => {
        this.handleVideoChunk(chunk, metadata);
      },
      error: (error) => {
        console.log(error);
      },
    });
    if (this.options.video) {
      this.videoEncoder.configure(this.options.video);
    }
  }

  private initProcessor(
    audioTrack: MediaStreamTrack,
    videoTrack: MediaStreamTrack
  ) {
    this.audioStream = new MediaStreamTrackProcessor({
      track: audioTrack,
    }).readable;

    this.videoStream = new MediaStreamTrackProcessor({
      track: videoTrack,
    }).readable;
  }
}
