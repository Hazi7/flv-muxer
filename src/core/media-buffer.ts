import { RingBuffer } from "./ring-buffer";

export interface MediaChunk {
  type: "AAC_RAW" | "AAC_SE" | "AVC_SE" | "AVC_NALU";
  data: Uint8Array;
  // PTS
  // [https://w3c.github.io/webcodecs/#dom-encodedvideochunk-timestamp-slot]
  timestamp: number;
  isKey: boolean;
}

export class MediaBuffer extends RingBuffer<MediaChunk> {
  private subs: (() => void)[] = [];
  private timer: any | null = null;
  private lastChunk: MediaChunk | null = null;

  constructor() {
    super(512);
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
    this.enqueue(chunk);
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

  getNextChunk() {
    return this.dequeue();
  }

  clear() {
    super.clear();
    this.subs = [];
  }
}
