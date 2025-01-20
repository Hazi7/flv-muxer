import { AmfType } from "../constants/amf-type";
import { BinaryWriter } from "./binary-writer";

export class ScriptEncoder {
  writer: BinaryWriter;

  constructor() {
    this.writer = new BinaryWriter();
  }

  /**
   * 将 Date 对象以 AMF 格式写入二进制流。
   * @param date - 要写入的 Date 对象。
   */
  writeScriptDataDate(date: Date) {
    this.writer.writeFloat64(date.getTime());
    this.writer.writeUint16(0); // 时区，默认为0
  }

  /**
   * 将 ECMA 数组以 AMF 格式写入二进制流。
   * @param obj - 表示 ECMA 数组的对象。
   */
  writeScriptDataEcmaArray(obj: Record<string, any>) {
    this.writer.writeUint32(Object.keys(obj).length); // 数组长度

    for (const [key, value] of Object.entries(obj)) {
      this.writeScriptDataObjectProperty(key, value);
    }

    this.writeScriptDataObjectEnd();
  }

  /**
   * 将长字符串以 AMF 格式写入二进制流。
   * @param str - 要写入的字符串。
   */
  writeScriptDataLongString(str: string) {
    const strBytes = new TextEncoder().encode(str);
    this.writer.writeUint32(strBytes.length);
    this.writer.writeBytes(strBytes);
  }

  /**
   * 将对象以 AMF 格式写入二进制流。
   * @param objs - 要写入的对象。
   */
  writeScriptDataObject(objs: Record<string, any>) {
    for (const [key, value] of Object.entries(objs)) {
      this.writeScriptDataObjectProperty(key, value);
    }

    this.writeScriptDataObjectEnd();
  }

  /**
   * 将对象的结束标记以 AMF 格式写入二进制流。
   */
  writeScriptDataObjectEnd() {
    this.writer.writeUint8(0x00);
    this.writer.writeUint8(0x00);
    this.writer.writeUint8(0x09);
  }

  /**
   * 将对象的属性以 AMF 格式写入二进制流。
   * @param key - 属性的键。
   * @param value - 属性的值。
   */
  writeScriptDataObjectProperty(key: string, value: any) {
    this.writeScriptDataString(key);
    this.writeScriptDataValue(value);
  }

  /**
   * 将严格数组以 AMF 格式写入二进制流。
   * @param arr - 要写入的数组。
   */
  writeScriptDataStrictArray(arr: any[]) {
    this.writer.writeUint32(arr.length);
    for (const value of arr) {
      this.writeScriptDataValue(value);
    }
  }

  /**
   * 将字符串以 AMF 格式写入二进制流。
   * @param str - 要写入的字符串。
   */
  writeScriptDataString(str: string) {
    const encoder = new TextEncoder();
    const strBytes = encoder.encode(str);

    this.writer.writeUint16(strBytes.length);
    this.writer.writeBytes(strBytes);
  }

  /**
   * 将值以 AMF 格式写入二进制流。
   * @param value - 要写入的值。
   */
  writeScriptDataValue(value: any) {
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
      this.writeScriptDataEcmaArray(value);
    }
  }
}
