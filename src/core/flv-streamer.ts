import { SoundFormat } from "../constants/audio-type";
import { CodeId } from "../constants/video-type";
import { FlvWriter } from "./flv-writer";
import { MediaBuffer, type MediaChunk } from "./media-buffer";

export interface MuxerOptions {
  video: boolean;
  videocodecid: CodeId;
  framerate: number;
  audio: boolean;
  audiocodecid: SoundFormat;
  stereo: boolean;
}

/**
 * 用于将FLV数据流式传输到可写流的类。
 */
export class FlvStreamer extends FlvWriter {
  private baseTimestamp: number | null = null;
  private waitingKeyframe: boolean = true;
  private _videoDecoderConfig: VideoDecoderConfig | null = null;
  private _audioDecoderConfig: AudioDecoderConfig | null = null;

  get audioDecoderConfig() {
    return this._audioDecoderConfig;
  }

  set audioDecoderConfig(config: AudioDecoderConfig | null) {
    if (!this.options.audio) return;
    this._audioDecoderConfig = config;

    if (this.videoDecoderConfig) {
      this.start().catch((err) =>
        console.error(`Failed to start muxer: ${err}`)
      );
    }
  }

  get videoDecoderConfig() {
    return this._videoDecoderConfig;
  }

  set videoDecoderConfig(config: VideoDecoderConfig | null) {
    if (!this.options.video) return;
    this._videoDecoderConfig = config;

    if (this.audioDecoderConfig) {
      this.start().catch((err) =>
        console.error(`Failed to start muxer: ${err}`)
      );
    }
  }

  private readonly writable: WritableStream<Uint8Array>;
  private readonly writer: WritableStreamDefaultWriter<Uint8Array>;
  private readonly options: MuxerOptions;
  private readonly mediaBuffer: MediaBuffer<MediaChunk>;

  /**
   * 创建FlvStreamer的实例。
   * @param writable - 用于写入FLV数据的可写流。
   * @param options - FLV流的配置选项。
   */
  constructor(writable: WritableStream<Uint8Array>, options: MuxerOptions) {
    super();

    if (!writable || !options) {
      throw new Error("Missing parameters: <writable> or <options> or both");
    }

    this.writable = writable;
    this.writer = this.writable.getWriter();
    this.options = options;

    this.mediaBuffer = new MediaBuffer();
  }

  /**
   * 通过写入FLV头和元数据来启动FLV流。
   */
  private async start() {
    try {
      const header = this.createFlvHeader(
        this.options.video,
        this.options.audio
      );

      await this.writer.write(header);
      await this.writeMetadata();

      this.mediaBuffer.subscribe(() => {
        const chunk = this.mediaBuffer.getNextChunk();

        if (chunk) {
          this.writer
            .write(chunk.data)
            .catch((err) => console.error(`Failed to write chunk: ${err}`));
        }
      });
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
          // 不需要配置，从编码器中获取
          width: this.videoDecoderConfig?.codedWidth,
          height: this.videoDecoderConfig?.codedHeight,
          // 需要创建对象时候手动设置
          videocodecid: this.options.videocodecid,
          framerate: this.options.framerate,
        });
      }

      if (this.options.audio) {
        Object.assign(metadata, {
          // 不需要配置，从编码器中获取
          audiosamplerate: this.audioDecoderConfig?.sampleRate,
          // 需要创建对象时候手动设置
          audiocodecid: this.options.audiocodecid,
          stereo: this.options.stereo,
        });
      }

      const scriptData = this.createScriptDataTag(metadata);
      await this.writer.write(scriptData);
    } catch (error) {
      console.error(`Failed to write metadata: ${error}`);
    }
  }

  /**
   * 处理传入的视频块并将其写入FLV流。
   * @param chunk - 要处理的视频块。
   */
  async handleVideoChunk(
    chunk: EncodedVideoChunk,
    metadata?: EncodedVideoChunkMetadata
  ) {
    try {
      const isKeyFrame = chunk.type === "key"; // 是否是关键帧

      // 第一帧必须是关键帧
      if (this.waitingKeyframe) {
        if (isKeyFrame) {
          this.waitingKeyframe = false;
        } else return;
      }

      // 转换成相对时间戳
      let timestamp = this.calculateTimestamp(chunk.timestamp);

      // 如果是信息包
      if (metadata?.decoderConfig?.description) {
        this.videoDecoderConfig = metadata.decoderConfig;

        if (this.videoDecoderConfig.description) {
          const sequenceTag = this.createVideoTag(
            "KeyFrame",
            "AVC",
            "SequenceHeader",
            0,
            0,
            new Uint8Array(this.videoDecoderConfig.description as ArrayBuffer)
          );

          this.mediaBuffer.addChunk({
            type: "video",
            data: sequenceTag,
            timestamp: 0,
          });
        }
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

      this.mediaBuffer.addChunk({
        type: "video",
        data: videoTag,
        timestamp,
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
  async handleAudioChunk(
    chunk: EncodedAudioChunk,
    metadata?: EncodedAudioChunkMetadata
  ) {
    try {
      // 转换成相对时间戳
      let timestamp = this.calculateTimestamp(chunk.timestamp);

      if (metadata?.decoderConfig?.description) {
        this.audioDecoderConfig = metadata.decoderConfig;

        if (this.audioDecoderConfig.description) {
          const sequenceTag = this.createAudioTag<"AAC">({
            soundFormat: "AAC",
            soundRate: "kHz44",
            soundSize: "Sound16bit",
            soundType: "Stereo",
            timestamp: 0,
            audioData: new Uint8Array(
              this.audioDecoderConfig.description as ArrayBuffer
            ),
            aacPacketType: "AACSequenceHeader",
          });

          this.mediaBuffer.addChunk({
            type: "audio",
            data: sequenceTag,
            timestamp: 0,
          });
        }
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

      this.mediaBuffer.addChunk({
        type: "audio",
        data: audioTag,
        timestamp,
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

  /**
   * 关闭FLV流。
   */
  async close() {
    try {
      await this.writer.close();
    } catch (error) {
      console.error(`Failed to close writer: ${error}`);
    }
  }
}
