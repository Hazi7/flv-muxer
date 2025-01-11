import { writeFile } from "fs/promises";
import { FlvStreamer, FlvStreamOptions } from "../src/core/flv-streamer";

async function main() {
  // 创建一个文件写入流
  const stream = new WritableStream({
    write(chunk) {
      return writeFile("output.flv", chunk, { flag: "a" });
    },
  });

  const options: FlvStreamOptions = {
    hasAudio: true,
    hasVideo: false,
  };

  // 创建FLV流处理器
  const flvStreamer = new FlvStreamer(stream, options);

  // 获取音频处理器
  const audioHandler = flvStreamer.getAudioChunkHandler();
  if (!audioHandler) {
    throw new Error("Audio handler not available");
  }

  // 启动FLV流
  await flvStreamer.start();

  // 创建音频编码器
  const audioEncoder = new AudioEncoder({
    output: audioHandler,
    error: (e) => console.error(e),
  });

  // 配置音频编码器
  const config: AudioEncoderConfig = {
    codec: "aac",
    sampleRate: 44100,
    numberOfChannels: 2,
    bitrate: 128000,
  };

  await audioEncoder.configure(config);

  // 创建一个示例音频帧（1秒的静音）
  const sampleRate = 44100;
  const numberOfChannels = 2;
  const numberOfFrames = sampleRate; // 1秒
  const audioData = new Float32Array(numberOfFrames * numberOfChannels);

  // 创建音频帧
  const frame = new AudioData({
    format: "f32",
    sampleRate,
    numberOfFrames,
    numberOfChannels,
    timestamp: 0,
    data: audioData,
  });

  // 编码音频帧
  audioEncoder.encode(frame);
  frame.close();

  // 等待编码完成
  await audioEncoder.flush();

  // 关闭编码器和流
  audioEncoder.close();
  await flvStreamer.close();
}

main().catch(console.error);
