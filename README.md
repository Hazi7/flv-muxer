# FlvMuxer

English | [中文](./README_CN.md)

`flv-muxer.js` is a pure TypeScript-written FLV muxer used to implement native FLV streaming/recording on the Web platform.

## Use Cases

- Implement FLV stream transmission to a streaming server over `WebTransport` and `WebSocket` for Web live streaming.
- Support recording in FLV format where the `MediaRecorder` API does not support it.

## Usage

### Installation

Install from NPM by running the following command:

```shell
  npm install flv-muxer
```

Download from CDN link:

```html
  <script src="../../dist/flv-muxer.iife.js"></script>
```

### API

#### `FlvStreamer`

```ts
class FlvStreamer {
  constructor(writable: WritableStream<Uint8Array>, options?: MuxerOptions);

  /**
   * Process incoming video chunks and write them to the FLV stream.
   * @param chunk - The video chunk to process.
   */
  handleVideoChunk(chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata): Promise<void>;

  /**
   * Process incoming audio chunks and write them to the FLV stream.
   * @param chunk - The audio chunk to process.
   * @param metadata - Optional metadata associated with the audio chunk.
   */
  handleAudioChunk(chunk: EncodedAudioChunk, metadata?: EncodedAudioChunkMetadata): Promise<void>;

  /**
   * Calculate the timestamp for a video chunk.
   * @param timestamp - The original timestamp of the chunk.
   * @returns The adjusted timestamp.
   */
  private calculateTimestamp;

  /**
   * Close the FLV stream.
   */
  close(): Promise<void>;
}
```
