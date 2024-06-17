import { FlvMuxer } from "./flv-muxer";

const ws = new WebSocket('ws://118.31.245.3:8082');

ws.onopen = () => {
    console.log("WebSocket connection opened");
};

ws.onerror = error => {
    console.error("WebSocket error:", error);
};

ws.onclose = () => {
    console.log("WebSocket connection closed");
};

ws.onmessage = event => {
    console.log(event);
};

let oldBuffer: Uint8Array = new Uint8Array();

function writeToBuffers(newData: Uint8Array) {
    if (oldBuffer) {
        const newBuffer = new Uint8Array(oldBuffer.length + newData.length);
        newBuffer.set([...oldBuffer, ...newData]);
        oldBuffer = newBuffer;
    }
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

    flvMuxer.onMediaData = (chunk: Uint8Array) => {
        writeToBuffers(chunk);

        console.log(oldBuffer);
        ws.send(chunk.buffer);
    }

    setInterval(() => {
        ws.send(flvMuxer.createMetadataTag(flvMuxer.metadata));
    }, 1000)
    
    setTimeout(() => {

        const flvBlob = new Blob([oldBuffer], { type: "video/x-flv" });
    
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
    }, 5000);


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
