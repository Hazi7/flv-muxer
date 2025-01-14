import { AmfType } from "../constants/amf-type";
import { BinaryWriter } from "../utils/binary-writer";

/**
 * AMF (Action Message Format) 编码器，用于将 JavaScript 对象编码为 AMF 格式的二进制数据。
 * 继承自 BinaryWriter，提供了一系列方法来编码不同类型的数据。
 */
export class AmfEncoder extends BinaryWriter {
  /**
   * 编码一个数字为 AMF 格式。
   * @param num - 要编码的数字。
   */
  writeAmfNumber(num: number) {
    this.writeUint8(AmfType.NUMBER);

    this.writeFloat64(num);
  }

  /**
   * 编码一个布尔值为 AMF 格式。
   * @param bool - 要编码的布尔值。
   */
  writeAmfBoolean(bool: boolean) {
    this.writeUint8(AmfType.BOOLEAN);

    this.writeUint8(bool ? 0x01 : 0x00);
  }

  /**
   * 编码一个字符串为 AMF 格式。
   * @param str - 要编码的字符串。
   */
  writeAmfString(str: string) {
    this.writeUint8(AmfType.STRING);

    const encoder = new TextEncoder();
    const strBytes = encoder.encode(str);

    this.writeUint16(strBytes.length);
    this.writeBytes(strBytes);
  }

  /**
   * 编码一个对象为 AMF 格式。
   * @param objs - 要编码的对象。
   */
  writeAmfObject(objs: Record<string, any>) {
    this.writeUint8(AmfType.OBJECT);

    for (const [key, value] of Object.entries(objs)) {
      this.writeAmfString(key);
      this.writeAmfValue(value);
    }

    this.writeAmfObjectEndMarker();
  }

  /**
   * 编码一个 MovieClip 为 AMF 格式。预留，不支持。
   */
  writeAmfMovieClip() {
    this.writeUint8(AmfType.MOVIE_CLIP);
  }

  /**
   * 编码一个 null 值为 AMF 格式。
   */
  writeAmfNull() {
    this.writeUint8(AmfType.NULL); // NULL marker
  }

  /**
   * 编码一个 undefined 值为 AMF 格式。
   */
  writeAmfUndefined(): void {
    this.writeUint8(AmfType.UNDEFINED); // UNDEFINED marker
  }

  /**
   * 编码一个引用为 AMF 格式。
   * @param index - 引用的索引。
   */
  writeAmfReference(index: number) {
    this.writeUint8(AmfType.REFERENCE);

    this.writeUint16(index);
  }

  /**
   * 编码一个 ECMA 数组为 AMF 格式。
   * @param obj - 要编码的 ECMA 数组。
   */
  writeAmfECMAArray(obj: Record<string, any>): void {
    this.writeUint8(AmfType.ECMA_ARRAY);

    this.writeUint32(Object.keys(obj).length);

    for (const [key, value] of Object.entries(obj)) {
      this.writeAmfString(key);
      this.writeAmfValue(value);
    }

    this.writeAmfObjectEndMarker();
  }

  /**
   * 写入 AMF 对象结束标记。
   */
  writeAmfObjectEndMarker() {
    this.writeUint8(AmfType.OBJECT_END_MARKER);

    this.writeUint8(0x00);
    this.writeUint8(0x00);
    this.writeUint8(0x09);
  }

  /**
   * 编码一个严格数组为 AMF 格式。
   * @param arr - 要编码的数组。
   */
  writeAmfStrictArray(arr: any[]) {
    this.writeUint8(AmfType.STRICT_ARRAY);

    this.writeUint32(arr.length);
    for (const value of arr) {
      this.writeAmfValue(value);
    }
  }

  /**
   * 编码一个日期为 AMF 格式。
   * @param date - 要编码的日期。
   */
  writeAmfDate(date: Date) {
    this.writeUint8(AmfType.DATE); // DATE marker

    this.writeFloat64(date.getTime());
    this.writeInt16(0); // 时区，默认为 0
  }

  /**
   * 编码一个长字符串为 AMF 格式。
   * @param str - 要编码的长字符串。
   */
  writeAmfLongString(str: string) {
    this.writeUint8(AmfType.LONG_STRING);

    const strBytes = new TextEncoder().encode(str);

    this.writeUint32(strBytes.length);
    this.writeBytes(strBytes);
  }

  /**
   * 编码一个值为 AMF 格式。
   * @param value - 要编码的值。
   */
  writeAmfValue(value: any) {
    if (value === null) {
      this.writeAmfNull();
    } else if (value === undefined) {
      this.writeAmfUndefined();
    } else if (typeof value === "boolean") {
      this.writeAmfBoolean(value);
    } else if (typeof value === "number") {
      this.writeAmfNumber(value);
    } else if (typeof value === "string") {
      if (value.length > 65535) {
        this.writeAmfLongString(value);
      } else {
        this.writeAmfString(value);
      }
    } else if (value instanceof Date) {
      this.writeAmfDate(value);
    } else if (Array.isArray(value)) {
      this.writeAmfStrictArray(value);
    } else if (typeof value === "object") {
      this.writeAmfECMAArray(value);
    }
  }
}
