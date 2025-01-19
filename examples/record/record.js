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
    audio: true,
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

const flvMuxer = new MyBundle.FlvStreamer(writable, {
  video: 1920,
  videocodecid: 7,
  framerate: 30,
  audio: true,
  audiocodecid: 10,
});

const videoEncoder = new VideoEncoder({
  output: (chunk, metadata) => {
    flvMuxer.handleVideoChunk(chunk, metadata);
  },
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
  output: (chunk, metadata) => {
    flvMuxer.handleAudioChunk(chunk, metadata);
  },
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

async function startRecording() {
  const stream = await getDisplayMedia();
  const flvWorker = loadWorker();
  const videoTrack = stream.getVideoTracks()[0];
  const audioTrack = stream.getAudioTracks()[0];

  // 创建两个独立的处理函数
  async function processVideo() {
    const videoReadableStream = new MediaStreamTrackProcessor({
      track: videoTrack,
    }).readable;

    for await (const chunk of videoReadableStream) {
      videoEncoder.encode(chunk);
      chunk.close();
    }
  }

  async function processAudio() {
    const audioReadableStream = new MediaStreamTrackProcessor({
      track: audioTrack,
    }).readable;

    for await (const chunk of audioReadableStream) {
      audioEncoder.encode(chunk);
      chunk.close();
    }
  }

  // 并行处理视频和音频
  Promise.all([processVideo(), processAudio()]).catch((error) => {
    console.error("Stream processing error:", error);
  });

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

    if (audioEncoder) {
      await audioEncoder.flush();
      audioEncoder.close();
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
