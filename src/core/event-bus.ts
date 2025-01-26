type EventHandler = (...args: any[]) => void;

export class EventBus {
  static #instance: EventBus;
  #events: Map<string, EventHandler[]>;

  constructor() {
    this.#events = new Map();
  }

  static getInstance() {
    if (!this.#instance) {
      this.#instance = new EventBus();
    }

    return this.#instance;
  }

  // 订阅事件
  on(eventName: string, handler: EventHandler): void {
    if (!this.#events.has(eventName)) {
      this.#events.set(eventName, []);
    }
    this.#events.get(eventName)!.push(handler);
  }

  // 取消订阅
  off(eventName: string, handler: EventHandler): void {
    if (!this.#events.has(eventName)) return;

    const handlers = this.#events.get(eventName)!;
    const index = handlers.indexOf(handler);
    if (index !== -1) {
      handlers.splice(index, 1);
    }

    if (handlers.length === 0) {
      this.#events.delete(eventName);
    }
  }

  // 一次性订阅
  once(eventName: string, handler: EventHandler): void {
    const onceHandler = (...args: any[]) => {
      handler(...args);
      this.off(eventName, onceHandler);
    };
    this.on(eventName, onceHandler);
  }

  // 触发事件
  emit(eventName: string, ...args: any[]): void {
    if (!this.#events.has(eventName)) return;

    const handlers = this.#events.get(eventName)!;
    handlers.forEach((handler) => {
      try {
        handler(...args);
      } catch (error) {
        console.error(`Error in event handler for ${eventName}:`, error);
      }
    });
  }

  // 清除所有事件监听
  clear(): void {
    this.#events.clear();
  }
}
