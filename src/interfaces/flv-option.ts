export interface FlvStreamOptions {
  hasAudio?: boolean;
  hasVideo?: boolean;
  width?: number;
  height?: number;
  audioCodec?: string;
  videoCodec?: string;
  videoFrameRate?: number;
}
