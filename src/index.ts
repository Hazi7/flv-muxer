import { Muxer, StreamTarget } from "webm-muxer";
import Worker from './core/muxer?worker'

export async function test() {
    const ws = new WebSocket("ws://localhost:8082");

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

    const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
            frameRate: {
                ideal: 30,
                max: 30,
            },
        },
        audio: true
    });
    const videoTrack = stream.getVideoTracks()[0];

    let muxer = new Muxer({
        target: new StreamTarget({
            onData: (data: any, position: number) => {
                console.log('🚀 ~ test ~ data:', data);
                ws.send(data);
            },
            onHeader(data, position) {},
            onCluster(data, position, timestamp) {},
        }),
        streaming: true,
        video: {
            codec: "V_VP9",
            width: 1920,
            height: 1080,
        },
        audio: {
            codec: 'A_OPUS',
            numberOfChannels: 1,
            sampleRate: 48000
        },
        firstTimestampBehavior: "offset",
    });



    const audioContext = new AudioContext({
        sampleRate: 48000,
        latencyHint: "interactive",
    });

    const microphoneSource = audioContext.createMediaStreamSource(stream);
    const destinationNode = audioContext.createMediaStreamDestination();
    console.log('🚀 ~ test ~ destinationNode:', destinationNode);
    destinationNode.channelCount = 1;
    microphoneSource.connect(destinationNode);

    const audioEncoder = new AudioEncoder({
        output: function(chunk, meta){
            muxer.addAudioChunk(chunk, meta);
        },
        error: e => {
            console.log(e);
        },
    });

    const audioConfig = {
        codec: "opus",
        sampleRate: 48000,
        numberOfChannels: 1,
    };

    audioEncoder.configure(audioConfig);

    const audioTrackProcessor = new MediaStreamTrackProcessor({
        track: destinationNode.stream.getAudioTracks()[0],
    });


    audioTrackProcessor.readable.pipeTo(
        new WritableStream({
            write(chunk) {
                audioEncoder.encode(chunk);
                chunk.close();
            },
        })
    )


    const trackProcessor = new MediaStreamTrackProcessor({ track: videoTrack });

    const config = {
        output: (chunk: any, meta: any) => {
            muxer.addVideoChunk(chunk, meta)
        },
        error: (e: any) => console.error(e),
    };

    const encoderConfig = {
        codec: "vp09.00.10.08",
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
            let newTime = performance.now();
            const flag = newTime - timer > 32000;
            if (flag) {
                timer = performance.now();
            }

            encoder.encode(videoFrame, { keyFrame: flag });

            videoFrame.close();
        },
    });



    const writableStream = new WritableStream({
        start() {},
        write(chunk) {
            ws.send(chunk);
        },
    });

    trackProcessor.readable.pipeThrough(transformer).pipeTo(writableStream);
}

const worker = new Worker();

worker.onmessage = (event: any) => {
    console.log(event);
};

worker.postMessage('3232');