async function getDisplayMedia() {
  return navigator.mediaDevices.getDisplayMedia({
    video: {
      frameRate: {
        ideal: 30,
      },
    },
    audio: {
      numberOfChannels: 2,
      sampleRate: 44100,
    },
  });
}

let recordingChunks = [];
let writableController;

// const ws = new WebSocket("ws://localhost:9001/livestream/test");
const writable = new WritableStream({
  write: (chunk) => {
    recordingChunks.push(chunk);
    // ws.send(chunk);
  },
});

let flvMuxer;

async function startRecording() {
  const stream = await getDisplayMedia();

  const videoTrack = stream.getVideoTracks()[0];
  const audioTrack = stream.getAudioTracks()[0];

  flvMuxer = new FlvMuxer(writable);

  flvMuxer.configure({
    video: {
      track: videoTrack,
      config: {
        codec: "avc1.640034",
        width: 2560,
        height: 1440,
        framerate: 30,
      },
    },
    audio: {
      track: audioTrack,
      config: {
        codec: "mp4a.40.29",
        sampleRate: 44100,
        numberOfChannels: 2,
      },
    },
    mode: "record",
  });

  flvMuxer.start();
}

function pauseRecording() {
  flvMuxer.pause();
}

function resumeRecording() {
  flvMuxer.resume();
}

async function stopRecording() {
  flvMuxer.stop();
  try {
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
