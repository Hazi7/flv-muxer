# FlvMuxer

[English](./README.md) | 中文

`flv-muxer.js` 是一个纯 TypeScript 编写的 `FLV` 复用器，可在 Web 平台实现原生 `FLV` 推流和录屏。

## 用例

- 通过 `WebTransport`、`WebSocket` 传输 `FLV` 流到流媒体服务器，实现 Web 直播
- 解决 `MediaRecorder` API 不支持 `FLV` 格式录制的问题

## 安装

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

`FlvMuxer` 是一个用于创建 `FLV` 复用器实例的类，提供流处理功能。

#### 构造函数

```ts
const muxer = new FlvMuxer(
  writable: WritableStream,
  options: {
    mode: "record" | "live";
    chunked: boolean; // 是否分块传输
  }
)
```

#### 方法

- **`configureAudio()`**: 配置音频编码器

  ```ts
  flvMuxer.configureAudio({
    encoderConfig: AudioEncoderConfig;  
  });

  // 示例
  flvMuxer.configureAudio({
    encoderConfig: {
      codec: "mp4a.40.29",
      sampleRate: 44100,
      numberOfChannels: 2,
    },
  });
  ```

  音频编码器配置：[AudioEncoderConfig](https://developer.mozilla.org/en-US/docs/Web/API/AudioEncoder/configure#config)。

- **`configureVideo()`**: 配置视频编码器

  ```ts
  muxer.configureVideo({
    encoderConfig: VideoEncoderConfig;  
    keyframeInterval: number, // 关键帧间隔，单位为帧数
  });

  // 示例
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

  视频编码器配置: [VideoEncoderConfig](https://developer.mozilla.org/en-US/docs/Web/API/VideoEncoder/configure#config).  

- **`addRawChunk`**: 添加原始帧数据。

  ```ts
  flvMuxer.addRawChunk("video" ｜ "audio", chunk: VideoFrame | AudioData);

  // 示例
  flvMuxer.addRawChunk("video", chunk);
  ```

- **`start()`**: 开始复用器，接收并处理数据
- **`pause()`**: 暂停复用器，暂时停止数据处理
- **`resume()`**: 恢复复用器，继续处理数据
- **`stop()`**: 停止复用器，终止数据处理

#### 属性

- **`state`**: 返回复用器状态。值为 `"recording"`、`"paused"` 或 `"inactive"`。

