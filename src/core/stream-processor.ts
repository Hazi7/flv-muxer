import {
  type AudioEncoderTrack,
  type VideoEncoderTrack,
} from "./encoder-track";
import { EventBus } from "./event-bus";

export interface TrackChunk {
  type: "AAC_RAW" | "AAC_SE" | "AVC_SE" | "AVC_NALU";
  data: Uint8Array;
  // PTS
  // [https://w3c.github.io/webcodecs/#dom-encodedvideochunk-timestamp-slot]
  timestamp: number;
  isKey: boolean;
}

export class StreamProcessor {
  eventBus: EventBus;
  #tracks: [AudioEncoderTrack | undefined, VideoEncoderTrack | undefined] = [
    undefined,
    undefined,
  ];

  get audioEncoderTrack(): AudioEncoderTrack | undefined {
    return this.#tracks[0];
  }

  set audioEncoderTrack(track: AudioEncoderTrack) {
    this.#tracks[0] = track;
  }

  get videoEncoderTrack(): VideoEncoderTrack | undefined {
    return this.#tracks[1];
  }

  set videoEncoderTrack(track: VideoEncoderTrack) {
    this.#tracks[1] = track;
  }

  /**
   * 创建FlvStreamer的实例。
   * @param writable - 用于写入FLV数据的可写流。
   * @param options - FLV流的配置选项。
   */
  constructor() {
    this.eventBus = EventBus.getInstance();
  }

  pushAudioChunk(chunk: TrackChunk) {
    if (!this.videoEncoderTrack) {
      this.eventBus.emit("chunk", chunk);
      return;
    }

    if (chunk.type === "AAC_SE") {
      this.eventBus.emit("chunk", chunk);
      return;
    }

    if (chunk.type === "AAC_RAW") {
      if (this.videoEncoderTrack?.buffer.length > 0) {
        this.#processQueue();
      } else {
        this.audioEncoderTrack?.buffer.enqueue(chunk);
      }
    }
  }

  pushVideoChunk(chunk: TrackChunk) {
    // 如果是单轨道
    if (!this.audioEncoderTrack) {
      this.eventBus.emit("chunk", chunk);
      return;
    }

    if (chunk.type === "AVC_SE") {
      this.eventBus.emit("chunk", chunk);
      return;
    }

    if (chunk.type === "AVC_NALU") {
      if (this.audioEncoderTrack.buffer.length > 0) {
        this.#processQueue();
      } else {
        this.videoEncoderTrack?.buffer.enqueue(chunk);
      }
    }
  }

  start() {
    if (this.audioEncoderTrack) {
      this.audioEncoderTrack.start();
    }
    if (this.videoEncoderTrack) {
      this.videoEncoderTrack.start();
    }
  }

  flush() {}

  close() {}

  #processQueue() {
    while (this.#hasBufferedData()) {
      const audioTimestamp =
        this.audioEncoderTrack?.buffer.peek()?.timestamp ?? Infinity;
      const videoTimestamp =
        this.videoEncoderTrack?.buffer.peek()?.timestamp ?? Infinity;

      if (audioTimestamp <= videoTimestamp) {
        this.eventBus.emit("chunk", this.audioEncoderTrack?.buffer.dequeue());
      } else {
        this.eventBus.emit("chunk", this.videoEncoderTrack?.buffer.dequeue());
      }
    }
  }

  #hasBufferedData(): boolean {
    if (!this.audioEncoderTrack || !this.videoEncoderTrack) {
      throw new Error("不存在音频或视频轨道");
    }

    return (
      this.audioEncoderTrack.buffer.length > 0 &&
      this.videoEncoderTrack.buffer.length > 0
    );
  }
}
