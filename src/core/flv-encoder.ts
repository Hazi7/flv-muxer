import {
  AACPacketType,
  SoundFormat,
  SoundRate,
  SoundSize,
  SoundType,
} from "../constants/audio-type";
import { TagType } from "../constants/tag-type";
import { AvcPacketType, CodeId, FrameType } from "../constants/video-type";
import { ScriptEncoder } from "./script-encoder";

type AudioTagParams<T extends keyof typeof SoundFormat> = {
  soundFormat: T;
  soundRate: keyof typeof SoundRate;
  soundSize: keyof typeof SoundSize;
  soundType: keyof typeof SoundType;
  timestamp: number;
} & (T extends "AAC"
  ? {
      audioData: Uint8Array;
      aacPacketType: keyof typeof AACPacketType;
    }
  : {
      audioData?: never;
    });

export class FlvEncoder extends ScriptEncoder {
  constructor() {
    super();
  }

  encodeFlvHeader(
    hasVideo: boolean = true,
    hasAudio: boolean = true
  ): Uint8Array {
    // 重置写入器
    this.writer.reset();

    // FLV 签名，分别为 "F"、"L"、"V" 的 ASCII 值
    this.writer.writeString("FLV");

    // 设置 FLV 文件版本为 1
    this.writer.writeUint8(1);

    // 流标志位 (5位保留 + 1位音频 + 1位保留 + 1位视频)
    const flag = (hasAudio ? 0x04 : 0) | (hasVideo ? 0x01 : 0);
    this.writer.writeUint8(flag);

    // 数据部分长度，这里固定为 9 字节
    this.writer.writeUint32(9);

    // 结束标志前4个字节是前一个 Tag 的大小
    this.writer.writeUint32(0);

    return this.writer.getBytes();
  }

  encodeFlvTag(
    type: keyof typeof TagType,
    header: Uint8Array,
    timestamp: number,
    data: Uint8Array
  ): Uint8Array {
    const dataSize = header.byteLength + data.byteLength;

    this.writer.reset();

    this.writer.writeUint8(TagType[type]);

    // 设置 DataSize(tag大小 - 11)
    this.writer.writeUint24(dataSize);

    // 设置时间戳
    this.writer.writeUint24(timestamp & 0xffffff);
    this.writer.writeUint8((timestamp >> 24) & 0xff); // 拓展位

    // 设置 StreamID，总是0
    this.writer.writeUint24(0);

    // 写入标签头部
    this.writer.writeBytes(header);

    // 写入标签数据
    this.writer.writeBytes(data);

    // 写入前一个标签大小(4字节)
    // 标签大小 = 标签头(11) + 数据大小(dataSize)
    this.writer.writeUint32(11 + dataSize);

    return this.writer.getBytes();
  }

  encodeScriptDataTag(metadata: Record<string, unknown>): Uint8Array {
    this.writer.reset();

    this.writeScriptDataValue("onMetaData");
    this.writeScriptDataValue(metadata);

    // 创建 ScriptTag
    const scriptTag = this.encodeFlvTag(
      "SCRIPT",
      new Uint8Array(0),
      0,
      this.writer.getBytes()
    );

    return scriptTag;
  }

  encodeAudioTag<T extends keyof typeof SoundFormat>(
    params: AudioTagParams<T>
  ): Uint8Array | undefined {
    const {
      soundFormat,
      soundRate,
      soundSize,
      soundType,
      timestamp,
      audioData,
    } = params;

    // 音频格式（4位） | 采样率（2位） | 音频样本大小（1位） | 音频类型（1位）
    const firstByte =
      (SoundFormat[soundFormat] << 4) |
      (SoundRate[soundRate] << 2) |
      (SoundSize[soundSize] << 1) |
      SoundType[soundType];

    if (soundFormat === "AAC" && audioData) {
      const header = new Uint8Array([
        firstByte,
        AACPacketType[params.aacPacketType],
      ]);
      return this.encodeFlvTag("AUDIO", header, timestamp, audioData);
    }
  }

  encodeVideoTag(
    frameType: keyof typeof FrameType,
    codecId: keyof typeof CodeId,
    avcPacketType: keyof typeof AvcPacketType,
    compositionTime: number,
    timestamp: number,
    videoBody: Uint8Array
  ): Uint8Array {
    const header = new Uint8Array(5);

    header[0] = (FrameType[frameType] << 4) | CodeId[codecId];

    header[1] = AvcPacketType[avcPacketType];

    header[2] = (compositionTime >> 16) & 0xff;
    header[3] = (compositionTime >> 8) & 0xff;
    header[4] = compositionTime & 0xff;

    return this.encodeFlvTag("VIDEO", header, timestamp, videoBody);
  }
}
