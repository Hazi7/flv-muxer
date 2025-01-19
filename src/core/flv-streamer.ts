import { FlvWriter } from "./flv-writer";
import { MediaBuffer } from "./media-buffer";

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

  private readonly mediaBuffer: MediaBuffer;

  private baseTimestamp: number | null = null;
  private waitingKeyframe: boolean = true;
  private videoSequenceHeader: Uint8Array | null = null;
  private videoLastTimestamp: number = 0;
  private audioLastTimestamp: number = 0;

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
      hasAudio: true,
      hasVideo: true,
      width: 1920,
      height: 1080,
      videoFrameRate: 30,
      ...options,
    };
    this.mediaBuffer = new MediaBuffer();

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

    this.mediaBuffer.on("dataAvailable", () => {
      const chunk = this.mediaBuffer.getNextChunk();
      if (chunk) {
        this.writer.write(chunk);
      }
    });
    // this.mediaObservable.subscribe((chunk) => {
    //   this.writer.write(chunk.data);
    // });
  }

  /**
   * 将元数据写入FLV流。
   */
  private async writeMetadata() {
    const metadata: Record<string, any> = {
      duration: 0,
      encoder: "flv-muxer.js",
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
    console.log(chunk);
    let timestamp = this.calculateTimestamp(chunk.timestamp);

    if (timestamp <= this.videoLastTimestamp) {
      timestamp = this.videoLastTimestamp + 1;
    }
    this.videoLastTimestamp = timestamp;

    const isKeyFrame = chunk.type === "key";

    if (this.waitingKeyframe && !isKeyFrame) {
      return;
    }
    this.waitingKeyframe = false;

    if (metadata?.decoderConfig?.description) {
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

      this.mediaBuffer.addVideoChunk({
        type: "video",
        data: sequenceTag,
        timestamp: 0,
      });
      // await this.writer.write(sequenceTag);
    }

    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);

    const videoTag = this.createVideoTag(
      isKeyFrame ? "KeyFrame" : "InterFrame",
      "AVC",
      "NALU",
      0,
      timestamp,
      data
    );

    this.mediaBuffer.addVideoChunk({
      type: "video",
      data: videoTag,
      timestamp,
    });
    // await this.writer.write(videoTag);
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
    console.log(chunk);
    let timestamp = this.calculateTimestamp(chunk.timestamp);

    if (timestamp <= this.audioLastTimestamp) {
      timestamp = this.audioLastTimestamp + 1;
    }
    this.audioLastTimestamp = timestamp;

    if (metadata?.decoderConfig?.description) {
      // AAC序列头
      const aacSequenceHeader = new Uint8Array(
        metadata.decoderConfig.description as ArrayBuffer
      );

      const sequenceTag = this.createAudioTag<"AAC">({
        soundFormat: "AAC",
        soundRate: "kHz44",
        soundSize: "Sound16bit",
        soundType: "Stereo",
        timestamp: 0,
        audioData: aacSequenceHeader,
        aacPacketType: "AACSequenceHeader",
      });

      this.mediaBuffer.addAudioChunk({
        type: "audio",
        data: sequenceTag,
        timestamp: 0,
      });
    }

    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);

    // AAC原始数据
    const audioTag = this.createAudioTag<"AAC">({
      soundFormat: "AAC",
      soundRate: "kHz44",
      soundSize: "Sound16bit",
      soundType: "Stereo",
      timestamp,
      audioData: data,
      aacPacketType: "AACRaw",
    });

    this.mediaBuffer.addAudioChunk({
      type: "audio",
      data: audioTag,
      timestamp,
    });

    // await this.writer.write(audioTag);
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
   * 关闭FLV流。
   */
  async close() {
    await this.writer.close();
  }
}
