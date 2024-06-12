import { AmfEnum } from "../constants/amf-type";
import { TagEnum } from "../constants/tag-type";

const metadata = {
    duration: 120.5,
    width: 640,
    height: 480,
    videodatarate: 500,
    framerate: 30,
    videocodecid: 7,
    audiodatarate: 128,
    audiocodecid: 10,
};


export class FlvMuxer {

    textEncoder: TextEncoder = new TextEncoder();

    constructor() {
    }

    createFlvFile() {
        const buffer = new Uint8Array([
            ...this.createFlvHeader(),
            ...this.createMetadataTag()
        ])

        const flvBlob = new Blob([buffer], { type: "video/x-flv" });

        const url = URL.createObjectURL(flvBlob);
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = "flvVideo.flv";
    
        // 将链接添加到 DOM 中并点击触发下载，然后移除
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url); // 释放 URL 对象
        }, 100);
    }

    createFlvHeader(version: number = 1, hasAudio: boolean = true, hasVideo: boolean = true) {

        const flagByte = hasAudio && hasVideo ? 0x05 : hasVideo ? 0x01 : hasAudio ? 0x04 : 0x00;

        const headerBuffer = new Uint8Array([
            0x46, 0x4C, 0x56, version, // 'FLV' + 版本号
            flagByte, // 音频视频标志
            0x00, 0x00, 0x00, 0x09,
            0x00, 0x00, 0x00, 0x00 // tag size
        ]); 

        return headerBuffer;
    }

    createMetadataTag() {
        const stringAmfBuffer = this.createStringAMF();
        const arrayAmfBuffer = this.createArrayAMF(metadata);

        const dataSize = stringAmfBuffer.byteLength + arrayAmfBuffer.byteLength;

        const preTagSize = dataSize + 11;

        const dataSizeByte3 = (preTagSize >> 24) & 0xff;
        const dataSizeByte2 = (preTagSize >> 16) & 0xff;
        const dataSizeByte1 = (preTagSize >> 8) & 0xff;
        const dataSizeByte0 = preTagSize & 0xff;

        const preTagBuffer = new Uint32Array([
            dataSizeByte3,
            dataSizeByte2,
            dataSizeByte1,
            dataSizeByte0
        ]);

        const metadataTagBuffer = new Uint8Array([
            ...this.createTagHeader("metadata", dataSize, 0, 0),
            ...stringAmfBuffer,
            ...arrayAmfBuffer,
            ...preTagBuffer
        ]);


        return metadataTagBuffer;
    }

    createStringAMF(text: string = 'onMetaData') {

        let headerSize = 3;
        let amfBuffer = new Uint8Array(headerSize + text.length);

        const view = new DataView(amfBuffer.buffer);

        view.setUint8(0, AmfEnum.string); // 设置AMF Type
        view.setUint16(1, text.length); // 设置 string 的长度

        this.textEncoder.encodeInto(text, amfBuffer.subarray(headerSize)); // 将字符串编码后插入到amfBuffer中

        return amfBuffer;
    }

    createArrayAMF(metadata: { [key: string]: any }) {
        let amfBuffer = new Uint8Array(2048);

        const length = Object.keys(metadata).length;

        let headerSize = 5;
        let offset = 0;
        const amfBufferView = new DataView(amfBuffer.buffer);

        amfBufferView.setUint8(0, AmfEnum.array);
        amfBufferView.setUint32(1, length);
        offset += 5;

        for (const key in metadata) {
            if (Object.prototype.hasOwnProperty.call(metadata, key)) {
                const element = metadata[key];
                amfBufferView.setUint16(offset, key.length);
                offset += 2;

                console.log(amfBuffer);

                this.textEncoder.encodeInto(key, amfBuffer.subarray(offset));
                offset += key.length;
                amfBufferView.setUint8(offset++, 0x00);
                amfBufferView.setFloat64(offset, element);
                offset += 8;
            }
        }

        return amfBuffer.subarray(0, offset);

    }

    createTagHeader(tagType: keyof typeof TagEnum, dataSize: number, timestamp: number, streamId: number = 0) {

        //     0x12,
        //     0x00, 0x00, 0x00, // body size，表示接下来的tag数据体的长度
        //     0x00, 0x00, 0x00, // timestamp
        //     0x00, // timestampExtended
        //     0x00, 0x00, 0x00, // stream id，用于标识不同的数据流

        const tagHeaderBuffer = new Uint8Array(11);
        
        let offset = 0;

        const tagHeaderBufferView = new DataView(tagHeaderBuffer.buffer);
        tagHeaderBufferView.setUint8(offset++, 0x12);

        const bodySizeBytes = [
            (dataSize >> 16) & 0xff,
            (dataSize >> 8) & 0xff,
            dataSize & 0xff,
        ];
        bodySizeBytes.forEach(byte => {
            tagHeaderBuffer[offset++] = byte;
        });

        const timestampBytes = [
            (timestamp >> 16) & 0xff,
            (timestamp >> 8) & 0xff,
            timestamp & 0xff,
        ];

        timestampBytes.forEach(byte => {
            tagHeaderBuffer[offset++] = byte;
        });
        tagHeaderBufferView.setUint8(offset++, (timestamp >> 24) & 0xff); 
        
        const streamIdBytes = [
            (streamId >> 16) & 0xff,
            (streamId >> 8) & 0xff,
            streamId & 0xff,
        ];

        streamIdBytes.forEach(byte => {
            tagHeaderBufferView.setUint8(offset++, byte);
        });

        return tagHeaderBuffer;
    }

    writeVideoTag(chunk: EncodedVideoChunk) {
        const isConfig = true;
        const isKeyFrame = chunk.type == 'key';
        const frameByte = isKeyFrame ? 0x10 : 0x20;
        const codecId = 0x07;

        const videoTagBuffer = new Uint8Array(chunk.byteLength + 5);
        let offset = 0;

        videoTagBuffer[offset++] = frameByte | codecId; // 标识为是否是关键帧及编码类型
        videoTagBuffer[offset++] = isConfig ? 0x00 : 0x01; // 0x00标识为AVC序列头, 0x01标识为AVC视频流中的基本数据单元

        const compositionTime = 0;
        videoTagBuffer[offset++] = (compositionTime >> 16) & 0xff;
        videoTagBuffer[offset++] = (compositionTime >> 8) & 0xff;
        videoTagBuffer[offset++] = compositionTime & 0xff;

        this.createTagHeader('video', chunk.byteLength, chunk.timestamp);

    }

    writeSPS() {
        const config = {
            configurationVersion: 0x01, // 配置版本
            avcProfileIndication: 0x64, // 编码级别
            profileCompatibility: 0x00, // 编码器兼容性信息
            avcLevelIndication: 0x28, // AVC级别指示
            reserved: 0xff, // 保留字段
            lengthSizeMinusOne: 0xff, // 意味长度大小是16bits            
            reserved1: 0xff, // 保留字段
            numSequenceParameterSets: 0xe1, // SPS个数
        }

        const spsSize = 0x18;   
        const spsData = 0x48;
        const ppsNum = 0x01;
        const ppsLength = 0x48;
        const ppsData = 0x48;

    }
}
