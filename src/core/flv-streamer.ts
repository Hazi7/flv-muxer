import { FlvWriter } from "./flv-writer";

export interface FlvStreamOptions {
  hasAudio?: boolean;
  hasVideo?: boolean;
  width?: number;
  height?: number;
  audioCodec?: string;
  videoCodec?: string;
  videoFrameRate?: number;
}

/**
 * 用于将FLV数据流式传输到可写流的类。
 */
export class FlvStreamer extends FlvWriter {
  private readonly writable: WritableStream<Uint8Array>;
  private readonly writer: WritableStreamDefaultWriter<Uint8Array>;
  private readonly options: FlvStreamOptions;
  private readonly videoChunkHandler?: EncodedVideoChunkOutputCallback;
  private readonly audioChunkHandler?: EncodedAudioChunkOutputCallback;

  private baseTimestamp: number = 0;
  private firstTimestamp: number | null = null;
  private waitingKeyframe: boolean = true;
  private videoSequenceHeader: Uint8Array | null = null;
  private lastTimestamp: number = 0;

  /**
   * 创建FlvStreamer的实例。
   * @param writable - 用于写入FLV数据的可写流。
   * @param options - FLV流的配置选项。
   */
  constructor(
    writable: WritableStream<Uint8Array>,
    options: FlvStreamOptions = {}
  ) {
    super();
    this.writable = writable;
    this.writer = this.writable.getWriter();
    this.options = {
      hasAudio: false,
      hasVideo: true,
      width: 1280,
      height: 720,
      videoFrameRate: 30,
      ...options,
    };

    if (this.options.hasVideo) {
      this.videoChunkHandler = this.handleVideoChunk.bind(this);
    }
    if (this.options.hasAudio) {
      this.audioChunkHandler = this.handleAudioChunk.bind(this);
    }
  }

  /**
   * 通过写入FLV头和元数据来启动FLV流。
   */
  async start() {
    const header = this.createFlvHeader(
      this.options.hasVideo,
      this.options.hasAudio
    );
    await this.writer.write(header);

    await this.writeMetadata();
  }

  /**
   * 将元数据写入FLV流。
   */
  private async writeMetadata() {
    const metadata: Record<string, any> = {
      duration: 0,
      encoder: "FlvStreamWriter",
    };

    if (this.options.hasVideo) {
      Object.assign(metadata, {
        width: this.options.width,
        height: this.options.height,
        videodatarate: 1000,
        framerate: this.options.videoFrameRate,
        videocodecid: 7,
      });
    }

    if (this.options.hasAudio) {
      Object.assign(metadata, {
        audiocodecid: 10, // AAC
        audiosamplerate: 44100,
        audiosamplesize: 16,
        stereo: true,
      });
    }

    const scriptData = this.createScriptDataTag(metadata);
    await this.writer.write(scriptData);
  }

  /**
   * 处理传入的视频块并将其写入FLV流。
   * @param chunk - 要处理的视频块。
   * @param metadata - 与视频块关联的可选元数据。
   */
  async handleVideoChunk(
    chunk: EncodedVideoChunk,
    metadata?: EncodedVideoChunkMetadata
  ) {
    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);

    let timestamp = this.calculateTimestamp(chunk.timestamp / 1000);

    if (timestamp <= this.lastTimestamp) {
      timestamp = this.lastTimestamp + 1;
    }
    this.lastTimestamp = timestamp;

    const isKeyFrame = chunk.type === "key";

    if (this.waitingKeyframe && !isKeyFrame) {
      return;
    }
    this.waitingKeyframe = false;

    if (metadata?.decoderConfig) {
      this.videoSequenceHeader = new Uint8Array(
        metadata.decoderConfig.description as ArrayBuffer
      );

      const sequenceTag = this.createVideoTag(
        "KeyFrame",
        "AVC",
        "SequenceHeader",
        0,
        0,
        this.videoSequenceHeader
      );

      await this.writer.write(sequenceTag);
    }

    const videoTag = this.createVideoTag(
      isKeyFrame ? "KeyFrame" : "InterFrame",
      "AVC",
      "NALU",
      0,
      timestamp,
      data
    );

    await this.writer.write(videoTag);
  }

  /**
   * 计算视频块的时间戳。
   * @param timestamp - 块的原始时间戳。
   * @returns 调整后的时间戳。
   */
  private calculateTimestamp(timestamp: number): number {
    if (this.firstTimestamp === null) {
      this.firstTimestamp = timestamp;
    }
    return Math.max(0, timestamp - this.firstTimestamp + this.baseTimestamp);
  }

  /**
   * 返回视频块处理函数。
   * @returns 视频块处理函数。
   */
  getVideoChunkHandler() {
    return this.videoChunkHandler;
  }

  getAudioChunkHandler() {
    return this.audioChunkHandler;
  }

  /**
   * 处理传入的音频块并将其写入FLV流。
   * @param chunk - 要处理的音频块。
   * @param metadata - 与音频块关联的可选元数据。
   */
  async handleAudioChunk(
    chunk: EncodedAudioChunk,
    metadata?: EncodedAudioChunkMetadata
  ) {
    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);

    let timestamp = this.calculateTimestamp(chunk.timestamp / 1000);

    if (timestamp <= this.lastTimestamp) {
      timestamp = this.lastTimestamp + 1;
    }
    this.lastTimestamp = timestamp;

    if (metadata?.decoderConfig) {
      // AAC序列头
      const aacSequenceHeader = new Uint8Array(
        metadata.decoderConfig.description as ArrayBuffer
      );

      const sequenceTag = this.createAudioTag(
        "AAC",
        "kHz44",
        "Sound16bit",
        "Stereo",
        0,
        aacSequenceHeader
      );

      await this.writer.write(sequenceTag);
    }

    // AAC原始数据
    const audioTag = this.createAudioTag(
      "AAC",
      "kHz44",
      "Sound16bit",
      "Stereo",
      timestamp,
      data
    );

    await this.writer.write(audioTag);
  }

  /**
   * 关闭FLV流。
   */
  async close() {
    await this.writer.close();
  }
}
