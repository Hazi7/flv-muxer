const DEFAULT_BUFFER = 1024;
const MIN_GROWTH = 512; // 最小增长量

export class BinaryWriter {
  private position: number = 0;
  private buffer: Uint8Array;
  private view: DataView;
  private littleEndian: boolean;

  constructor(littleEndian: boolean = false) {
    this.buffer = new Uint8Array(DEFAULT_BUFFER);
    this.view = new DataView(this.buffer.buffer);
    this.littleEndian = littleEndian;
  }

  writeUint8(value: number) {
    this.ensureAvailable(1);
    this.buffer[this.position++] = value;
  }

  writeUint16(value: number) {
    this.ensureAvailable(2);
    this.view.setUint16(this.position, value, this.littleEndian);
    this.position += 2;
  }

  writeUint24(value: number) {
    this.ensureAvailable(3);
    if (this.littleEndian) {
      this.buffer[this.position++] = value & 0xff;
      this.buffer[this.position++] = (value >> 8) & 0xff;
      this.buffer[this.position++] = (value >> 16) & 0xff;
    } else {
      this.buffer[this.position++] = (value >> 16) & 0xff;
      this.buffer[this.position++] = (value >> 8) & 0xff;
      this.buffer[this.position++] = value & 0xff;
    }
  }

  writeUint32(value: number) {
    this.ensureAvailable(4);
    this.view.setUint32(this.position, value, this.littleEndian);
    this.position += 4;
  }

  writeInt8(value: number): void {
    this.ensureAvailable(1);
    this.view.setInt8(this.position++, value);
  }

  writeInt16(value: number): void {
    this.ensureAvailable(2);
    this.view.setInt16(this.position, value, this.littleEndian);
    this.position += 2;
  }

  writeInt32(value: number): void {
    this.ensureAvailable(4);
    this.view.setInt32(this.position, value, this.littleEndian);
    this.position += 4;
  }

  writeFloat32(value: number): void {
    this.ensureAvailable(4);
    this.view.setFloat32(this.position, value, this.littleEndian);
    this.position += 4;
  }

  writeFloat64(value: number): void {
    this.ensureAvailable(8);
    this.view.setFloat64(this.position, value, this.littleEndian);
    this.position += 8;
  }

  writeBytes(bytes: Uint8Array) {
    this.ensureAvailable(bytes.byteLength);
    this.buffer.set(bytes, this.position);
    this.position += bytes.byteLength;
  }

  writeString(str: string) {
    const encoder = new TextEncoder();
    const encodedStr = encoder.encode(str);

    this.ensureAvailable(encodedStr.byteLength);
    this.buffer.set(encodedStr, this.position);
    this.position += encodedStr.byteLength;
  }

  getBytes() {
    return this.buffer.slice(0, this.position);
  }

  getPosition() {
    return this.position;
  }

  reset() {
    this.position = 0;
  }

  seek(position: number) {
    if (position < 0 || position > this.buffer.byteLength) {
      throw new Error("非法的位置");
    }
    this.position = position;
  }

  private ensureAvailable(bytes: number) {
    const requiredSize = bytes + this.position;
    if (requiredSize <= this.buffer.byteLength) {
      return;
    }

    // 计算新的缓冲区大小
    let newSize = Math.max(
      this.buffer.byteLength * 2,
      requiredSize + MIN_GROWTH
    );

    // 创建新的缓冲区
    const newBuffer = new Uint8Array(newSize);
    newBuffer.set(this.buffer);
    this.buffer = newBuffer;
    this.view = new DataView(this.buffer.buffer);
  }
}