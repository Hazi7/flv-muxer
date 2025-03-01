# FlvMuxer

English | [中文](./README_CN.md)

`flv-muxer.js` is a pure TypeScript `FLV` multiplexer that enables native `FLV` streaming and recording on the Web platform.

## Use Cases  

- Transmit `FLV` streams to a media server via `WebTransport` or `WebSocket` for web-based live streaming  
- Overcome the limitation of the `MediaRecorder` API, which does not support `FLV` format recording  

## Installation  

### NPM  

```sh
npm install flv-muxer
```

### CDN  

```html
<script src="https://cdn.jsdelivr.net/npm/flv-muxer@latest/dist/flv-muxer.iife.js"></script>
```

## API  

### `FlvMuxer`  

`FlvMuxer` is a class for creating an `FLV` multiplexer instance, providing stream processing capabilities.

#### Constructor  

```ts
const muxer = new FlvMuxer(
  writable: WritableStream,
  options: {
    mode: "record" | "live";
    chunked: boolean; // Whether to transmit in chunks
  }
);
```

#### Methods  

- **`configureAudio()`**: Configures the audio encoder  

  ```ts
  flvMuxer.configureAudio({
    encoderConfig: AudioEncoderConfig;  
  });

  // Example
  flvMuxer.configureAudio({
    encoderConfig: {
      codec: "mp4a.40.29",
      sampleRate: 44100,
      numberOfChannels: 2,
    },
  });
  ```

  Audio encoder configuration: [AudioEncoderConfig](https://developer.mozilla.org/en-US/docs/Web/API/AudioEncoder/configure#config).  

- **`configureVideo()`**: Configures the video encoder  

  ```ts
  muxer.configureVideo({
    encoderConfig: VideoEncoderConfig;  
    keyframeInterval: number, // Keyframe interval in frames
  });

  // Example
  flvMuxer.configureVideo({
    encoderConfig: {
      codec: "avc1.640034",
      width: 2560,
      height: 1440,
      framerate: 30,
    },
    keyframeInterval: 90,
  });
  ```

  video encoder configuration: [VideoEncoderConfig](https://developer.mozilla.org/en-US/docs/Web/API/VideoEncoder/configure#config).  

- **`start()`**: Starts the multiplexer to receive and process data  
- **`pause()`**: Pauses the multiplexer, temporarily stopping data processing  
- **`resume()`**: Resumes the multiplexer, continuing data processing  
- **`stop()`**: Stops the multiplexer, terminating data processing  

#### Properties  

- **`state`**: Returns the current state of the multiplexer. Possible values are `"recording"`, `"paused"`, or `"inactive"`.
