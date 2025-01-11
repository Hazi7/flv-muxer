import { beforeEach, describe, expect, it } from "vitest";
import { AmfType } from "../src/constants/amf-type";
import { AmfEncoder } from "../src/core/amf-encoder";
import { toHexString } from "./test-utils";

describe("AmfEncoder", () => {
  let encoder: AmfEncoder;

  beforeEach(() => {
    encoder = new AmfEncoder();
  });

  describe("writeAmfNumber", () => {
    it("应正确编码整数", () => {
      encoder.writeAmfNumber(419);
      expect(toHexString(encoder.getBytes())).toBe(
        "0".concat(AmfType.NUMBER.toString(16).concat("407A300000000000"))
      );
    });

    it("应正确编码小数", () => {
      encoder.writeAmfNumber(111.2);
      expect(toHexString(encoder.getBytes())).toBe("00405BCCCCCCCCCCCD");
    });

    it("应正确编码负小数", () => {
      encoder.writeAmfNumber(-16.6);
      expect(toHexString(encoder.getBytes())).toBe("00C03099999999999A");
    });

    it("应正确编码0", () => {
      encoder.writeAmfNumber(0);
      expect(toHexString(encoder.getBytes())).toBe("000000000000000000");
    });

    it("应正确编码最大安全整数", () => {
      encoder.writeAmfNumber(Number.MAX_SAFE_INTEGER);
      expect(toHexString(encoder.getBytes())).toBe("0043DFFFFFFFFFFFFF");
    });

    it("应正确编码最小安全整数", () => {
      encoder.writeAmfNumber(Number.MIN_SAFE_INTEGER);
      expect(toHexString(encoder.getBytes())).toBe("00C3DFFFFFFFFFFFFF");
    });
  });

  describe("writeAmfBoolean", () => {
    it("应正确编码 true", () => {
      encoder.writeAmfBoolean(true);
      expect(toHexString(encoder.getBytes())).toBe("0101");
    });

    it("应正确编码 false", () => {
      encoder.writeAmfBoolean(false);
      expect(toHexString(encoder.getBytes())).toBe("0100");
    });
  });

  describe("writeAmfString", () => {
    it("应正确编码空字符串", () => {
      encoder.writeAmfString("");
      expect(toHexString(encoder.getBytes())).toBe("0200");
    });

    it("应正确编码普通字符串", () => {
      encoder.writeAmfString("hello");
      expect(toHexString(encoder.getBytes())).toBe("020A68656C6C6F");
    });

    it("应正确编码长字符串", () => {
      const longStr = "a".repeat(65536);
      encoder.writeAmfString(longStr);
      expect(toHexString(encoder.getBytes()).length).toBe(131078);
    });
  });

  describe("writeAmfObject", () => {
    it("应正确编码空对象", () => {
      encoder.writeAmfObject({});
      expect(toHexString(encoder.getBytes())).toBe("030009");
    });

    it("应正确编码简单对象", () => {
      encoder.writeAmfObject({ key: "value" });
      expect(toHexString(encoder.getBytes())).toBe(
        "03000B6B6579020A76616C75650009"
      );
    });
  });

  describe("类型检查", () => {
    it("应拒绝非数字类型", () => {
      expect(() => encoder.writeAmfNumber("123" as any)).toThrow();
    });

    it("应拒绝非布尔类型", () => {
      expect(() => encoder.writeAmfBoolean("true" as any)).toThrow();
    });

    it("应拒绝非字符串类型", () => {
      expect(() => encoder.writeAmfString(123 as any)).toThrow();
    });

    it("应拒绝非对象类型", () => {
      expect(() => encoder.writeAmfObject("not an object" as any)).toThrow();
    });
  });
});
