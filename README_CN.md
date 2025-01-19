# FlvMuxer

[English](./README.md) | 中文

`flv-muxer.js` 是一个纯TS编写的 `flv` 复用器，用于在 Web 平台实现原生 `flv` 推流/录屏。

## 用例

- 使用`Webtransport`、`Websocket` 将 `flv`流传输到流媒体服务器，实现 Web 直播。
- 用于支持 `MediaRecorder` API 不支持 `flv` 格式录制。

## 使用

### 安装

从 NPM 安装，输入以下命令：

```shell
  npm install flv-muxer
```

从 CDN 链接下载：

```html
  <script src=""></script>
```

### API

#### `FlvStreamer`

```ts
class FlvStreamer {
    /**
     * 创建FlvStreamer的实例。
     * @param writable - 用于写入FLV数据的可写流。
     * @param options - FLV流的配置选项。
     */
    constructor(writable: WritableStream<Uint8Array>, options?: MuxerOptions);
    /**
     * 处理传入的视频块并将其写入FLV流。
     * @param chunk - 要处理的视频块。
     */
    handleVideoChunk(chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata): Promise<void>;
    /**
     * 处理传入的音频块并将其写入FLV流。
     * @param chunk - 要处理的音频块。
     * @param metadata - 与音频块关联的可选元数据。
     */
    handleAudioChunk(chunk: EncodedAudioChunk, metadata?: EncodedAudioChunkMetadata): Promise<void>;
    /**
     * 关闭FLV流。
     */
    close(): Promise<void>;
}
```

### 例子

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
    // 推流到流媒体服务器
    // 如 ws.send(chunk);
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
    // 处理编码过程中的错误
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
    // 处理编码过程中的错误
    console.error("VideoEncoder error:", error);
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
