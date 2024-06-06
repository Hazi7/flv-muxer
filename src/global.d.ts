interface MediaStreamTrackProcessorOptions {
    track: MediaStreamTrack;
}

declare class MediaStreamTrackProcessor {
    constructor(options: MediaStreamTrackProcessorOptions);
    readonly readable: ReadableStream<any>;
}