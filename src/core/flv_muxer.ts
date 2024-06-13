import { AmfEnum } from "../constants/amf-type";
import { TagEnum } from "../constants/tag-type";

const metadata = {
    duration: 20,
    width: 1920,
    height: 1080,
    videodatarate: 500,
    framerate: 30,
    videocodecid: 7,
};

export class FlvMuxer {
    textEncoder: TextEncoder = new TextEncoder();
    flvBuffer: Uint8Array | undefined;
    get offset() {
        return this.flvBuffer?.length || 0;
    }

    constructor() {

        this.flvBuffer = new Uint8Array([
            ...this.createFlvHeader(),
            ...this.createMetadataTag(),
        ]);

        setTimeout(() => {
            this.createFlvFile();
        }, 15000);
    }

    createFlvFile() {
        
        const flvBlob = new Blob([this.flvBuffer], { type: "video/x-flv" });

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

    createFlvHeader(version: number = 1, hasAudio: boolean = false, hasVideo: boolean = true) {
        const flagByte = hasAudio && hasVideo ? 0x05 : hasVideo ? 0x01 : hasAudio ? 0x04 : 0x00;

        const headerBuffer = new Uint8Array([
            0x46 ,0x4c, 0x56,
            version, // 'FLV' + 版本号
            flagByte, // 音频视频标志
            0x00, 0x00, 0x00, 0x09,
            0x00, 0x00, 0x00, 0x00, // tag size
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

        const preTagBuffer = new Uint8Array([
            dataSizeByte3,
            dataSizeByte2,
            dataSizeByte1,
            dataSizeByte0,
        ]);

        const metadataTagBuffer = new Uint8Array([
            ...this.createTagHeader("metadata", dataSize, 0, 0),
            ...stringAmfBuffer,
            ...arrayAmfBuffer,
            ...preTagBuffer,
        ]);

        return metadataTagBuffer;
    }

    createStringAMF(text: string = "onMetaData") {
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

                this.textEncoder.encodeInto(key, amfBuffer.subarray(offset));
                offset += key.length;
                amfBufferView.setUint8(offset++, 0x00);
                amfBufferView.setFloat64(offset, element);
                offset += 8;
            }
        }

        return amfBuffer.subarray(0, offset);
    }

    createTagHeader(tagType: keyof typeof TagEnum,dataSize: number,timestamp: number,streamId: number = 0) {
        const tagHeaderBuffer = new Uint8Array(11);

        let offset = 0;

        const tagHeaderBufferView = new DataView(tagHeaderBuffer.buffer);
        tagHeaderBufferView.setUint8(offset++, TagEnum[`${tagType}`]);

        const bodySizeBytes = [
            (dataSize >> 16) & 0xff,
            (dataSize >> 8) & 0xff,
            dataSize & 0xff,
        ];
        bodySizeBytes.forEach(byte => {
            tagHeaderBuffer[offset++] = byte;
        });
        console.log('🚀 ~ FlvMuxer ~ createTagHeader ~ bodySizeBytes:', timestamp);


        const timestampBytes = [
            (timestamp >> 16) & 0xff,
            (timestamp >> 8) & 0xff,
            timestamp & 0xff,
        ];
        console.log('🚀 ~ FlvMuxer ~ createTagHeader ~ timestampBytes:', timestampBytes);

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


    writeVideoTagBody(chunk: EncodedVideoChunk, metadata: any) {

        const isKeyFrame = chunk.type == "key";
        const frameByte = isKeyFrame ? 0x10 : 0x20;
        const codecId = 0x07;

        let buffer = new Uint8Array(5);

        let videoTagBuffer;
        
        let offset = 0;

        buffer[offset++] = frameByte | codecId; // 标识为是否是关键帧及编码类型
        buffer[offset++] = 0x01; // 0x00标识为AVC序列头, 0x01标识为AVC视频流中的基本数据单元

        const compositionTime = 0;
        buffer[offset++] = (compositionTime >> 16) & 0xff;
        buffer[offset++] = (compositionTime >> 8) & 0xff;
        buffer[offset++] = compositionTime & 0xff;

        videoTagBuffer = this.writeNalUnit(chunk);

        const result = new Uint8Array([
            ...buffer,
            ...videoTagBuffer
        ]);

        return result;
    }

    writeAvcConfiguration(description: ArrayBuffer) {

        const avcConfiguration = new Uint8Array(description.byteLength + 5);
        let offset = 0;

        avcConfiguration[offset++] = 0x10 | 0x07; // 标识为是否是关键帧及编码类型
        avcConfiguration[offset++] = 0x00; // 0x00标识为AVC序列头, 0x01标识为AVC视频流中的基本数据单元

        const compositionTime = 0;
        avcConfiguration[offset++] = (compositionTime >> 16) & 0xff;
        avcConfiguration[offset++] = (compositionTime >> 8) & 0xff;
        avcConfiguration[offset++] = compositionTime & 0xff;

        avcConfiguration.set(new Uint8Array(description), 5);

        const videoTagHeaderBuffer = this.createTagHeader('video', avcConfiguration.byteLength, 0);

        const preTagSize = avcConfiguration.byteLength + videoTagHeaderBuffer.byteLength;

        const preTagSizeByte3 = (preTagSize >> 24) & 0xff;
        const preTagSizeByte2 = (preTagSize >> 16) & 0xff;
        const preTagSizeByte1 = (preTagSize >> 8) & 0xff;
        const preTagSizeByte0 = preTagSize & 0xff;

        
        const videoData = new Uint8Array([
            ...videoTagHeaderBuffer,
            ...avcConfiguration,
            preTagSizeByte3, preTagSizeByte2, preTagSizeByte1, preTagSizeByte0
        ]);

        return videoData;

    }
    writeNalUnit(chunk: EncodedVideoChunk) {

        
        const dataBuffer = new Uint8Array(chunk.byteLength);
        chunk.copyTo(dataBuffer.buffer);


        // let offset = 0;

        // const rawByteSequencePayload = this.writeTrailer(dataBuffer);
        // const nalUintBuffer = new Uint8Array(rawByteSequencePayload.byteLength + 8);
        // // 设置起始头码
        // nalUintBuffer[offset++] = 0x00;
        // nalUintBuffer[offset++] = 0x00;
        // nalUintBuffer[offset++] = 0x01;
        
        // nalUintBuffer[offset++] = chunk.type == 'key' ? 0x61 : 0x41; // header

        // const dataSize = rawByteSequencePayload.byteLength;

        // const rawByteSequencePayloadByte3 = (dataSize >> 24) & 0xff;
        // const rawByteSequencePayloadByte2 = (dataSize >> 16) & 0xff;
        // const rawByteSequencePayloadByte1 = (dataSize >> 8) & 0xff;
        // const rawByteSequencePayloadByte0 = dataSize & 0xff;

        // nalUintBuffer[offset++] = rawByteSequencePayloadByte3;
        // nalUintBuffer[offset++] = rawByteSequencePayloadByte2;
        // nalUintBuffer[offset++] = rawByteSequencePayloadByte1;
        // nalUintBuffer[offset++] = rawByteSequencePayloadByte0;

        // nalUintBuffer.set(rawByteSequencePayload, offset);
        // offset += rawByteSequencePayload.byteLength;

        // return nalUintBuffer;
        return dataBuffer;
    }

    writeVideoTag(chunk: EncodedVideoChunk, metadata: any) {
        
        const videoTagBodyBuffer = this.writeVideoTagBody(chunk, metadata);
        const videoTagHeaderBuffer = this.createTagHeader('video', videoTagBodyBuffer.byteLength, chunk.timestamp / 1000);

        const preTagSize = videoTagBodyBuffer.byteLength + videoTagHeaderBuffer.byteLength;

        const preTagSizeByte3 = (preTagSize >> 24) & 0xff;
        const preTagSizeByte2 = (preTagSize >> 16) & 0xff;
        const preTagSizeByte1 = (preTagSize >> 8) & 0xff;
        const preTagSizeByte0 = preTagSize & 0xff;

        const videoData = new Uint8Array([
            ...videoTagHeaderBuffer,
            ...videoTagBodyBuffer,
            preTagSizeByte3, preTagSizeByte2, preTagSizeByte1, preTagSizeByte0
        ]);

        return videoData;
    }

    addVideoTrack(chunk: EncodedVideoChunk, metadata: Object) {
    
        if (chunk.type == 'key') {
            const avvc = this.writeAvcConfiguration(metadata.decoderConfig.description)
            this.writeToBuffer(avvc);
        }
        
        const videoTagBuffer = this.writeVideoTag(chunk, metadata);

        this.writeToBuffer(videoTagBuffer);
    }

    writeToBuffer(newData: Uint8Array) {
        const oldBuffer = this.flvBuffer;
        if (oldBuffer) {
            const newBuffer = new Uint8Array(oldBuffer.length + newData.length);
            newBuffer.set([
                ...oldBuffer,
                ...newData
            ]);
            this.flvBuffer = newBuffer;
        }
    }

}