import {
  SoundFormat,
  SoundRate,
  SoundSize,
  SoundType,
} from "../constants/audio-type";
import { TagType } from "../constants/tag-type";
import { AvcPacketType, CodeId, FrameType } from "../constants/video-type";
import { AmfEncoder } from "./amf-encoder";

export class FlvWriter extends AmfEncoder {
  constructor() {
    super();
  }

  createFlvHeader(hasVideo: boolean = true, hasAudio: boolean = true) {
    // 重置写入器
    this.reset();

    // FLV签名，分别为 "F"、"L"、"V" 的 ASCII 值
    this.writeString("FLV");

    // 设置 FLV 文件版本为 1
    this.writeUint8(1);

    // 流标志位 (5位保留 + 1位音频 + 1位保留 + 1位视频)
    const flag = (hasAudio ? 0x04 : 0) | (hasVideo ? 0x01 : 0);
    this.writeUint8(flag);

    // 数据部分长度，这里固定为 9 字节
    this.writeUint32(9);

    // 结束标志前4个字节是前一个 Tag 的大小
    this.writeUint32(0);

    return this.getBytes();
  }

  createFlvTag(
    type: keyof typeof TagType,
    header: Uint8Array,
    timestamp: number,
    data: Uint8Array
  ) {
    const dataSize = header.byteLength + data.byteLength;

    this.reset();

    this.writeUint8(TagType[type]);

    // 设置 DataSize(tag大小 - 11)
    this.writeUint24(dataSize);

    // 设置时间戳
    this.writeUint24(timestamp & 0xffffff);
    this.writeUint8((timestamp >> 24) & 0xff); // 拓展位

    // 设置 StreamID，总是0
    this.writeUint24(0);

    // 写入标签头部
    this.writeBytes(header);

    // 写入标签数据
    this.writeBytes(data);

    // 写入前一个标签大小(4字节)
    // 标签大小 = 标签头(11) + 数据大小(dataSize)
    this.writeUint32(11 + dataSize);

    return this.getBytes();
  }

  createVideoTag(
    frameType: keyof typeof FrameType,
    codecId: keyof typeof CodeId,
    avcPacketType: keyof typeof AvcPacketType,
    compositionTime: number,
    timestamp: number,
    videoBody: Uint8Array
  ) {
    const header = new Uint8Array(5);

    header[0] = (FrameType[frameType] << 4) | CodeId[codecId];

    header[1] = AvcPacketType[avcPacketType];

    header[2] = (compositionTime >> 16) & 0xff;
    header[3] = (compositionTime >> 8) & 0xff;
    header[4] = compositionTime & 0xff;

    return this.createFlvTag("Video", header, timestamp, videoBody);
  }

  createAudioTag(
    soundFormat: keyof typeof SoundFormat,
    soundRate: keyof typeof SoundRate,
    soundSize: keyof typeof SoundSize,
    soundType: keyof typeof SoundType,
    timestamp: number,
    audioData: Uint8Array
  ) {
    const header = new Uint8Array(1);

    // 音频格式（4位） | 采样率（2位） | 音频样本大小（1位） | 音频类型（1位）
    header[0] =
      (SoundFormat[soundFormat] << 4) |
      (SoundRate[soundRate] << 2) |
      (SoundSize[soundSize] << 1) |
      SoundType[soundType];

    return this.createFlvTag("Audio", header, timestamp, audioData);
  }

  createScriptDataTag(metadata: Record<string, any>) {
    this.reset();

    // 写入第一个 AMF 字符串
    this.writeAmfValue("onMetaData");

    // 写入第二个 ECMA Array
    this.writeAmfECMAArray(metadata);

    // 创建 ScriptTag
    const scriptTag = this.createFlvTag(
      "ScriptData",
      new Uint8Array(0),
      0,
      this.getBytes()
    );
    return scriptTag;
  }
}
