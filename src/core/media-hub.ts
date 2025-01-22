import { RingBuffer } from "./ring-buffer";

export interface MediaChunk {
  type: "AAC_RAW" | "AAC_SE" | "AVC_SE" | "AVC_NALU";
  data: Uint8Array;
  // PTS
  // [https://w3c.github.io/webcodecs/#dom-encodedvideochunk-timestamp-slot]
  timestamp: number;
  isKey: boolean;
}

export class MediaHub {
  private subs: ((chunk: MediaChunk) => void)[] = [];
  private audioBuffer: MediaChunk[];
  private videoBuffer: MediaChunk[];
  private videoLastTimestamp: number = 0;
  private audioLastTimestamp: number = 0;
  private timer: any | null = null;
  private lastChunk: MediaChunk | null = null;

  constructor() {
    this.audioBuffer = [];
    this.videoBuffer = [];
  }

  subscribe(callback: (chunk: MediaChunk) => void) {
    this.subs.push(callback);

    return () => {
      const index = this.subs.indexOf(callback);
      if (index == -1) {
        this.subs.splice(index, 1);
      }
    };
  }

  addChunk(chunk: MediaChunk) {
    // 当添加音频包时
    if (chunk.type === "AAC_RAW" || chunk.type === "AAC_SE") {
      while (
        this.videoBuffer.length > 0 &&
        this.videoBuffer[0].timestamp <= chunk.timestamp
      ) {
        let cacheChunk = this.videoBuffer.shift();
        if (cacheChunk) {
          this.notifySubs(cacheChunk);
          this.videoLastTimestamp = cacheChunk?.timestamp;
        }
      }

      if (chunk.timestamp <= this.videoLastTimestamp) {
        this.notifySubs(chunk);
        this.audioLastTimestamp = chunk.timestamp;
      } else {
        this.audioBuffer.push(chunk);
      }
    } else if (chunk.type === "AVC_NALU" || chunk.type === "AVC_SE") {
      while (
        this.audioBuffer.length > 0 &&
        this.audioBuffer[0].timestamp <= chunk.timestamp
      ) {
        let cacheChunk = this.audioBuffer.shift();
        if (cacheChunk) {
          this.notifySubs(cacheChunk);
          this.audioLastTimestamp = cacheChunk.timestamp;
        }
      }

      if (chunk.timestamp <= this.audioLastTimestamp) {
        this.notifySubs(chunk);
        this.videoLastTimestamp = chunk.timestamp;
      } else {
        this.videoBuffer.push(chunk);
      }
    } else {
      throw new Error("未知类型的媒体包");
    }
  }

  private notifySubs(chunk: MediaChunk) {
    this.subs.forEach((callback) => callback(chunk));
  }

  private async flush() {}

  clear() {
    this.subs = [];
  }
}
