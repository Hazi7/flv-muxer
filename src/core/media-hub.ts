import {
  type AudioEncoderTrack,
  type VideoEncoderTrack,
} from "./encoder-track";
import { EventBus } from "./event-bus";

export interface MediaChunk {
  type: "AAC_RAW" | "AAC_SE" | "AVC_SE" | "AVC_NALU";
  data: Uint8Array;
  // PTS
  // [https://w3c.github.io/webcodecs/#dom-encodedvideochunk-timestamp-slot]
  timestamp: number;
  isKey: boolean;
}

export class MediaHub extends EventBus {
  private static instance: MediaHub;
  private tracks: [
    AudioEncoderTrack | undefined,
    VideoEncoderTrack | undefined
  ] = [undefined, undefined];

  get audioEncoderTrack(): AudioEncoderTrack | undefined {
    return this.tracks[0];
  }

  set audioEncoderTrack(track: AudioEncoderTrack) {
    this.tracks[0] = track;
  }

  get videoEncoderTrack(): VideoEncoderTrack | undefined {
    return this.tracks[1];
  }

  set videoEncoderTrack(track: VideoEncoderTrack) {
    this.tracks[1] = track;
  }

  /**
   * 创建FlvStreamer的实例。
   * @param writable - 用于写入FLV数据的可写流。
   * @param options - FLV流的配置选项。
   */
  constructor() {
    super();
  }

  static getInstance(): MediaHub {
    if (!MediaHub.instance) {
      MediaHub.instance = new MediaHub();
    }

    return MediaHub.instance;
  }

  addChunk(chunk: MediaChunk) {
    // 处理序列数据，直接发送
    if (chunk.type === "AAC_SE" || chunk.type === "AVC_SE") {
      this.emit("chunk", chunk);

      return;
    }

    if (chunk.type === "AAC_RAW") {
      // 如果是单轨道，直接发布数据
      if (this.tracks.some((track) => !track)) {
        this.emit("chunk", chunk);
      } else {
        if (this.videoEncoderTrack && this.audioEncoderTrack) {
          if (this.videoEncoderTrack) {
            if (chunk.timestamp <= this.videoEncoderTrack.lastTimestamp) {
              this.emit("chunk", chunk);
            }
            const buffer = this.videoEncoderTrack.buffer;
            const peekedChunk = buffer.peek();
            while (
              buffer.length > 0 &&
              peekedChunk &&
              peekedChunk.timestamp <= chunk.timestamp
            ) {
              const chunk = this.audioEncoderTrack.buffer.dequeue();
              this.emit("chunk", chunk);
            }
          }
        }
      }

      return;
    }

    if (chunk.type === "AVC_NALU") {
      // 如果是单轨道，直接发布数据
      if (this.tracks.some((track) => !track)) {
        this.emit("chunk", chunk);
      } else {
        // 是双轨道
        if (this.audioEncoderTrack && this.videoEncoderTrack) {
          if (chunk.timestamp <= this.audioEncoderTrack.lastTimestamp) {
            this.emit("chunk", chunk);
          }
          const buffer = this.audioEncoderTrack.buffer;
          const peekedChunk = buffer.peek();

          while (
            buffer.length > 0 &&
            peekedChunk &&
            peekedChunk.timestamp <= chunk.timestamp
          ) {
            const chunk = this.videoEncoderTrack.buffer.dequeue();
            this.emit("chunk", chunk);
          }
        }
      }

      return;
    }
  }

  start(audio: boolean, video: boolean) {
    if (audio && this.audioEncoderTrack) {
      this.audioEncoderTrack.start();
    }
    if (video && this.videoEncoderTrack) {
      this.videoEncoderTrack.start();
    }
  }

  flush() {}
}
