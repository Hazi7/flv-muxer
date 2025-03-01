// const ws = new WebSocket("ws://localhost:3000/livestream/push");

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
    self.postMessage(chunk.buffer, [chunk.buffer]);
    // ws.send(chunk);
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

// flvMuxer.configureAudio({
//   encoderConfig: {
//     codec: "mp4a.40.29",
//     sampleRate: 44100,
//     numberOfChannels: 2,
//   },
// });

self.onmessage = async (e) => {
  if (e.data.type === "DATA_VIDEO") {
    flvMuxer.addRawChunk("video", e.data.chunk);
  } else if (e.data.type == "DATA_AUDIO") {
    flvMuxer.addRawChunk("audio", e.data.chunk);
  } else if (e.data.type === "START") {
    flvMuxer.start();
  } else if (e.data.type === "PAUSE") {
    await flvMuxer.pause();
  } else if (e.data.type === "RESUME") {
    flvMuxer.resume();
  } else if (e.data.type === "STOP") {
    await flvMuxer.stop();
  }
};
