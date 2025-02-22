/**
 * FrameType 枚举用于定义视频帧的类型
 */
export enum FrameType {
  /**
   * 关键帧 (Key Frame)：完整视频帧，以便解码器无需参考先前的帧。
   */
  KeyFrame = 0x01,

  /**
   * 内部压缩帧 (Inter Frame)：依赖前面的关键帧或其它内部压缩帧。
   */
  InterFrame = 0x02,

  /**
   * 可丢弃的压缩帧 (Disposable Inter Frame)：在网络条件差时可以被丢弃。
   */
  DisposableInterFrame = 0x03,

  /**
   * 生成新的关键帧 (Generate Key Frame)
   */
  GenerateKeyFrame = 0x04,

  /**
   * 视频信息/命令帧 (Video Info/Command Frame)：携带视频流的元数据信息。
   */
  VideoInfo = 0x05,
}

/**
 * CodeId 枚举用于定义视频编码格式类型
 */
export enum CodeId {
  /**
   * H.263 编码格式
   */
  H263 = 0x02,

  /**
   * 屏幕录制视频编码 (Screen Video)
   */
  ScreenVideo = 0x03,

  /**
   * VP6 编码格式
   */
  VP6 = 0x04,

  /**
   * 带有 Alpha 通道的 VP6 编码格式
   */
  VP6WithAlphaChannel = 0x05,

  /**
   * 屏幕录制视频2 (Screen Video 2) 编码格式
   */
  ScreenVideo2 = 0x06,

  /**
   * AVC 编码格式 (H.264)
   */
  AVC = 0x07,
}

/**
 * 枚举表示不同类型的 AVC（高级视频编码）包。
 */
export enum AvcPacketType {
  /**
   * SequenceHeader 表示 AVC 的序列头包类型。
   */
  SequenceHeader = 0x00,

  /**
   * Nalu（网络抽象层单元）表示 AVC 的 NAL 单元包类型。
   */
  NALU = 0x01,

  /**
   * EndOfSequence 表示 AVC 序列的结束。
   */
  EndOfSequence = 0x02,
}
