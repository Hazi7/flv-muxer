async function getDisplayMedia() {
  return navigator.mediaDevices.getUserMedia({
    video: {
      frameRate: {
        ideal: 30,
      },
      width: 1920,
      height: 1080,
    },
    audio: true,
  });
}

let recordingChunks = [];

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
  stereo: true,
});

function readAndEncode(reader, encoder) {
  reader.read().then(({ done, value }) => {
    if (done) return;

    encoder.encode(value);
    value.close();

    readAndEncode(reader, encoder);
  });
}

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
    console.log(chunk.timestamp);
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

  const videoTrack = stream.getVideoTracks()[0];
  const videoReader = await new MediaStreamTrackProcessor({
    track: videoTrack,
  }).readable.getReader();

  readAndEncode(videoReader, videoEncoder);

  const audioTrack = stream.getAudioTracks()[0];
  const audioReader = await new MediaStreamTrackProcessor({
    track: audioTrack,
  }).readable.getReader();

  readAndEncode(audioReader, audioEncoder);
}

async function stopRecording() {
  try {
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
