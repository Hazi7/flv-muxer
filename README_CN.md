# FlvMuxer

[English](./README.md) | 中文

`flv-muxer.js` 是一个纯 TS 编写的 `flv` 复用器，用于在 Web 平台实现原生 `flv` 推流/录屏。

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
  <script src="https://cdn.jsdelivr.net/npm/flv-muxer@latest/dist/flv-muxer.iife.js"></script>
```

### API

#### `FlvMuxer`

`FlvMuxer` 是一个类，用于创建 `flv` 复用器实例。以下是其构造函数和主要方法：

- **构造函数**

  ```ts
  new FlvMuxer(options: MuxerOptions)
  ```

  参数 `options` 是一个对象，包含以下属性：

  - `model`: 模式，可以是 `"record"`（录制）或 `"live"`（直播）。
  - `video`: 视频相关配置，包含以下属性：
    - `track`: `MediaStreamTrack` 类型的视频轨道。
    - `config`: `VideoEncoderConfig` 类型的视频编码配置。
  - `audio`: 音频相关配置，包含以下属性：
    - `track`: `MediaStreamTrack` 类型的音频轨道。
    - `config`: `AudioEncoderConfig` 类型的音频编码配置。
  - `chunked`: 是否分块输出 `flv` 数据。

- **方法**

  - `start()`: 开始复用器，开始接收和处理数据。
  - `stop()`: 停止复用器，停止接收和处理数据。
  - `pause()`: 暂停复用器，暂停接收和处理数据。
  - `resume()`: 恢复复用器，继续接收和处理数据。

#### 示例代码

以下是一个使用 `FlvMuxer` 的示例代码：

```ts
  const writable = new WritableStream({
    write: (chunk) => {
      // 使用 FLV 流
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
