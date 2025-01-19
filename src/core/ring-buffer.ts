export class RingBuffer<T> {
  private buffer: (T | undefined)[];
  private head: number = 0; // 写入位置
  private tail: number = 0; // 读取位置
  private size: number = 0; // 当前存储的元素数量

  constructor(private capacity: number) {
    this.buffer = new Array(capacity);
  }

  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;

    if (this.size < this.capacity) {
      this.size++;
    } else {
      // 缓冲区已满,移动tail
      this.tail = (this.tail + 1) % this.capacity;
    }
  }

  shift(): T | undefined {
    if (this.size === 0) {
      return undefined;
    }

    const item = this.buffer[this.tail];
    this.buffer[this.tail] = undefined;
    this.tail = (this.tail + 1) % this.capacity;
    this.size--;

    return item;
  }

  peek(): T | undefined {
    if (this.size === 0) {
      return undefined;
    }
    return this.buffer[this.tail];
  }

  get length(): number {
    return this.size;
  }

  clear(): void {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }
}
