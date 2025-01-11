import { FlvStreamer } from "../../dist/flv-muxer";

let stream = null;
let videoEncoder = null;
let recordingChunks = [];

const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const statusDiv = document.getElementById("status");

async function startRecording() {
  try {
    recordingChunks = [];

    // Get screen stream
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        frameRate: {
          ideal: 30,
          max: 30,
        },
      },
      audio: false,
    });

    // Create a writable stream to collect data
    const writableStream = new WritableStream({
      write(chunk) {
        recordingChunks.push(chunk);
      },
    });

    const flvStreamer = new FlvStreamer(writableStream);
    const videoChunkHandler = flvStreamer.getVideoChunkHandler();

    if (videoChunkHandler) {
      await flvStreamer.start();
      videoEncoder = new VideoEncoder({
        output: videoChunkHandler,
        error: (e) => {
          console.error("Video encoder error:", e);
          statusDiv.textContent = "Error: " + e.message;
        },
      });

      videoEncoder.configure({
        codec: "avc1.42E01F",
        width: 1280,
        height: 720,
        bitrate: 2_000_000,
        framerate: 30,
      });

      const videoTrack = stream.getVideoTracks()[0];
      const videoProcessor = new MediaStreamTrackProcessor({
        track: videoTrack,
      });
      const videoTrackReader = videoProcessor.readable.getReader();

      startButton.disabled = true;
      stopButton.disabled = false;
      statusDiv.textContent = "Recording...";

      // Start processing frames
      while (true) {
        const { value: frame, done } = await videoTrackReader.read();
        if (done) break;

        videoEncoder.encode(frame);
        frame.close();
      }
    }
  } catch (error) {
    console.error("Error starting recording:", error);
    statusDiv.textContent = "Error: " + error.message;
    resetUI();
  }
}

async function stopRecording() {
  try {
    // Stop all tracks
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

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

    statusDiv.textContent = "Recording saved successfully!";
    resetUI();
  } catch (error) {
    console.error("Error stopping recording:", error);
    statusDiv.textContent = "Error: " + error.message;
  }
}

function resetUI() {
  startButton.disabled = false;
  stopButton.disabled = true;
  stream = null;
  videoEncoder = null;
  recordingChunks = [];
}

startButton.addEventListener("click", startRecording);
stopButton.addEventListener("click", stopRecording);
