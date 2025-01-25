import { beforeEach, describe, it } from "vitest";
import { expect } from "vitest";
import { AudioEncoderTrack } from "../src/core/encoder-track";
import { StreamMerge } from "../src/core/stream-merge";

describe("MediaHub", () => {
  let streamMerge: StreamMerge;

  beforeEach(() => {
    streamMerge = new StreamMerge();
  });

  it("时间戳应正确排序 1", () => {
    let result = [];
    streamMerge.eventBus.on("chunk", (chunk) => {
      result.push(chunk.timestamp);
    });

    streamMerge.pushAudioChunk({
      type: "AAC_SE",
      data: new Uint8Array(),
      isKey: true,
      timestamp: 0,
    });

    streamMerge.pushAudioChunk({
      type: "AAC_RAW",
      data: new Uint8Array(),
      isKey: true,
      timestamp: 0,
    });

    streamMerge.pushAudioChunk({
      type: "AAC_RAW",
      data: new Uint8Array(),
      isKey: true,
      timestamp: 21.333,
    });

    streamMerge.pushVideoChunk({
      type: "AVC_SE",
      data: new Uint8Array(),
      isKey: true,
      timestamp: 0,
    });

    streamMerge.pushVideoChunk({
      type: "AVC_NALU",
      data: new Uint8Array(),
      isKey: true,
      timestamp: 20.683,
    });

    streamMerge.pushVideoChunk({
      type: "AVC_NALU",
      data: new Uint8Array(),
      isKey: false,
      timestamp: 57.579,
    });

    streamMerge.pushAudioChunk({
      type: "AAC_RAW",
      data: new Uint8Array(),
      isKey: false,
      timestamp: 42.666,
    });

    expect(result.toString()).toBe("0,0,0,20.683,21.333,42.666");
  });

  it("时间戳应正确排序 2", () => {
    let result = [];
    streamMerge.eventBus.on("chunk", (chunk) => {
      result.push(chunk.timestamp);
    });

    streamMerge.pushAudioChunk({
      type: "AAC_SE",
      data: new Uint8Array(),
      isKey: true,
      timestamp: 0,
    });

    streamMerge.pushAudioChunk({
      type: "AAC_RAW",
      data: new Uint8Array(),
      isKey: true,
      timestamp: 0,
    });

    streamMerge.pushAudioChunk({
      type: "AAC_RAW",
      data: new Uint8Array(),
      isKey: true,
      timestamp: 21.333,
    });

    streamMerge.pushVideoChunk({
      type: "AVC_SE",
      data: new Uint8Array(),
      isKey: true,
      timestamp: 0,
    });

    streamMerge.pushVideoChunk({
      type: "AVC_NALU",
      data: new Uint8Array(),
      isKey: true,
      timestamp: 23.001,
    });

    streamMerge.pushVideoChunk({
      type: "AVC_NALU",
      data: new Uint8Array(),
      isKey: false,
      timestamp: 56.07,
    });

    streamMerge.pushAudioChunk({
      type: "AAC_RAW",
      data: new Uint8Array(),
      isKey: false,
      timestamp: 42.666,
    });

    streamMerge.pushAudioChunk({
      type: "AAC_RAW",
      data: new Uint8Array(),
      isKey: false,
      timestamp: 64,
    });

    streamMerge.pushVideoChunk({
      type: "AVC_NALU",
      data: new Uint8Array(),
      isKey: false,
      timestamp: 87.304,
    });

    streamMerge.pushAudioChunk({
      type: "AAC_RAW",
      data: new Uint8Array(),
      isKey: false,
      timestamp: 85.333,
    });

    expect(result.toString()).toBe(
      "0,0,0,21.333,23.001,42.666,56.07,64,85.333"
    );
  });
});
