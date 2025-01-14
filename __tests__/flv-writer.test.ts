import { beforeEach, describe, it } from "vitest";
import { FlvWriter } from "../src/core/flv-writer";

describe("FlvWriter", () => {
  let writer: FlvWriter;

  beforeEach(() => {
    writer = new FlvWriter();
  });

  it("应正确编码 Flv 头", () => {});
});
