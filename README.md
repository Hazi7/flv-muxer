# FlvMuxer

English | [Chinese](./README_CN.md)

`flv-muxer.js` is a pure TypeScript-written FLV muxer used to implement native FLV streaming/recording on the Web platform.

## Use Cases

- Use `WebTransport` or `WebSocket` to transmit FLV streams to a streaming server, enabling Web live streaming.
- Support recording in FLV format where the `MediaRecorder` API does not support it.

## Usage

### Installation

Install from NPM by running the following command:

```shell
  npm install flv-muxer
```

Download from a CDN link:

```html
  <script src=""></script>
```

### API

#### `FlvStreamer`

```ts
class FlvStreamer {
    /**
     * Creates an instance of FlvStreamer.
     * @param writable - A writable stream used to write FLV data.
     * @param options - Configuration options for the FLV stream.
     */
    constructor(writable: WritableStream<Uint8Array>, options?: MuxerOptions);
    /**
     * Processes the incoming video chunk and writes it to the FLV stream.
     * @param chunk - The video chunk to be processed.
     */
    handleVideoChunk(chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata): Promise<void>;
    /**
     * Processes the incoming audio chunk and writes it to the FLV stream.
     * @param chunk - The audio chunk to be processed.
     * @param metadata - Optional metadata associated with the audio chunk.
     */
    handleAudioChunk(chunk: EncodedAudioChunk, metadata?: EncodedAudioChunkMetadata): Promise<void>;
    /**
     * Closes the FLV stream.
     */
    close(): Promise<void>;
}
```

### Example

```js
async function getDisplayMedia() {
  return navigator.mediaDevices.getUserMedia({
    video: {
      frameRate: {
        ideal: 30,
      },
      width: 1920,
      height: 1080,
    },
    audio: true,
  });
}

const writable = new WritableStream({
  write: (chunk) => {
    // Stream to the streaming server
    // e.g., ws.send(chunk);
  },
});

const flvMuxer = new MyBundle.FlvStreamer(writable, {
  video: 1920,
  videocodecid: 7,
  framerate: 30,
  audio: true,
  audiocodecid: 10,
  stereo: true,
});

function readAndEncode(reader, encoder) {
  reader.read().then(({ done, value }) => {
    if (done) return;

    encoder.encode(value);
    value.close();

    readAndEncode(reader, encoder);
  });
}

const videoEncoder = new VideoEncoder({
  output: (chunk, metadata) => {
    flvMuxer.handleVideoChunk(chunk, metadata);
  },
  error: (error) => {
    // Handle encoding errors
    console.error("VideoEncoder error:", error);
  },
});

videoEncoder.configure({
  codec: "avc1.640034",
  width: 1920,
  height: 1080,
});

const audioEncoder = new AudioEncoder({
  output: (chunk, metadata) => {
    flvMuxer.handleAudioChunk(chunk, metadata);
  },
  error: (error) => {
    // Handle encoding errors
    console.error("AudioEncoder error:", error);
  },
});

audioEncoder.configure({
  codec: "mp4a.40.5",
  sampleRate: 48000,
  numberOfChannels: 1,
  bitrate: 128000,
});

async function startRecording() {
  const stream = await getDisplayMedia();

  const videoTrack = stream.getVideoTracks()[0];
  const videoReader = await new MediaStreamTrackProcessor({
    track: videoTrack,
  }).readable.getReader();

  readAndEncode(videoReader, videoEncoder);

  const audioTrack = stream.getAudioTracks()[0];
  const audioReader = await new MediaStreamTrackProcessor({
    track: audioTrack,
  }).readable.getReader();

  readAndEncode(audioReader, audioEncoder);
}
```
