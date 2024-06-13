import { FlvMuxer } from "./flv_muxer";

export function init() {}

function findNalUnitEnd(data, start) {
    for (let i = start; i < data.length - 3; i++) {
      if (data[i] === 0 && data[i + 1] === 0 && (data[i + 2] === 0 && data[i + 3] === 1 || data[i + 2] === 1)) {
        return i;
      }
    }
    return data.length;
  }

export async function test() {
    const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
            frameRate: {
                ideal: 30,
                max: 30,
            },
        },
    });
    const videoTrack = stream.getVideoTracks()[0];

    const trackProcessor = new MediaStreamTrackProcessor({ track: videoTrack });
    
    const flvMuxer = new FlvMuxer();

    const config = {
        output: (chunk: any, metadata: any) => {
            flvMuxer.addVideoTrack(chunk, metadata);
        },
        error: (e: any) => console.error(e),
    };

    const encoderConfig = {
        codec: "avc1.640028",
        width: 1920,
        height: 1080,
        framerate: 30,
        bitrate: 2000000,
    };

    const encoder = new VideoEncoder(config);
    encoder.configure(encoderConfig);

    let timer = performance.now();

    let writableController;

    const transformer = new TransformStream({
        start(controller) {
            writableController = controller;
        },
        async transform(videoFrame, controller) {
            encoder.encode(videoFrame);

            videoFrame.close();
        },
    });

    const writableStream = new WritableStream({
        start() {},
        write(chunk) {},
    });

    trackProcessor.readable.pipeThrough(transformer).pipeTo(writableStream);
}

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
const FLV_HEADER = new Uint8Array([
    0x46,
    0x4c,
    0x56, // Signature "FLV"
    0x01, // Version 1
    0x01, // 视频
    0x00,
    0x00,
    0x00,
    0x09,
    0x00,
    0x00,
    0x00,
    0x00,
]);

// 创建 FLV 数据
const flvData = [FLV_HEADER];

const scriptData = createMetaTag();

flvData.push(scriptData);

// setTimeout(() => {
//     createFLV();
// }, 5000);

function createFLV() {
    console.log("🚀 ~ createFLV ~ flvData:", flvData);

    const flvBlob = new Blob(flvData, { type: "video/x-flv" });

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

function createFLVTag(chunk: any) {
    const isKeyframe = chunk.type === "key";
    const frameType = isKeyframe ? 0x10 : 0x20; // 1 for keyframe, 2 for interframe
    const codecID = 0x07; // H.264

    const data = new Uint8Array(chunk.byteLength + 5);
    let offset = 0;

    // FrameType and CodecID
    data[offset++] = frameType | codecID;

    // AVCPacketType
    data[offset++] = chunk.isConfig ? 0x00 : 0x01; // 0x00 for AVC sequence header, 0x01 for NALU

    // CompositionTime
    const compositionTime = 0; // Can be adjusted if needed
    data[offset++] = (compositionTime >> 16) & 0xff;
    data[offset++] = (compositionTime >> 8) & 0xff;
    data[offset++] = compositionTime & 0xff;

    // NALU Data
    data.set(new Uint8Array(chunk.data), offset);
    offset += chunk.byteLength;

    // Tag Header
    const tagSize = 11 + data.length;
    const tag = new Uint8Array(tagSize + 4); // 4 extra bytes for PreviousTagSize

    offset = 0;

    // Tag Type (0x09 for video)
    tag[offset++] = 0x09;

    // Data Size
    tag[offset++] = (data.length >> 16) & 0xff;
    tag[offset++] = (data.length >> 8) & 0xff;
    tag[offset++] = data.length & 0xff;

    // Timestamp
    const timestamp = chunk.timestamp;
    tag[offset++] = (timestamp >> 16) & 0xff;
    tag[offset++] = (timestamp >> 8) & 0xff;
    tag[offset++] = timestamp & 0xff;

    // Timestamp Extended
    tag[offset++] = (timestamp >> 24) & 0xff;

    // StreamID (always 0)
    tag[offset++] = 0x00;
    tag[offset++] = 0x00;
    tag[offset++] = 0x00;

    // Data
    tag.set(data, offset);
    offset += data.length;

    // PreviousTagSize
    tag[offset++] = (tagSize >> 24) & 0xff;
    tag[offset++] = (tagSize >> 16) & 0xff;
    tag[offset++] = (tagSize >> 8) & 0xff;
    tag[offset++] = tagSize & 0xff;

    return tag;
}

function extractSPSAndPPS(h264Data) {
    const SPS_TYPE = 7;
    const PPS_TYPE = 8;

    let sps = null;
    let pps = null;

    // 查找起始码的位置
    function findStartCode(data, start) {
        for (let i = start; i < data.length - 3; i++) {
            if (
                data[i] === 0x00 &&
                data[i + 1] === 0x00 &&
                data[i + 2] === 0x00 &&
                data[i + 3] === 0x01
            ) {
                return i + 4;
            }
            if (
                data[i] === 0x00 &&
                data[i + 1] === 0x00 &&
                data[i + 2] === 0x01
            ) {
                return i + 3;
            }
        }
        return -1;
    }

    let offset = 0;
    while (offset < h264Data.length) {
        offset = findStartCode(h264Data, offset);
        if (offset === -1) break;

        const nalHeader = h264Data[offset];
        const nalType = nalHeader & 0x1f;

        const startCodeOffset = offset - 4;
        const nextStartCodeOffset = findStartCode(h264Data, offset);
        const nalUnit = h264Data.subarray(
            startCodeOffset,
            nextStartCodeOffset !== -1 ? nextStartCodeOffset : h264Data.length
        );

        if (nalType === SPS_TYPE) {
            sps = nalUnit;
        } else if (nalType === PPS_TYPE) {
            pps = nalUnit;
        }

        if (sps && pps) break;

        offset =
            nextStartCodeOffset !== -1 ? nextStartCodeOffset : h264Data.length;
    }

    return { sps, pps };
}

function createMetaTag() {
    const metaDataHeader = new Uint8Array([
        0x12, // tag type
        0x00,
        0x00,
        0x00, // body size
        0x00,
        0x00,
        0x00, // timestamp
        0x00, // timestampextended
        0x00,
        0x00,
        0x00, // StreamID
    ]);

    const textEncoder = new TextEncoder();
    const nameData = textEncoder.encode("onMetaData");
    const nameLength = nameData.length;

    const firstAMf = new Uint8Array([
        0x02,
        nameLength >> 8 && 0xff,
        nameLength & 0xff,
        ...nameData,
    ]);

    const bodyBuffer = new ArrayBuffer(512);

    const body = new DataView(bodyBuffer);
    let offset = 0;

    for (const key in metadata) {
        if (metadata.hasOwnProperty(key)) {
            const keyData = textEncoder.encode(key);
            const keyLength = keyData.length;
            body.setUint16(offset, keyLength);
            offset += 2;

            for (let i = 0; i < keyLength; i++) {
                body.setUint8(offset++, keyData[i]);
            }

            const value = metadata[key];
            if (typeof value === "number") {
                body.setUint8(offset++, 0x00);
                body.setFloat64(offset, value);
                offset += 8;
            } else if (typeof value == "boolean") {
                body.setUint8(offset++, 0x01);
                body.setUint8(offset++, value ? 1 : 0);
            }
        }
    }

    const newBuffer = body.buffer.slice(0, offset + 1);
    const dsds = new Uint8Array(newBuffer);

    const secoendAMF = new Uint8Array([0x08, 0x00, 0x00, 0x00, 0x08, ...dsds]);

    const dataSize = firstAMf.length + secoendAMF.length;
    metaDataHeader[1] = (dataSize >> 16) & 0xff;
    metaDataHeader[2] = (dataSize >> 8) & 0xff;
    metaDataHeader[3] = dataSize & 0xff;

    const dataSizeHex = textEncoder.encode(dataSize);

    const klkl = new Uint8Array([
        ...metaDataHeader,
        ...firstAMf,
        ...secoendAMF,
        0x00,
        0x00,
        0x00,
        0xc0,
    ]);

    return klkl;
}
