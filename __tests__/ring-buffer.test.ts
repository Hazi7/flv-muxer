import { beforeEach, describe, expect, it } from "vitest";
import { RingBuffer } from "../src/utils/ring-buffer";

describe("RingBuffer", () => {
  let buffer: RingBuffer<Uint8Array>;

  beforeEach(() => {
    buffer = new RingBuffer<Uint8Array>(1024);
  });

  it("应正确处理 size", () => {
    buffer.push(new Uint8Array([1, 2]));
    expect(buffer.length).toBe(1);
    buffer.shift();
    expect(buffer.length).toBe(0);
    buffer.push(new Uint8Array([1, 2]));
    buffer.push(new Uint8Array([1, 2]));
    buffer.push(new Uint8Array([1, 2]));
    expect(buffer.length).toBe(3);
  });
});
