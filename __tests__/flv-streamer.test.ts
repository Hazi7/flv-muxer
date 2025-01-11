import { beforeEach, describe, expect, it, vi } from "vitest";
import { FlvStreamer } from "../src/core/flv-streamer";

describe("FlvStreamer", () => {
  let writable: WritableStream<Uint8Array>;
  let writer: WritableStreamDefaultWriter<Uint8Array>;
  let streamer: FlvStreamer;

  beforeEach(() => {
    writable = new WritableStream({
      write(chunk) {},
      close() {},
    });
    writer = writable.getWriter();
    streamer = new FlvStreamer(writable, {
      hasVideo: true,
      hasAudio: true,
      width: 1280,
      height: 720,
      videoFrameRate: 30,
    });
  });

  describe("constructor", () => {
    it("should initialize with default options", () => {
      expect(streamer).toBeInstanceOf(FlvStreamer);
      expect(streamer.getVideoChunkHandler()).toBeDefined();
      expect(streamer.getAudioChunkHandler()).toBeDefined();
    });
  });

  describe("start", () => {
    it("should write FLV header and metadata", async () => {
      const writeSpy = vi.spyOn(writer, "write");
      await streamer.start();

      expect(writeSpy).toHaveBeenCalledTimes(2);
      const [header, metadata] = writeSpy.mock.calls;

      // Verify FLV header
      expect(header[0].length).toBeGreaterThan(0);
      expect(header[0][0]).toBe(0x46); // 'F'
      expect(header[0][1]).toBe(0x4c); // 'L'
      expect(header[0][2]).toBe(0x56); // 'V'

      // Verify metadata
      expect(metadata[0].length).toBeGreaterThan(0);
    });
  });

  describe("handleVideoChunk", () => {
    it("should handle keyframe correctly", async () => {
      const writeSpy = vi.spyOn(writer, "write");
      const chunk = new EncodedVideoChunk({
        type: "key",
        timestamp: 0,
        duration: 1000,
        data: new Uint8Array([0, 1, 2, 3]),
      });

      await streamer.handleVideoChunk(chunk);

      expect(writeSpy).toHaveBeenCalled();
      const videoTag = writeSpy.mock.calls[0][0];
      expect(videoTag.length).toBeGreaterThan(0);
    });

    it("should ignore non-keyframe when waiting for keyframe", async () => {
      const writeSpy = vi.spyOn(writer, "write");
      const chunk = new EncodedVideoChunk({
        type: "delta",
        timestamp: 0,
        duration: 1000,
        data: new Uint8Array([0, 1, 2, 3]),
      });

      await streamer.handleVideoChunk(chunk);
      expect(writeSpy).not.toHaveBeenCalled();
    });
  });

  describe("handleAudioChunk", () => {
    it("should handle audio chunk correctly", async () => {
      const writeSpy = vi.spyOn(writer, "write");
      const chunk = new EncodedAudioChunk({
        type: "key",
        timestamp: 0,
        duration: 1000,
        data: new Uint8Array([0, 1, 2, 3]),
      });

      await streamer.handleAudioChunk(chunk);

      expect(writeSpy).toHaveBeenCalled();
      const audioTag = writeSpy.mock.calls[0][0];
      expect(audioTag.length).toBeGreaterThan(0);
    });
  });

  describe("close", () => {
    it("should close the writer", async () => {
      const closeSpy = vi.spyOn(writer, "close");
      await streamer.close();
      expect(closeSpy).toHaveBeenCalled();
    });
  });
});
