declare class MediaStreamTrackProcessor {
  constructor(options: { track: MediaStreamTrack; maxBufferSize?: number });

  readonly readable: ReadableStream;
}
