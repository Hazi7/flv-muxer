import type { FlvEncoder } from "../core/flv-encoder";
import type { MediaChunk } from "../core/media-buffer";

export interface MuxStrategy {
  process(chunk: MediaChunk, encoder: FlvEncoder): Uint8Array | undefined;
}

export class AACRawStrategy implements MuxStrategy {
  process(chunk: MediaChunk, encoder: FlvEncoder): Uint8Array | undefined {
    return encoder.encodeAudioTag<"AAC">({
      aacPacketType: "AACRaw",
      audioData: chunk.data,
      soundFormat: "AAC",
      soundRate: "kHz44",
      soundSize: "Sound16bit",
      soundType: "Stereo",
      timestamp: chunk.timestamp,
    });
  }
}

export class AACSEStrategy implements MuxStrategy {
  process(chunk: MediaChunk, encoder: FlvEncoder): Uint8Array | undefined {
    return encoder.encodeAudioTag<"AAC">({
      aacPacketType: "AACSequenceHeader",
      audioData: chunk.data,
      soundFormat: "AAC",
      soundRate: "kHz44",
      soundSize: "Sound16bit",
      soundType: "Stereo",
      timestamp: 0,
    });
  }
}

export class AVCSEStrategy implements MuxStrategy {
  process(chunk: MediaChunk, encoder: FlvEncoder): Uint8Array | undefined {
    return encoder.encodeVideoTag(
      "KeyFrame",
      "AVC",
      "SequenceHeader",
      0,
      0,
      chunk.data
    );
  }
}

export class AVCNALUStrategy implements MuxStrategy {
  process(chunk: MediaChunk, encoder: FlvEncoder): Uint8Array | undefined {
    return encoder.encodeVideoTag(
      chunk.isKey ? "KeyFrame" : "InterFrame",
      "AVC",
      "NALU",
      0,
      chunk.timestamp,
      chunk.data
    );
  }
}
