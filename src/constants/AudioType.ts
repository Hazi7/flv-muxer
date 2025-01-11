export enum SoundFormat {
  LinearPCMPlatformEndian = 0,
  ADPCM = 1,
  MP3 = 2,
  LinearPCMLittleEndian = 3,
  Nellymoser16kHzMono = 4,
  Nellymoser8kHzMono = 5,
  Nellymoser = 6,
  G711ALawLogarithmicPCM = 7,
  G711MuLawLogarithmicPCM = 8,
  Reserved = 9,
  AAC = 10,
  Speex = 11,
  MP38kHz = 14,
  DeviceSpecificSound = 15,
}

export enum SoundRate {
  kHz5_5 = 0,
  kHz11 = 1,
  kHz22 = 2,
  kHz44 = 3,
}

export enum SoundSize {
  Sound8bit = 0,
  Sound16bit = 1,
}

export enum SoundType {
  Mono = 0,
  Stereo = 1,
}
