import { AmfType } from "../constants/amf-type";
import { BinaryWriter } from "./binary-writer";

export class ScriptEncoder {
  writer: BinaryWriter;

  constructor() {
    this.writer = new BinaryWriter();
  }

  writeScriptDataDate(date: Date): void {
    this.writer.writeFloat64(date.getTime());
    this.writer.writeUint16(0); // 时区，默认为0
  }

  writeScriptDataEcmaArray(obj: Record<string, unknown>): void {
    this.writer.writeUint32(Object.keys(obj).length); // 数组长度

    for (const [key, value] of Object.entries(obj)) {
      this.writeScriptDataObjectProperty(key, value);
    }

    this.writeScriptDataObjectEnd();
  }

  writeScriptDataLongString(str: string): void {
    const strBytes = new TextEncoder().encode(str);
    this.writer.writeUint32(strBytes.length);
    this.writer.writeBytes(strBytes);
  }

  writeScriptDataObject(objs: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(objs)) {
      this.writeScriptDataObjectProperty(key, value);
    }

    this.writeScriptDataObjectEnd();
  }

  writeScriptDataObjectEnd(): void {
    this.writer.writeUint8(0x00);
    this.writer.writeUint8(0x00);
    this.writer.writeUint8(0x09);
  }

  writeScriptDataObjectProperty(key: string, value: unknown): void {
    this.writeScriptDataString(key);
    this.writeScriptDataValue(value);
  }

  writeScriptDataStrictArray(arr: unknown[]): void {
    this.writer.writeUint32(arr.length);
    for (const value of arr) {
      this.writeScriptDataValue(value);
    }
  }

  writeScriptDataString(str: string): void {
    const encoder = new TextEncoder();
    const strBytes = encoder.encode(str);

    this.writer.writeUint16(strBytes.length);
    this.writer.writeBytes(strBytes);
  }

  writeScriptDataValue(value: unknown): void {
    if (value === null) {
      this.writer.writeUint8(AmfType.NULL);
    } else if (value === undefined) {
      this.writer.writeUint8(AmfType.UNDEFINED);
    } else if (typeof value === "boolean") {
      this.writer.writeUint8(AmfType.BOOLEAN);
      this.writer.writeUint8(value ? 0x01 : 0x00);
    } else if (typeof value === "number") {
      this.writer.writeUint8(AmfType.NUMBER);
      this.writer.writeFloat64(value);
    } else if (typeof value === "string") {
      if (value.length > 65535) {
        this.writer.writeUint8(AmfType.LONG_STRING);
        this.writeScriptDataLongString(value);
      } else {
        this.writer.writeUint8(AmfType.STRING);
        this.writeScriptDataString(value);
      }
    } else if (value instanceof Date) {
      this.writer.writeUint8(AmfType.DATE);
      this.writeScriptDataDate(value);
    } else if (Array.isArray(value)) {
      this.writer.writeUint8(AmfType.STRICT_ARRAY);
      this.writeScriptDataStrictArray(value);
    } else if (typeof value === "object") {
      this.writer.writeUint8(AmfType.ECMA_ARRAY);
      this.writeScriptDataEcmaArray(value as Record<string, unknown>);
    }
  }
}
