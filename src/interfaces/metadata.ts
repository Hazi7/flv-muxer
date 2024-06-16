export interface VideoMetadata {
    duration?: number;
    height: number;
    width: number;
    videocodeid: number;
    framerate?: number;
}

export interface AudioMetadata {
    audiodatarate: string;
    stereo: number;
    audiocodecid: number;

}


export interface EncoderMetadata extends VideoMetadata, AudioMetadata {}