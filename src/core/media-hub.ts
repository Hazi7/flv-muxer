import {
  BaseEncoderTrack,
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
  private static videoTrack: VideoEncoderTrack;
  private static audioTrack: AudioEncoderTrack;

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

  static setAudioTrack(track: AudioEncoderTrack) {
    MediaHub.audioTrack = track;
  }

  static setVideoTrack(track: VideoEncoderTrack) {
    MediaHub.videoTrack = track;
  }

  addChunk(chunk: MediaChunk) {
    // 处理序列数据，直接发送
    if (chunk.type === "AAC_SE" || chunk.type === "AVC_SE") {
      this.emit("chunk", chunk);
      return;
    }

    if (chunk.type === "AAC_RAW") {
      if (chunk.timestamp <= BaseEncoderTrack.baseTimestamp) {
      }
    }
    // 是se时直接写入
    // 任一轨道进入，如果另一轨道没数据，则加入该轨道缓存
    // 如果俩个轨道都有数据，比较俩个轨道时间戳小的先取出
    // 如果任一轨道进入时间戳小于等于另一轨道最后时间戳则直接写入
  }

  flush() {}

  isBoth() {
    if (
      MediaHub.videoTrack.buffer.length > 0 &&
      MediaHub.audioTrack.buffer.length > 0
    ) {
      return true;
    }

    return false;
  }
}
