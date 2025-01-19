async function getDisplayMedia() {
  return navigator.mediaDevices.getUserMedia({
    video: {
      frameRate: {
        ideal: 30,
        max: 30,
      },
      width: 1920,
      height: 1080,
    },
    audio: {},
  });
}

let recordingChunks = [];

function loadWorker() {
  return new Worker("sw.js");
}

const ws = new WebSocket("ws://127.0.0.1:3000/livestream/push");
// const ws = new WebSocket("ws://49.232.183.67:9998/live/first");

const writable = new WritableStream({
  write: (chunk) => {
    // recordingChunks.push(chunk);
    ws.send(chunk);
  },
});

const flvMuxer = new MyBundle.FlvStreamer(writable);
const videoHandler = flvMuxer.getVideoChunkHandler();
const audioHandler = flvMuxer.getAudioChunkHandler();

const videoEncoder = new VideoEncoder({
  output: videoHandler,
  error: (error) => {
    // 处理编码过程中的错误
    console.error("VideoEncoder error:", error);
  },
});

videoEncoder.configure({
  codec: "avc1.640034",
  width: 1920,
  height: 1080,
});

const audioEncoder = new AudioEncoder({
  output: audioHandler,
  error: (error) => {
    // 处理编码过程中的错误
    console.error("VideoEncoder error:", error);
  },
});

audioEncoder.configure({
  codec: "mp4a.40.5",
  sampleRate: 48000,
  numberOfChannels: 1,
  bitrate: 128000,
});

async function startRecoding() {
  const stream = await getDisplayMedia();
  const flvWorker = loadWorker();

  const videoTrack = stream.getVideoTracks()[0];
  const audioTrack = stream.getAudioTracks()[0];

  flvMuxer.start();

  const videoReader = new MediaStreamTrackProcessor({
    track: videoTrack,
  }).readable;

  let lastTime = 0;

  videoReader
    .pipeThrough(
      new TransformStream({
        transform: (chunk) => {
          const newTime = performance.now();
          if (newTime - lastTime >= 2000) {
            videoEncoder.encode(chunk, { keyFrame: true });
            console.log(true);
            lastTime = performance.now();
          } else {
            videoEncoder.encode(chunk, { keyFrame: false });
          }
          chunk.close();
        },
      })
    )

    .pipeTo(
      new WritableStream({
        write: (chunk) => {
          console.log(chunk);
        },
      })
    );

  const audioReader = new MediaStreamTrackProcessor({
    track: audioTrack,
  }).readable;

  audioReader
    .pipeThrough(
      new TransformStream({
        transform: (chunk) => {
          audioEncoder.encode(chunk);
          chunk.close();
        },
      })
    )
    .pipeTo(
      new WritableStream({
        write: (chunk) => {
          console.log(chunk);
        },
      })
    );

  const channel = new MessageChannel();

  flvWorker.postMessage({
    type: "START_RECORDING",
  });
}

async function stopRecording() {
  try {
    // Stop all tracks

    // Close encoder
    if (videoEncoder) {
      await videoEncoder.flush();
      videoEncoder.close();
    }

    // Save the file
    const fileHandle = await window.showSaveFilePicker({
      suggestedName: "recording.flv",
      types: [
        {
          description: "FLV Video",
          accept: { "video/x-flv": [".flv"] },
        },
      ],
    });

    const writableFileStream = await fileHandle.createWritable();
    await writableFileStream.write(new Blob(recordingChunks));
    await writableFileStream.close();
  } catch (error) {
    console.error("Error stopping recording:", error);
  }
}
