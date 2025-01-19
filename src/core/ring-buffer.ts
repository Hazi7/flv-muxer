export class RingBuffer<T> {
  private buffer: (T | undefined)[];
  private head: number = 0; // 指向下一个写入的位置
  private tail: number = 0; // 指向下一个读取的位置
  private size: number = 0; // 当前缓冲区的大小（元素个数）

  constructor(private capacity: number) {
    if (capacity <= 0) {
      throw new Error("缓冲区容量不能小于 0");
    }

    this.buffer = new Array(capacity);
  }

  get length() {
    return this.size;
  }

  enqueue(item: T) {
    if (this.isFull()) {
      this.tail = (this.tail + 1) % this.capacity;
    } else {
      this.size++;
    }

    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
  }

  dequeue() {
    if (this.isEmpty()) {
      return undefined;
    }

    const item = this.buffer[this.tail];
    this.buffer[this.tail] = undefined;
    this.tail = (this.tail + 1) % this.capacity;
    this.size--;

    return item;
  }

  peek() {
    if (this.isEmpty()) {
      return undefined;
    }
    return this.buffer[this.tail];
  }

  clear(): void {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }

  isEmpty() {
    return this.size === 0;
  }

  isFull() {
    return this.size === this.capacity;
  }
}
