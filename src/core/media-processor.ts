import type { MuxerOptions } from "./flv-muxer";
import { MediaBuffer, type MediaChunk } from "./media-buffer";

/**
 * 用于将FLV数据流式传输到可写流的类。
 */
export class MediaProcessor {
  private readonly options: MuxerOptions;
  private readonly buffer: MediaBuffer<MediaChunk>;
  private audioReadableStream: ReadableStream | null = null;
  private videoReadableStream: ReadableStream | null = null;
  private outputReadableStream: ReadableStream | null = null;
  private audioEncoder: AudioEncoder | null = null;
  private videoEncoder: VideoEncoder | null = null;
  private baseTimestamp: number | null = null;
  private _audioDecoderConfig: AudioDecoderConfig | null = null;
  private _videoDecoderConfig: VideoDecoderConfig | null = null;

  get audioDecoderConfig(): AudioDecoderConfig | null {
    return this._audioDecoderConfig;
  }

  set audioDecoderConfig(config: AudioDecoderConfig) {
    if (this._audioDecoderConfig) return;
    this._audioDecoderConfig = config;

    this.buffer.addChunk({
      type: "AAC_SE",
      data: new Uint8Array(config.description as ArrayBuffer),
      timestamp: 0,
      isKey: true,
    });
  }

  get videoDecoderConfig(): VideoDecoderConfig | null {
    return this._videoDecoderConfig;
  }

  set videoDecoderConfig(config: VideoDecoderConfig) {
    if (this._videoDecoderConfig) return;
    this._videoDecoderConfig = config;

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

    // TODO 判断如果不是对应轨道
    // 初始化媒体处理器
    this.initProcessor(audioTrack, videoTrack);
  }

  async start() {
    if (this.audioReadableStream && this.audioEncoder) {
      this.processAudio();
    }

    if (this.videoReadableStream && this.videoEncoder) {
      this.processVideo();
    }

    let mediaProcessor = this;

    this.outputReadableStream = new ReadableStream({
      start() {},
      pull() {
        mediaProcessor.buffer.getNextChunk();
      },
    });
  }

  getOutputStream() {
    return this.outputReadableStream;
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

  private async processAudio() {
    if (!this.audioReadableStream || !this.audioEncoder) return;

    const reader = this.audioReadableStream.getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) return;

        this.audioEncoder.encode(value);
        value.close();
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async processVideo() {
    if (!this.videoReadableStream || !this.videoEncoder) return;

    const reader = this.videoReadableStream.getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) return;

        this.videoEncoder.encode(value);
        value.close();
      }
    } finally {
      reader.releaseLock();
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
        this._videoDecoderConfig = metadata.decoderConfig;
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
   * 处理传入的音频块并将其写入FLV流。
   * @param chunk - 要处理的音频块。
   * @param metadata - 与音频块关联的可选元数据。
   */
  private async handleAudioChunk(
    chunk: EncodedAudioChunk,
    metadata?: EncodedAudioChunkMetadata
  ) {
    try {
      // 如果是关键帧，则更新音频解码器配置
      if (metadata?.decoderConfig?.description) {
        this.audioDecoderConfig = metadata.decoderConfig;
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
    this.audioEncoder = new AudioEncoder({
      output: (chunk, metadata) => {
        this.handleAudioChunk(chunk, metadata);
      },
      error: (error) => {
        console.log(error);
      },
    });

    try {
      this.options.audio && this.audioEncoder.configure(this.options.audio);
    } catch (e) {
      console.error(e);
    }

    this.videoEncoder = new VideoEncoder({
      output: (chunk, metadata) => {
        this.handleVideoChunk(chunk, metadata);
      },
      error: (error) => {
        console.log(error);
      },
    });

    this.videoEncoder.configure({
      codec: "avc1.640034",
      width: 1920,
      height: 1080,
    });
  }

  private initProcessor(
    audioTrack: MediaStreamTrack,
    videoTrack: MediaStreamTrack
  ) {
    if (this.audioReadableStream) {
      this.audioReadableStream = new MediaStreamTrackProcessor({
        track: audioTrack,
      }).readable;
    }
    this.videoReadableStream = new MediaStreamTrackProcessor({
      track: videoTrack,
    }).readable;
  }
}
