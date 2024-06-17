import { AmfEnum, AvcPacketTypeEnum, CodecIdEnum, FrameTypeEnum, TagEnum } from "../constants/enums";
import type { AudioMetadata, EncoderMetadata, VideoMetadata } from "../interfaces/metadata";

export class FlvMuxer {
    textEncoder: TextEncoder = new TextEncoder();
    flvBuffer: Uint8Array | undefined;
    onMetadata: ((metadata: EncoderMetadata) => void) | undefined;
    onMediaData: ((data: Uint8Array) => void) | undefined;
    private _videoMetadata: VideoMetadata | undefined;
    private _audioMetadata: AudioMetadata | undefined;
    private _metadata!: EncoderMetadata;
    get videoMetadata(): VideoMetadata {
        if (!this._videoMetadata) {
            throw new Error("Video encoder error");
        }
        return this._videoMetadata;
    }
    set videoMetadata(value: any) {
        this._videoMetadata = value;

        this.metadata = {
            ...this.videoMetadata,
        }
    }
    get audioMetadata(): AudioMetadata {
        if (!this._audioMetadata) {
            throw new Error("Audio encoder error");
        }
        return this._audioMetadata;
    }
    set audioMetadata(value: any) {
        this._audioMetadata = value;

        this.metadata = {
            ...this.audioMetadata
        }
    }
    get metadata(): EncoderMetadata {
        return this._metadata;
    }
    set metadata(value: any) {
        this._metadata = value;

        this.onMetadata && this.onMetadata(this.metadata); // 触发onMetadata回调

        this.onMediaData && this.onMediaData(this.createFlvHeader());
        this.onMediaData && this.onMediaData(this.createMetadataTag(this.metadata));
    }

    constructor() {
        
    }

    /**
     * 创建FLV头信息
     * @param {number} version FLV版本，默认为1
     * @param {boolean} hasAudio 是否包含音频流，默认不包含
     * @param {boolean} hasVideo 是否包含视频流，默认包含
     * @returns {ArrayBuffer} 返回构造好的FLV头信息的ArrayBuffer
     */
    createFlvHeader(
        version: number = 1,
        hasAudio: boolean = false,
        hasVideo: boolean = true
    ): Uint8Array {
        const streamTypeFlag = hasAudio && hasVideo ? 0x05 : hasVideo ? 0x01 : hasAudio ? 0x04 : 0x00;

        const headerBuffer = new Uint8Array([
            0x46, 0x4c, 0x56, // FLV标识
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
    createTagHeader(
        tagType: keyof typeof TagEnum,
        bodySize: number,
        timestamp: number,
        streamId: number = 0
    ): Uint8Array {
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

    createMetadataTag(metadata: EncoderMetadata): Uint8Array {
        const stringAmfBuffer = this.createStringAMF(); // 创建第一个AMF包
        const arrayAmfBuffer = this.createArrayAMF(metadata); // 创建第二个AMF包

        const bodySize = stringAmfBuffer.byteLength + arrayAmfBuffer.byteLength; // 设置body size
        const preTagSize = bodySize + TagEnum.HeaderSize; // 设置 pre size

        const headerBuffer = this.createTagHeader("Metadata", bodySize, 0, 0); // 创建header tag
        const tagBuffer = new Uint8Array(preTagSize + 4); // 创建metadata的缓冲区

        tagBuffer.set(headerBuffer); // 设置头
        tagBuffer.set(stringAmfBuffer, TagEnum.HeaderSize);
        tagBuffer.set(
            arrayAmfBuffer,
            stringAmfBuffer.byteLength + TagEnum.HeaderSize
        );

        const tagBufferView = new DataView(tagBuffer.buffer);
        tagBufferView.setUint32(preTagSize, preTagSize); // 设置pre size

        return tagBuffer;
    }

    /**
     * @param {string} text 要写入的字符串
     */
    createStringAMF(text: string = "onMetaData") {
        let prefixSize = 3; // AMF类型（1byte）+ text长度（2byte）
        let amfBuffer = new Uint8Array(prefixSize + text.length);

        const amfBufferView = new DataView(amfBuffer.buffer);

        amfBufferView.setUint8(0, AmfEnum.String); // 设置AMF Type
        amfBufferView.setUint16(1, text.length); // 设置 string 的长度

        this.textEncoder.encodeInto(text, amfBuffer.subarray(prefixSize)); // 将字符串编码后插入到amfBuffer中

        return amfBuffer;
    }

    /**
     * @param {Object} metadata 要写入的元数据对象
     */
    createArrayAMF(metadata: EncoderMetadata) {
        let totalSize = 5,
            offset = 0;

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

                if (typeof metadata[key] === "number") {
                    amfBufferView.setUint8(offset++, AmfEnum.Number);
                    amfBufferView.setFloat64(offset, metadata[key]); // 设置value值
                    offset += 8;
                } else if (typeof metadata[key] === "boolean") {
                    amfBufferView.setUint8(offset++, AmfEnum.Boolean);
                    amfBufferView.setUint8(
                        offset++,
                        metadata[key] ? 0x01 : 0x00
                    );
                }
            }
        }

        return amfBuffer;
    }

    createVideoTag(chunk: EncodedVideoChunk, metadata: any) {

        let sequenceBuffer;

        // 如果是关键帧，则写入sps和pps
        if (metadata.decoderConfig) {

            const { codedWidth, codedHeight, codec } = metadata.decoderConfig;

            const videoMetadata: VideoMetadata = {
                width: codedWidth,
                height: codedHeight,
                videocodeid: 0
            }
            
            if (codec.includes('avc1')) {
                videoMetadata.videocodeid = CodecIdEnum.AVC;
            }

            this.videoMetadata = videoMetadata;

            const videoBodyBuffer = this.createVideoBody('KeyFrame', 'AVC', 'SequenceHeader', 0, metadata.decoderConfig.description);
            const videoHeaderBuffer = this.createTagHeader("Video", videoBodyBuffer.byteLength, chunk.timestamp / 1000);
            sequenceBuffer = new Uint8Array(videoHeaderBuffer.byteLength + videoBodyBuffer.byteLength + 4);

            sequenceBuffer.set(videoHeaderBuffer);
            sequenceBuffer.set(videoBodyBuffer, videoHeaderBuffer.byteLength);
            
            const sequenceBufferView = new DataView(sequenceBuffer.buffer);
            const preTagSize = videoHeaderBuffer.byteLength + videoBodyBuffer.byteLength; // tag的大小

            sequenceBufferView.setUint32(preTagSize, preTagSize);
        }

        const frameType = chunk.type === "key" ? 'KeyFrame' : 'InterFrame'; // 判断是不是关键帧

        // 将EncoderVideoChunk中的数据写入到Uint8Array中
        const dataBuffer = new Uint8Array(chunk.byteLength);
        chunk.copyTo(dataBuffer);

        // 创建video tag缓冲区
        const videoBodyBuffer = this.createVideoBody(frameType, 'AVC', 'NALU', 0, dataBuffer)
        const videoHeaderBuffer = this.createTagHeader("Video", videoBodyBuffer.byteLength, chunk.timestamp / 1000);

        const videoTagSize = videoHeaderBuffer.byteLength + videoBodyBuffer.byteLength + 4;
        const tagSize = sequenceBuffer ? sequenceBuffer.byteLength + videoTagSize : videoTagSize; // 整个tag的大小

        const videoTagBuffer = new Uint8Array(tagSize);

        let offset = 0;
        if (sequenceBuffer) { // 如果是关键帧，则先写入sps和pps
            videoTagBuffer.set(sequenceBuffer, offset);
            offset += sequenceBuffer.byteLength;
        }
        
        // 设置video tag的header
        videoTagBuffer.set(videoHeaderBuffer, offset);
        offset += videoHeaderBuffer.byteLength;
        // 设置video tag的body
        videoTagBuffer.set(videoBodyBuffer, offset);
        offset += videoBodyBuffer.byteLength;

        // 设置pre size
        const videoTagBufferView = new DataView(videoTagBuffer.buffer);
        videoTagBufferView.setUint32(tagSize - 4, videoHeaderBuffer.byteLength + videoBodyBuffer.byteLength);

        this.onMediaData && this.onMediaData(videoTagBuffer);

        return videoTagBuffer;
    }

    createVideoBody(
        frameType: keyof typeof FrameTypeEnum,
        codecId: keyof typeof CodecIdEnum,
        avcPacketType: keyof typeof AvcPacketTypeEnum,
        compositionTime: number = 0,
        data: ArrayBuffer
    ) {

        const videoBodyBuffer = new Uint8Array(5 + data.byteLength);
        const videoBodyBufferView = new DataView(videoBodyBuffer.buffer);

        let offset = 0;

        videoBodyBufferView.setUint8(offset++, FrameTypeEnum[frameType] | CodecIdEnum[codecId]); // 设置帧类型和编码器ID
        videoBodyBufferView.setUint8(offset++, AvcPacketTypeEnum[avcPacketType]); // 设置avc类型

        // 设置偏移时间
        videoBodyBufferView.setUint8(offset++, (compositionTime >> 16) & 0xff);
        videoBodyBufferView.setUint8(offset++, (compositionTime >> 8) & 0xff);
        videoBodyBufferView.setUint8(offset++, compositionTime & 0xff);

        
        videoBodyBuffer.set(new Uint8Array(data), offset); // 设置NALUint数据包

        return videoBodyBuffer;
    }

    createAudioTag(data: ArrayBuffer, metadata: Object) {
        
    }

    createAudioBody(data: ArrayBuffer, metadata: Object) {
        
    }

    addVideoTrack(chunk: EncodedVideoChunk, metadata: Object) {
        const videoTagBuffer = this.createVideoTag(chunk, metadata);

        this.writeToBuffer(videoTagBuffer);
    }

    writeToBuffer(newData: Uint8Array) {
        const oldBuffer = this.flvBuffer;
        if (oldBuffer) {
            const newBuffer = new Uint8Array(oldBuffer.length + newData.length);
            newBuffer.set([...oldBuffer, ...newData]);
            this.flvBuffer = newBuffer;
        }
    }
}