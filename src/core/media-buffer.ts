import EventEmitter from "eventemitter3";

import { RingBuffer } from "./ring-buffer";

interface MediaChunk {
  type: "video" | "audio";
  data: Uint8Array | undefined;
  timestamp: number;
}

export class MediaBuffer extends EventEmitter {
  private videoChunks: RingBuffer<MediaChunk>;
  private audioChunks: RingBuffer<MediaChunk>;

  constructor(bufferSize: number = 128) {
    super();
    this.videoChunks = new RingBuffer<MediaChunk>(bufferSize);
    this.audioChunks = new RingBuffer<MediaChunk>(bufferSize);
  }

  addVideoChunk(chunk: MediaChunk) {
    this.videoChunks.push(chunk);
    this.emit("dataAvailable", { type: "video" });
  }

  addAudioChunk(chunk: MediaChunk) {
    this.audioChunks.push(chunk);
    this.emit("dataAvailable", { type: "audio" });
  }

  getNextChunk() {
    if (this.videoChunks.length === 0 && this.audioChunks.length === 0) {
      return null;
    }

    if (this.videoChunks.length === 0) {
      return this.audioChunks.shift()?.data ?? null;
    }

    if (this.audioChunks.length === 0) {
      return this.videoChunks.shift()?.data ?? null;
    }

    const nextVideo = this.videoChunks.peek();
    const nextAudio = this.audioChunks.peek();

    if (!nextVideo || !nextAudio) {
      return null;
    }

    if (nextVideo.timestamp <= nextAudio.timestamp) {
      return this.videoChunks.shift()?.data ?? null;
    } else {
      return this.audioChunks.shift()?.data ?? null;
    }
  }

  clear() {
    this.videoChunks.clear();
    this.audioChunks.clear();
  }
}
