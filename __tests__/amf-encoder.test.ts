import { beforeEach, describe, expect, it } from "vitest";
import { AmfEncoder } from "../src/core/amf-encoder";
import { toHexString } from "./test-utils";

describe("AmfEncoder", () => {
  let encoder: AmfEncoder;

  beforeEach(() => {
    encoder = new AmfEncoder();
  });

  it.each([
    [419, "00407A300000000000"],
    [111.2, "00405BCCCCCCCCCCCD"],
    [-16.6, "00C03099999999999A"],
    [0, "000000000000000000"],
  ])("应正确编码数字 %p", (input, expected) => {
    encoder.writeAmfNumber(input);
    expect(toHexString(encoder.getBytes())).toBe(expected);
  });

  it.each([
    [true, "0101"],
    [false, "0100"],
  ])("应正确编码布尔值 %p", (input, expected) => {
    encoder.writeAmfBoolean(input);
    expect(toHexString(encoder.getBytes())).toBe(expected);
  });

  it.each([
    ["", "020000"],
    ["hello", "02000568656C6C6F"],
  ])("应正确编码字符串 %p", (input, expected) => {
    encoder.writeAmfString(input);
    expect(toHexString(encoder.getBytes())).toBe(expected);
  });

  it("应正确编码对象", () => {
    const metadata = {
      name: "Alice",
      age: 30,
      isStudent: false,
    };
    encoder.writeAmfObject(metadata);
    expect(toHexString(encoder.getBytes())).toBe(
      "030200046E616D65020005416C69636502000361676500403E000000000000020009697353747564656E74010009000009"
    );
  });

  it("应正确编码 MovieClip", () => {
    encoder.writeAmfMovieClip();
    expect(toHexString(encoder.getBytes())).toBe("04");
  });

  it("应正确编码 Null", () => {
    encoder.writeAmfNull();
    expect(toHexString(encoder.getBytes())).toBe("05");
  });

  it("应正确编码 Undefined", () => {
    encoder.writeAmfUndefined();
    expect(toHexString(encoder.getBytes())).toBe("06");
  });

  it("应正确编码 Reference", () => {
    encoder.writeAmfReference(2);
    expect(toHexString(encoder.getBytes())).toBe("070002");
  });

  it("应正确编码 ECMAArray", () => {
    const metadata = {
      name: "Alice",
      age: 30,
      isStudent: false,
    };

    encoder.writeAmfECMAArray(metadata);
    expect(toHexString(encoder.getBytes())).toBe(
      "08000000030200046E616D65020005416C69636502000361676500403E000000000000020009697353747564656E74010009000009"
    );
  });

  it("应正确编码 Object End Marker", () => {
    encoder.writeAmfObjectEndMarker();
    expect(toHexString(encoder.getBytes())).toBe("09000009");
  });

  it("应正确编码 Strict Array", () => {
    const metadata = ["Alice", 10, false];

    encoder.writeAmfStrictArray(metadata);
    expect(toHexString(encoder.getBytes())).toBe(
      "0A00000003020005416C6963650040240000000000000100"
    );
  });

  it("应正确编码日期", () => {
    const date = new Date("1995-12-17T03:24:00");
    encoder.writeAmfDate(date);
    expect(toHexString(encoder.getBytes())).toBe("0B4267D715119000000000");
  });

  it("应正确编码空字符串", () => {
    encoder.writeAmfLongString("");
    expect(toHexString(encoder.getBytes())).toBe("0C00000000");
  });

  it("应正确编码普通字符串", () => {
    encoder.writeAmfLongString("hello");
    expect(toHexString(encoder.getBytes())).toBe("0C0000000568656C6C6F");
  });

  it("应正确编码长字符串", () => {
    const longStr = "a".repeat(65536);
    encoder.writeAmfLongString(longStr);
    expect(toHexString(encoder.getBytes()).length).toBe(131082);
  });
});
