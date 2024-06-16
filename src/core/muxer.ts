import { FlvMuxer } from "./flv-muxer";

export function init() {}

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
    
    flvMuxer.onMetadata = (metadata) => {
        console.log('🚀 ~ test ~ metadata:', metadata);
    }

    console.log('🚀 ~ test ~ flvMuxer:', flvMuxer);

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
