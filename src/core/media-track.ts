interface MediaTrack {
  encoder: VideoEncoder | AudioEncoder;
  lastTimestamp: number;
}
