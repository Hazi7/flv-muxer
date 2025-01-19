import { RingBuffer } from "./ring-buffer";

export interface MediaChunk {
  type: "video" | "audio";
  data: Uint8Array | undefined;
  timestamp: number;
}

export class MediaBuffer<T> extends RingBuffer<T> {
  private subs: ((data: T) => void)[] = [];

  constructor() {
    super(512);
  }

  subscribe(callback: (data: T) => void) {
    this.subs.push(callback);

    return () => {
      const index = this.subs.indexOf(callback);
      if (index == -1) {
        this.subs.splice(index, 1);
      }
    };
  }

  addChunk(chunk: T) {
    this.enqueue(chunk);
    this.notifySubs(chunk);
  }

  private notifySubs(data: T) {
    this.subs.forEach((callback) => callback(data));
  }

  getNextChunk() {
    return this.dequeue();
  }

  clear() {
    this.clear();
  }
}
