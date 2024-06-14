export enum TagEnum {
    Audio = 0x08,
    Video = 0x09,
    Metadata = 0x12,
    HeaderSize = 11
}

export enum AvcPacketTypeEnum  {
    SequenceHeader = 0x00,
    NALU = 0x01,
    EndOfSequence = 0x02,
}

export enum AmfEnum {
    Number = 0x00,
    Boolean = 0x01,
    String = 0x02,
    Object = 0x03,
    MovieClip = 0x04,
    Null = 0x05,
    Undefined = 0x06,
    Reference = 0x07,
    EcmaArray = 0x08,
    ObjectEnd = 0x09,
    StrictArray = 0x0A,
    Data = 0x0b,
    LongString = 0x0c
}

export enum FrameTypeEnum {
    KeyFrame = 0x10,
    InterFrame = 0x20,
    DisposableInterFrame = 0x30,
    GeneratedKeyFrame = 0x40,
    InfoFrame = 0x50
}

export enum CodecIdEnum {
    SorensonH263 = 0x02,
    ScreenVideo = 0x03,
    On2VP6 = 0x04,
    On2VP6Alpha = 0x05,
    ScreenVideoVersion2 = 0x06,
    AVC = 0x07
}