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

const writable = new WritableStream({
  write: (chunk) => {
    recordingChunks.push(chunk);
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

  const videoReader = await new MediaStreamTrackProcessor({
    track: videoTrack,
  }).readable.getReader();

  const audioReader = await new MediaStreamTrackProcessor({
    track: audioTrack,
  }).readable.getReader();

  flvMuxer.start();
  encodeAudioMedia();
  encodeVideoMedia();

  const channel = new MessageChannel();

  flvWorker.postMessage({
    type: "START_RECORDING",
  });

  async function encodeVideoMedia() {
    videoReader.read().then(({ value }) => {
      videoEncoder.encode(value);
      value.close();
      requestAnimationFrame(async () => {
        encodeVideoMedia();
      });
    });
  }

  async function encodeAudioMedia() {
    audioReader.read().then(({ value }) => {
      audioEncoder.encode(value);
      value.close();
      requestAnimationFrame(async () => {
        encodeAudioMedia();
      });
    });
  }
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
