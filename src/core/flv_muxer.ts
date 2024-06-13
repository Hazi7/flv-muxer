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
            ...this.createMetadataTag(metadata),
        ]);

        setTimeout(() => {
            this.createFlvFile();
        }, 3000);
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

    /**
     * 创建FLV头信息
     * @param {number} version FLV版本，默认为1
     * @param {boolean} hasAudio 是否包含音频流，默认不包含
     * @param {boolean} hasVideo 是否包含视频流，默认包含
     * @returns {ArrayBuffer} 返回构造好的FLV头信息的ArrayBuffer
     */
    createFlvHeader(version: number = 1, hasAudio: boolean = false, hasVideo: boolean = true): Uint8Array {
        const streamTypeFlag = hasAudio && hasVideo ? 0x05 : hasVideo ? 0x01 : hasAudio ? 0x04 : 0x00;

        const headerBuffer = new Uint8Array([
            0x46 ,0x4c, 0x56, // FLV标识
            version, // 版本号
            streamTypeFlag, // 音频视频标志
            0x00, 0x00, 0x00, 0x09, // 头部大小
            0x00, 0x00, 0x00, 0x00, // 前一个标签的大小，这里默认为0
        ]);

        return headerBuffer;
    }

    /**
     * @param {keyof typeof TagEnum} tagType 标签类型
     * @param {number} bodySize 标签体大小
     * @param {number} timestamp 时间戳
     * @param {number} streamId 流媒体ID
     */
    createTagHeader(tagType: keyof typeof TagEnum, bodySize: number, timestamp: number,streamId: number = 0): Uint8Array {
        const tagHeaderBuffer = new Uint8Array(TagEnum.HeaderSize);
        const tagHeaderBufferView = new DataView(tagHeaderBuffer.buffer);

        let offset = 0;

        // 设置头部类型
        tagHeaderBufferView.setUint8(offset++, TagEnum[tagType]);

        // 设置头部长度
        tagHeaderBufferView.setUint8(offset++, (bodySize >> 16) & 0xff);
        tagHeaderBufferView.setUint8(offset++, (bodySize >> 8) & 0xff);
        tagHeaderBufferView.setUint8(offset++, bodySize & 0xff);

        // 设置时间戳
        tagHeaderBufferView.setUint8(offset++, (timestamp >> 16) & 0xff);
        tagHeaderBufferView.setUint8(offset++, (timestamp >> 8) & 0xff);
        tagHeaderBufferView.setUint8(offset++, timestamp & 0xff);
        tagHeaderBufferView.setUint8(offset++, (timestamp >> 24) & 0xff); // 时间戳扩展位

        // 设置流媒体ID
        tagHeaderBufferView.setUint8(offset++, (streamId >> 16) & 0xff);
        tagHeaderBufferView.setUint8(offset++, (streamId >> 8) & 0xff);
        tagHeaderBufferView.setUint8(offset++, streamId & 0xff);

        return tagHeaderBuffer;
    }

    createMetadataTag(metadata: { [key: string]: number }): Uint8Array {
        const stringAmfBuffer = this.createStringAMF(); // 创建第一个AMF包
        const arrayAmfBuffer = this.createArrayAMF(metadata); // 创建第二个AMF包

        const bodySize = stringAmfBuffer.byteLength + arrayAmfBuffer.byteLength; // 设置body size
        const preTagSize = bodySize + TagEnum.HeaderSize; // 设置 pre size

        const headerBuffer = this.createTagHeader('Metadata', bodySize, 0, 0); // 创建header tag
        const tagBuffer = new Uint8Array(preTagSize + 4); // 创建metadata的缓冲区

        tagBuffer.set(headerBuffer); // 设置头
        tagBuffer.set(stringAmfBuffer, TagEnum.HeaderSize);
        tagBuffer.set(arrayAmfBuffer, stringAmfBuffer.byteLength + TagEnum.HeaderSize);

        const tagBufferView = new DataView(tagBuffer.buffer);
        tagBufferView.setUint32(preTagSize, preTagSize); // 设置pre size

        return tagBuffer;
    }

    createStringAMF(text: string = "onMetaData") {
        let prefixSize = 3; // AMF类型（1byte）+ text长度（2byte）
        let amfBuffer = new Uint8Array(prefixSize + text.length);

        const amfBufferView = new DataView(amfBuffer.buffer);

        amfBufferView.setUint8(0, AmfEnum.String); // 设置AMF Type
        amfBufferView.setUint16(1, text.length); // 设置 string 的长度

        this.textEncoder.encodeInto(text, amfBuffer.subarray(prefixSize)); // 将字符串编码后插入到amfBuffer中

        return amfBuffer;
    }

    createArrayAMF(metadata: { [key: string]: number }) {
        let totalSize = 5, offset = 0;

        for (const key in metadata) {
            if (Object.prototype.hasOwnProperty.call(metadata, key)) {
                totalSize += 11; // key的长度（2byte） + value值（8byte） + 固定字节（1byte）
                totalSize += key.length;
            }
        }

        const amfBuffer = new Uint8Array(totalSize);
        const amfBufferView = new DataView(amfBuffer.buffer);

        amfBufferView.setUint8(offset++, AmfEnum.EcmaArray); // 设置AMF类型为EcmaArray
        amfBufferView.setUint32(offset, Object.keys(metadata).length);
        offset += 4;

        for (const key in metadata) {

            if (Object.prototype.hasOwnProperty.call(metadata, key)) {
                amfBufferView.setUint16(offset, key.length); // 设置key的长度
                offset += 2;

                this.textEncoder.encodeInto(key, amfBuffer.subarray(offset));
                offset += key.length;

                amfBufferView.setUint8(offset++, 0x00);
                amfBufferView.setFloat64(offset, metadata[key]); // 设置value值
                offset += 8;
            }
        }

        return amfBuffer;
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

        const videoTagHeaderBuffer = this.createTagHeader('Video', avcConfiguration.byteLength, 0);

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

        return dataBuffer;
    }

    writeVideoTag(chunk: EncodedVideoChunk, metadata: any) {
        
        const videoTagBodyBuffer = this.writeVideoTagBody(chunk, metadata);
        const videoTagHeaderBuffer = this.createTagHeader('Video', videoTagBodyBuffer.byteLength, chunk.timestamp / 1000);

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