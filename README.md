# FlvMuxer

English | [中文](./README_CN.md)

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
  <script src="https://cdn.jsdelivr.net/npm/flv-muxer@latest/dist/flv-muxer.iife.js"></script>
```
