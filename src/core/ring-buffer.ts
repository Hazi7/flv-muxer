class RingBuffer<T> {
    private size: number;
    private buffer: Array<T | null>;
    private start: number;
    private end: number;
    private length: number;

    constructor(size: number) {
        this.size = size;
        this.buffer = new Array<T | null>(size).fill(null);
        this.start = 0;
        this.end = 0;
        this.length = 0;
    }

    isFull(): boolean {
        return this.length === this.size;
    }

    isEmpty(): boolean {
        return this.length === 0;
    }

    push(data: T): void {
        if (this.isFull()) {
            console.warn("Buffer is full, overwriting oldest data.");
            this.start = (this.start + 1) % this.size;
        } else {
            this.length++;
        }
        this.buffer[this.end] = data;
        this.end = (this.end + 1) % this.size;
    }

    pop(): T {
        if (this.isEmpty()) {
            throw new Error("Buffer is empty");
        }
        const data = this.buffer[this.start];
        this.buffer[this.start] = null; // Clear the slot
        this.start = (this.start + 1) % this.size;
        this.length--;
        return data as T;
    }
}
