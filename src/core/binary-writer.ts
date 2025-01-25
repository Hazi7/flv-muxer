/**
 * 默认缓冲区大小
 */
const DEFAULT_BUFFER = 1024;

/**
 * 最小增长量
 */
const MIN_GROWTH = 512;

/**
 * 二进制写入器类，用于将各种数据类型写入二进制缓冲区
 */
export class BinaryWriter {
  /**
   * 当前写入位置
   */
  #position: number = 0;

  /**
   * 用于存储数据的二进制数组
   */
  #buffer: Uint8Array;

  /**
   * 用于操作二进制数组的 DataView
   */
  #view: DataView;

  /**
   * 是否使用小端字节序
   */
  #littleEndian: boolean;

  /**
   * 构造函数，初始化二进制写入器
   * @param littleEndian - 是否使用小端字节序，默认为 false
   */
  constructor(littleEndian: boolean = false) {
    this.#buffer = new Uint8Array(DEFAULT_BUFFER);
    this.#view = new DataView(this.#buffer.buffer);
    this.#littleEndian = littleEndian;
  }

  /**
   * 写入一个 8 位无符号整数
   * @param value - 要写入的值
   */
  writeUint8(value: number) {
    this.ensureAvailable(1);
    this.#buffer[this.#position++] = value;
  }

  /**
   * 写入一个 16 位无符号整数
   * @param value - 要写入的值
   */
  writeUint16(value: number) {
    this.ensureAvailable(2);
    this.#view.setUint16(this.#position, value, this.#littleEndian);
    this.#position += 2;
  }

  /**
   * 写入一个 24 位无符号整数
   * @param value - 要写入的值
   */
  writeUint24(value: number) {
    this.ensureAvailable(3);
    if (this.#littleEndian) {
      this.#buffer[this.#position++] = value & 0xff;
      this.#buffer[this.#position++] = (value >> 8) & 0xff;
      this.#buffer[this.#position++] = (value >> 16) & 0xff;
    } else {
      this.#buffer[this.#position++] = (value >> 16) & 0xff;
      this.#buffer[this.#position++] = (value >> 8) & 0xff;
      this.#buffer[this.#position++] = value & 0xff;
    }
  }

  /**
   * 写入一个 32 位无符号整数
   * @param value - 要写入的值
   */
  writeUint32(value: number) {
    this.ensureAvailable(4);
    this.#view.setUint32(this.#position, value, this.#littleEndian);
    this.#position += 4;
  }

  /**
   * 写入一个 8 位有符号整数
   * @param value - 要写入的值
   */
  writeInt8(value: number): void {
    this.ensureAvailable(1);
    this.#view.setInt8(this.#position++, value);
  }

  /**
   * 写入一个 16 位有符号整数
   * @param value - 要写入的值
   */
  writeInt16(value: number): void {
    this.ensureAvailable(2);
    this.#view.setInt16(this.#position, value, this.#littleEndian);
    this.#position += 2;
  }

  /**
   * 写入一个 32 位有符号整数
   * @param value - 要写入的值
   */
  writeInt32(value: number): void {
    this.ensureAvailable(4);
    this.#view.setInt32(this.#position, value, this.#littleEndian);
    this.#position += 4;
  }

  /**
   * 写入一个 32 位浮点数
   * @param value - 要写入的值
   */
  writeFloat32(value: number): void {
    this.ensureAvailable(4);
    this.#view.setFloat32(this.#position, value, this.#littleEndian);
    this.#position += 4;
  }

  /**
   * 写入一个 64 位浮点数
   * @param value - 要写入的值
   */
  writeFloat64(value: number): void {
    this.ensureAvailable(8);
    this.#view.setFloat64(this.#position, value, this.#littleEndian);
    this.#position += 8;
  }

  /**
   * 写入一个字节数组
   * @param bytes - 要写入的字节数组
   */
  writeBytes(bytes: Uint8Array) {
    this.ensureAvailable(bytes.byteLength);
    this.#buffer.set(bytes, this.#position);
    this.#position += bytes.byteLength;
  }

  /**
   * 写入一个字符串
   * @param str - 要写入的字符串
   */
  writeString(str: string) {
    const encoder = new TextEncoder();
    const encodedStr = encoder.encode(str);

    this.ensureAvailable(encodedStr.byteLength);
    this.#buffer.set(encodedStr, this.#position);
    this.#position += encodedStr.byteLength;
  }

  /**
   * 获取当前缓冲区中已写入的数据
   * @returns 包含已写入数据的 Uint8Array
   */
  getBytes() {
    return this.#buffer.slice(0, this.#position);
  }

  /**
   * 获取当前写入位置
   * @returns 当前写入位置
   */
  getPosition() {
    return this.#position;
  }

  /**
   * 重置写入位置到缓冲区的起始位置
   */
  reset() {
    this.#position = 0;
  }

  /**
   * 移动写入位置到指定位置
   * @param position - 新的写入位置
   */
  seek(position: number) {
    if (position < 0 || position > this.#buffer.byteLength) {
      throw new Error("非法的位置");
    }
    this.#position = position;
  }

  /**
   * 确保缓冲区有足够的空间来写入指定字节数的数据
   * @param bytes - 需要写入的字节数
   */
  private ensureAvailable(bytes: number) {
    const requiredSize = bytes + this.#position;
    if (requiredSize <= this.#buffer.byteLength) {
      return;
    }

    // 计算新的缓冲区大小
    let newSize = Math.max(
      this.#buffer.byteLength * 2,
      requiredSize + MIN_GROWTH
    );

    // 创建新的缓冲区
    const newBuffer = new Uint8Array(newSize);
    newBuffer.set(this.#buffer);
    this.#buffer = newBuffer;
    this.#view = new DataView(this.#buffer.buffer);
  }
}
