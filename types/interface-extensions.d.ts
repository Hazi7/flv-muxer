declare module '@/src/core/media-hub' {
  interface MediaHub {
    eventProxy: import('../core/event-bus').EventBus;
    registerEventProxy(): void;
  }
}

declare module '@/src/core/ring-buffer' {
  interface RingBuffer<T> {
    dynamicResize(newSize: number): void;
  }
}

declare module '@/src/core/encoder-track' {
  interface BaseEncoderTrack {
    loadProfile(profileName: string): void;
  }
}
