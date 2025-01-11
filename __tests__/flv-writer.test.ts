import { beforeEach, describe, expect, it } from "vitest";
import { FlvWriter } from "../src/core/flv-writer";

describe("FlvWriter", () => {
  let writer: FlvWriter;

  beforeEach(() => {
    writer = new FlvWriter();
  });

  describe("createFlvHeader", () => {
    it("should create valid FLV header with video only", () => {
      const header = writer.createFlvHeader(true, false);

      // Verify FLV signature
      expect(header[0]).toBe(0x46); // 'F'
      expect(header[1]).toBe(0x4c); // 'L'
      expect(header[2]).toBe(0x56); // 'V'

      // Verify version
      expect(header[3]).toBe(1);

      // Verify flags (video only)
      expect(header[4]).toBe(0x01);

      // Verify header length
      expect(header.length).toBe(13);
    });

    it("should create valid FLV header with audio and video", () => {
      const header = writer.createFlvHeader(true, true);

      // Verify flags (audio + video)
      expect(header[4]).toBe(0x05);
    });
  });

  describe("createVideoTag", () => {
    it("should create valid video tag", () => {
      const videoData = new Uint8Array([0, 1, 2, 3]);
      const tag = writer.createVideoTag(
        "KeyFrame",
        "AVC",
        "NALU",
        0,
        1000,
        videoData
      );

      expect(tag.length).toBeGreaterThan(0);
      expect(tag[0]).toBe(9); // Video tag type
      expect(tag[4]).toBe(0xe8); // Timestamp LSB (1000 & 0xff)
    });
  });

  describe("createAudioTag", () => {
    it("should create valid audio tag", () => {
      const audioData = new Uint8Array([0, 1, 2, 3]);
      const tag = writer.createAudioTag(
        "AAC",
        "kHz44",
        "Sound16bit",
        "Stereo",
        1000,
        audioData
      );

      expect(tag.length).toBeGreaterThan(0);
      expect(tag[0]).toBe(8); // Audio tag type
      expect(tag[4]).toBe(0xe8); // Timestamp LSB (1000 & 0xff)
    });
  });

  describe("createScriptDataTag", () => {
    it("should create valid script data tag", () => {
      const metadata = {
        width: 1280,
        height: 720,
        framerate: 30,
      };
      const tag = writer.createScriptDataTag(metadata);

      expect(tag.length).toBeGreaterThan(0);
      expect(tag[0]).toBe(18); // Script data tag type
    });
  });
});
