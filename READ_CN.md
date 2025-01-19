# FlvMuxer

English | [中文](./README_CN.md)

`flv-muxer.js` 是一个纯TS编写的 `flv` 复用器，用于在 Web 平台实现原生 `flv` 推流/录屏。

## 用例

- 在 `Webtransport`、`Websocket`上实现 `flv`流传输到流媒体服务器，实现 Web 直播。
- 用于支持 `MediaRecorder` API 不支持 `flv` 格式录制。

## 使用

### 安装

从 NPM 安装，输入以下命令：

```shell
npm install flv-muxer
```

从 CDN 链接下载：

```html
  <script src="../../dist/flv-muxer.iife.js"></script>
```

### API

#### `FlvStreamer`

```ts
class FlvStreamer {
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
   * 计算视频块的时间戳。
   * @param timestamp - 块的原始时间戳。
   * @returns 调整后的时间戳。
   */
  private calculateTimestamp;

  /**
   * 关闭FLV流。
   */
  close(): Promise<void>;
}
```