import { beforeEach, describe, it } from "vitest";
import { MediaHub } from "../src/core/media-hub";
import { expect } from "vitest";

describe("MediaHub", () => {
  let mediaHub: MediaHub;

  beforeEach(() => {
    mediaHub = new MediaHub();
  });

  it("时间戳应正确排序 1", () => {
    let result = [];
    mediaHub.subscribe((chunk) => {
      result.push(chunk.timestamp);
    });

    mediaHub.addChunk({
      type: "AAC_SE",
      data: new Uint8Array(),
      isKey: true,
      timestamp: 0,
    });

    mediaHub.addChunk({
      type: "AAC_RAW",
      data: new Uint8Array(),
      isKey: true,
      timestamp: 0,
    });

    mediaHub.addChunk({
      type: "AAC_RAW",
      data: new Uint8Array(),
      isKey: true,
      timestamp: 21.333,
    });

    mediaHub.addChunk({
      type: "AVC_SE",
      data: new Uint8Array(),
      isKey: true,
      timestamp: 0,
    });

    mediaHub.addChunk({
      type: "AVC_NALU",
      data: new Uint8Array(),
      isKey: true,
      timestamp: 20.683,
    });

    mediaHub.addChunk({
      type: "AVC_NALU",
      data: new Uint8Array(),
      isKey: false,
      timestamp: 57.579,
    });

    mediaHub.addChunk({
      type: "AAC_RAW",
      data: new Uint8Array(),
      isKey: false,
      timestamp: 42.666,
    });

    expect(result.toString()).toBe("0,0,0,20.683,21.333,42.666");
  });

  it("时间戳应正确排序 2", () => {
    let result = [];
    mediaHub.subscribe((chunk) => {
      result.push(chunk.timestamp);
    });

    mediaHub.addChunk({
      type: "AAC_SE",
      data: new Uint8Array(),
      isKey: true,
      timestamp: 0,
    });

    mediaHub.addChunk({
      type: "AAC_RAW",
      data: new Uint8Array(),
      isKey: true,
      timestamp: 0,
    });

    mediaHub.addChunk({
      type: "AAC_RAW",
      data: new Uint8Array(),
      isKey: true,
      timestamp: 21.333,
    });

    mediaHub.addChunk({
      type: "AVC_SE",
      data: new Uint8Array(),
      isKey: true,
      timestamp: 0,
    });

    mediaHub.addChunk({
      type: "AVC_NALU",
      data: new Uint8Array(),
      isKey: true,
      timestamp: 23.001,
    });

    mediaHub.addChunk({
      type: "AVC_NALU",
      data: new Uint8Array(),
      isKey: false,
      timestamp: 56.07,
    });

    mediaHub.addChunk({
      type: "AAC_RAW",
      data: new Uint8Array(),
      isKey: false,
      timestamp: 42.666,
    });

    mediaHub.addChunk({
      type: "AAC_RAW",
      data: new Uint8Array(),
      isKey: false,
      timestamp: 64,
    });

    mediaHub.addChunk({
      type: "AVC_NALU",
      data: new Uint8Array(),
      isKey: false,
      timestamp: 87.304,
    });

    mediaHub.addChunk({
      type: "AAC_RAW",
      data: new Uint8Array(),
      isKey: false,
      timestamp: 85.333,
    });

    expect(result.toString()).toBe("0,0,0,21.333,23.001,42.666,56.07,64,85.333");
  });
});
