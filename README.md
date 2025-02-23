# FlvMuxer

English | [中文](./README_CN.md)

`flv-muxer.js` is a `flv` muxer written entirely in TypeScript, designed for native `flv` streaming/recording on the Web platform.

## Use Cases

- Use `WebTransport` or `WebSocket` to send `flv` streams to media servers for web live streaming.
- Supports recording `flv` format when the `MediaRecorder` API doesn't support it.

## Installation

To install via NPM, run the following command:

```shell
npm install flv-muxer
```

To download via CDN link:

```html
<script src="https://cdn.jsdelivr.net/npm/flv-muxer@latest/dist/flv-muxer.iife.js"></script>
```

## API

### `FlvMuxer`

`FlvMuxer` is a class used to create instances of the `flv` muxer. Below are its constructor and main methods:

#### Constructor

```ts
new FlvMuxer(options: MuxerOptions)
```

The parameter `options` is an object containing the following properties:

- `model`: Mode, which can be `"record"` (for recording) or `"live"` (for live streaming).
  
- `video`: Video-related configuration containing the following properties:
  - `track`: A `MediaStreamTrack` type video track.
  - `config`: A `VideoEncoderConfig` type video encoding configuration.

- `audio`: Audio-related configuration containing the following properties:
  - `track`: A `MediaStreamTrack` type audio track.
  - `config`: An `AudioEncoderConfig` type audio encoding configuration.

- `chunked`: Whether to output `flv` data in chunks.

#### Methods

- `start()`: Starts the muxer to begin receiving and processing data.
  
- `stop()`: Stops the muxer to stop receiving and processing data.

- `pause()`: Pauses the muxer, temporarily halting the reception and processing of data.

- `resume()`: Resumes the muxer, continuing to receive and process data.

### Example Code

Here is an example of how to use `FlvMuxer`:

```ts
const writable = new WritableStream({
  write: (chunk) => {
    // Use FLV stream
    // recordingChunks.push(chunk);
    // ws.send(chunk);
  },
});

flvMuxer = new FlvMuxer(writable);

await flvMuxer.configure({
  video: {
    track: videoTrack,
    config: {
      codec: "avc1.640034",
      width: 2560,
      height: 1440,
      framerate: 30,
      latencyMode: "realtime",
    },
  },
  audio: {
    track: audioTrack,
    config: {
      codec: "mp4a.40.29",
      sampleRate: 44100,
      numberOfChannels: 2,
      bitrate: 128000,
    },
  },
});

flvMuxer.start();
```
