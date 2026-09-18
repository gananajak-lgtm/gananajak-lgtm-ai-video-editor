declare module "ffmpeg-static" {
  const ffmpegPath: string | null;
  export = ffmpegPath;
}

declare module "ffprobe-static" {
  const ffprobeStatic: {
    path: string;
    version: string;
  };
  export = ffprobeStatic;
}
