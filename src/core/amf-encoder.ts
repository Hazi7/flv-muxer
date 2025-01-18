import { AmfType } from "../constants/amf-type";
import { BinaryWriter } from "../utils/binary-writer";

export class AmfEncoder extends BinaryWriter {
  /**
   * 将 Date 对象以 AMF 格式写入二进制流。
   * @param date - 要写入的 Date 对象。
   */
  writeScriptDataDate(date: Date) {
    this.writeFloat64(date.getTime());
    this.writeUint16(0); // 时区，默认为0
  }

  /**
   * 将 ECMA 数组以 AMF 格式写入二进制流。
   * @param obj - 表示 ECMA 数组的对象。
   */
  writeScriptDataEcmaArray(obj: Record<string, any>) {
    this.writeUint32(Object.keys(obj).length); // 数组长度

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
    this.writeUint32(strBytes.length);
    this.writeBytes(strBytes);
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
    this.writeUint8(0x00);
    this.writeUint8(0x00);
    this.writeUint8(0x09);
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
    this.writeUint32(arr.length);
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

    this.writeUint16(strBytes.length);
    this.writeBytes(strBytes);
  }

  /**
   * 将值以 AMF 格式写入二进制流。
   * @param value - 要写入的值。
   */
  writeScriptDataValue(value: any) {
    if (value === null) {
      this.writeUint8(AmfType.NULL);
    } else if (value === undefined) {
      this.writeUint8(AmfType.UNDEFINED);
    } else if (typeof value === "boolean") {
      this.writeUint8(AmfType.BOOLEAN);
      this.writeUint8(value ? 0x01 : 0x00);
    } else if (typeof value === "number") {
      this.writeUint8(AmfType.NUMBER);
      this.writeFloat64(value);
    } else if (typeof value === "string") {
      if (value.length > 65535) {
        this.writeUint8(AmfType.LONG_STRING);
        this.writeScriptDataLongString(value);
      } else {
        this.writeUint8(AmfType.STRING);
        this.writeScriptDataString(value);
      }
    } else if (value instanceof Date) {
      this.writeUint8(AmfType.DATE);
      this.writeScriptDataDate(value);
    } else if (Array.isArray(value)) {
      this.writeUint8(AmfType.STRICT_ARRAY);
      this.writeScriptDataStrictArray(value);
    } else if (typeof value === "object") {
      this.writeUint8(AmfType.ECMA_ARRAY);
      this.writeScriptDataEcmaArray(value);
    }
  }
}
