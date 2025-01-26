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
  <script src="https://cdn.jsdelivr.net/npm/flv-muxer@latest/dist/flv-muxer.iife.js"></script>
```
