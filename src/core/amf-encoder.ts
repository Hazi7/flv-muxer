import { BinaryWriter } from "../utils/binary-writer";

export class AmfEncoder extends BinaryWriter {
  writeAmfNumber(num: number) {
    this.writeUint8(0x00);
    this.writeFloat64(num);
  }

  writeAmfBoolean(bool: boolean) {
    this.writeUint8(0x01);
    this.writeUint8(bool ? 0x01 : 0x00);
  }
  writeAmfString(str: string) {
    const encoder = new TextEncoder();
    const strBytes = encoder.encode(str);

    this.writeUint16(strBytes.length);
    this.writeBytes(strBytes);
  }

  writeAmfObject(objs: Record<string, any>) {
    this.writeUint8(0x03);
    for (const [key, value] of Object.entries(objs)) {
      this.writeAmfString(key);
      this.writeAmfValue(value);
    }

    this.writeAmfObjectEndMarker();
  }

  writeAmfNull() {
    this.writeUint8(0x05); // AMF_NULL marker
  }

  writeAmfUndefined(): void {
    this.writeUint8(0x06); // AMF_UNDEFINED marker
  }

  writeAmfReference(index: number) {
    this.writeUint8(0x07);
    this.writeUint16(index);
  }

  writeAmfECMAArray(obj: Record<string, any>): void {
    this.writeUint8(0x08); // AMF_ECMA_ARRAY marker
    this.writeUint32(Object.keys(obj).length); // 数组长度

    for (const [key, value] of Object.entries(obj)) {
      this.writeAmfString(key);
      this.writeAmfValue(value);
    }

    this.writeAmfObjectEndMarker();
  }

  writeAmfObjectEndMarker() {
    this.writeUint8(0x00);
    this.writeUint8(0x00);
    this.writeUint8(0x09);
  }

  writeAmfStrictArray(arr: any[]) {
    this.writeUint8(0x0a);
    this.writeUint32(arr.length);
    for (const value of arr) {
      this.writeAmfValue(value);
    }
  }

  writeAmfDate(date: Date) {
    this.writeUint8(0x0b); // AMF_DATE marker
    this.writeFloat64(date.getTime());
    this.writeUint16(0); // 时区，默认为0
  }

  writeAmfLongString(str: string) {
    const strBytes = new TextEncoder().encode(str);
    this.writeUint32(strBytes.length);
    this.writeBytes(strBytes);
  }

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
        this.writeUint8(0x0c); // AMF_LONG_STRING marker
        this.writeAmfLongString(value);
      } else {
        this.writeUint8(0x02); // AMF_STRING marker
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
