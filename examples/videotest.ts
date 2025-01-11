import { FlvStreamer } from "../core/flv-streamer";

const socket = new WebSocket(`ws://127.0.0.1:3000/livestream/push`);

const startButton = document.querySelector("#startButton");
startButton?.addEventListener("click", () => {
  testVideo();
});

export async function testVideo() {
  const writableStream = new WritableStream({
    write(chunk) {
      console.log(chunk);
      socket.send(chunk.buffer);
    },
  });
  const flvStreamer = new FlvStreamer(writableStream);

  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      frameRate: {
        ideal: 60,
        max: 60,
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
      codec: "avc1.640032",
      width: 2560,
      height: 1440,
      bitrate: 2_000_000,
      framerate: 60,
    });

    const videoTrack = stream.getVideoTracks()[0];

    const videoProcessor = new MediaStreamTrackProcessor({ track: videoTrack });

    const videoTrackReader = videoProcessor.readable.getReader();

    let timer = 0;

    while (true) {
      const { value: frame, done } = await videoTrackReader.read();
      if (done) break;
      if (performance.now() - timer > 1000) {
        timer = performance.now();
        videoEncoder.encode(frame, { keyFrame: true });
      } else {
        {
          videoEncoder.encode(frame, { keyFrame: false });
        }
      }
      frame.close();
    }
  }
}
