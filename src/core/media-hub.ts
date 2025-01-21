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
  private subs: (() => void)[] = [];
  private audioBuffer: RingBuffer<MediaChunk>;
  private videoBuffer: RingBuffer<MediaChunk>;
  private timer: any | null = null;
  private lastChunk: MediaChunk | null = null;

  constructor() {
    this.audioBuffer = new RingBuffer(16);
    this.videoBuffer = new RingBuffer(16);
  }

  subscribe(callback: () => void) {
    this.subs.push(callback);

    return () => {
      const index = this.subs.indexOf(callback);
      if (index == -1) {
        this.subs.splice(index, 1);
      }
    };
  }

  addChunk(chunk: MediaChunk) {
    if (chunk.type === "AAC_RAW" || chunk.type === "AAC_SE") {
      this.audioBuffer.enqueue(chunk);
    } else if (chunk.type === "AVC_NALU" || chunk.type === "AVC_SE") {
      this.videoBuffer.enqueue(chunk);
    } else {
      throw new Error("未知类型的媒体包");
    }
    // this.lastChunk = chunk;
    this.notifySubs();

    // this.timer && clearTimeout(this.timer);
    // this.timer = setTimeout(() => {
    //   if (!this.lastChunk) return;
    //   this.addChunk({
    //     type: this.lastChunk.type,
    //     data: this.lastChunk.data,
    //     isKey: this.lastChunk.isKey,
    //     timestamp: 0,
    //   });
    // }, 200);
  }

  private notifySubs() {
    this.subs.forEach((callback) => callback());
  }

  private async flush() {
    
  }

  getNextChunk() {}

  clear() {
    this.subs = [];
  }
}
