import { FlvStreamer } from "../core/flv-streamer";

const startButton = document.querySelector("#startButton");
startButton?.addEventListener("click", () => {
  testVideo();
});

async function initTransport(url: string) {
  const HASH = new Uint8Array([
    191, 133, 5, 2, 221, 239, 186, 120, 185, 64, 220, 189, 171, 219, 252, 32,
    129, 78, 247, 211, 132, 75, 157, 219, 171, 59, 85, 85, 182, 193, 67, 10,
  ]);

  const transport = new WebTransport(url, {
    serverCertificateHashes: [{ algorithm: "sha-256", value: HASH.buffer }],
  });

  await transport.ready;

  return transport;
}

async function closeTransport(transport: WebTransport) {
  // 响应连接的关闭
  try {
    await transport.closed;
    console.log(`到  的 HTTP/3 连接已正常关闭。`);
  } catch (error) {
    console.error(`到  的 HTTP/3 连接由于 ${error} 而被关闭。`);
  }
}

async function useTransport(url: string) {
  const transport = await initTransport(url);

  return transport;
}

const url = "https://localhost:4433/";

export async function testVideo() {
  const transport = await useTransport(url);

  const writableStream =
    (await transport.createUnidirectionalStream()) as unknown as WritableStream<Uint8Array>;

  const flvStreamer = new FlvStreamer(writableStream);

  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      frameRate: {
        ideal: 30,
        max: 40,
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
