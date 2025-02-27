// const ws = new WebSocket("ws://localhost:9001/livestream/test");

// ws.onopen = () => {
//   console.log("WebSocket connection established");
// };

// ws.onerror = (error) => {
//   console.error("WebSocket error:", error);
// };

// ws.onclose = () => {
//   console.log("WebSocket connection closed");
// };

const writable = new WritableStream({
  write: (chunk) => {
    console.log(chunk);
    self.postMessage(chunk.buffer, [chunk.buffer]);
  },
});

importScripts("../dist/flv-muxer.iife.js");

flvMuxer = new FlvMuxer(writable, {
  mode: "record",
  chunked: false,
});

flvMuxer.configureVideo({
  encoderConfig: {
    codec: "avc1.640034",
    width: 2560,
    height: 1440,
    framerate: 30,
  },
  keyframeInterval: 90,
});

flvMuxer.configureAudio({
  encoderConfig: {
    codec: "mp4a.40.29",
    sampleRate: 44100,
    numberOfChannels: 2,
  },
});

flvMuxer.start();

self.onmessage = (e) => {
  if (e.data.type === "video") {
    flvMuxer.addRawChunk("video", e.data.chunk);
  } else {
    flvMuxer.addRawChunk("audio", e.data.chunk);
  }
};
