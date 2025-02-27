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

async function startRecording() {
  const myWorker = new Worker("./worker.js");

  myWorker.onmessage = (chunk) => {
    recordingChunks.push(chunk.data);
  };

  const stream = await getDisplayMedia();

  const videoTrack = stream.getVideoTracks()[0];
  const audioTrack = stream.getAudioTracks()[0];

  if (videoTrack) {
    const videoTrackProcessor = new MediaStreamTrackProcessor({
      track: videoTrack,
    });

    videoTrackProcessor.readable.pipeTo(
      new WritableStream({
        write: (chunk) => {
          myWorker.postMessage(
            {
              type: "video",
              chunk,
            },
            [chunk]
          );
        },
      })
    );
  }

  if (audioTrack) {
    const audioTrackProcessor = new MediaStreamTrackProcessor({
      track: audioTrack,
    });

    audioTrackProcessor.readable.pipeTo(
      new WritableStream({
        write: (chunk) => {
          myWorker.postMessage(
            {
              type: "audio",
              chunk,
            },
            [chunk]
          );
        },
      })
    );
  }
}

function pauseRecording() {}

function resumeRecording() {}

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
