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

// const ws = new WebSocket("ws://49.232.183.67:9998/live/first");
const writable = new WritableStream({
  write: (chunk) => {
    recordingChunks.push(chunk);
    // ws.send(chunk);
  },
});

async function startRecording() {
  const stream = await getDisplayMedia();

  const videoTrack = stream.getVideoTracks()[0];
  const audioTrack = stream.getAudioTracks()[0];

  const flvMuxer = new FlvMuxer(writable);

  await flvMuxer.configure({
    video: {
      track: videoTrack,
      config: {
        codec: "avc1.640034",
        width: 1920,
        height: 1080,
      },
    },
    audio: {
      track: audioTrack,
      config: {
        codec: "mp4a.40.5",
        sampleRate: 48000,
        numberOfChannels: 1,
        bitrate: 128000,
      },
    },
  });

  flvMuxer.start();
}

async function stopRecording() {
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
