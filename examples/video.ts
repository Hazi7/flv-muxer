import { io } from "socket.io-client";
import { FlvStreamer } from "../core/flv-streamer";

const socket = io("http://localhost:82/live");

const startButton = document.querySelector("#startButton");
startButton?.addEventListener("click", () => {
  testVideo();
});

socket.emit("createRoom", {
  roomName: "test",
});

socket.emit("startStreaming", {
  roomId: "test",
});

export async function testVideo() {
  const writableStream = new WritableStream({
    write(chunk) {
      socket.emit("receiveMediaData", {
        roomId: "test",
        mediaData: chunk.buffer,
      });
    },
  });
  const flvStreamer = new FlvStreamer(writableStream);

  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      frameRate: {
        ideal: 30,
        max: 30,
      },
    },
    audio: false,
  });

  const videoChunkHandler = flvStreamer.getVideoChunkHandler();

  if (videoChunkHandler) {
    await flvStreamer.start();
    const videoEncoder = new VideoEncoder({
      output: videoChunkHandler,
      error: (e) => console.error("Video encoder error:", e),
    });

    videoEncoder.configure({
      codec: "avc1.42E01F",
      width: 1280,
      height: 720,
      bitrate: 1_000_000,
      framerate: 30,
    });

    const videoTrack = stream.getVideoTracks()[0];

    const videoProcessor = new MediaStreamTrackProcessor({ track: videoTrack });

    const videoTrackReader = videoProcessor.readable.getReader();

    while (true) {
      const { value: frame, done } = await videoTrackReader.read();
      if (done) break;
      videoEncoder.encode(frame);
      frame.close();
    }
  }
}
