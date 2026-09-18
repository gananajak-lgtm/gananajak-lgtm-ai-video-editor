export type ProjectMedia = {
  images: string[];
  narration: string | null;
};

export type VideoProject = {
  id: string;
  title: string;
  createdAt: string;
  media: ProjectMedia;
};

export type TimelineClip = {
  id: string;
  imagePath: string;
  start: number;
  duration: number;
  motion: "slow-zoom-in";
};

export type TimelinePlan = {
  duration: number;
  narration: string;
  width: number;
  height: number;
  fps: number;
  clips: TimelineClip[];
};

export type RenderResult = {
  outputPath: string;
};

export type DesktopApi = {
  selectImages: () => Promise<string[]>;
  selectNarration: () => Promise<string | null>;
  buildTimeline: (images: string[], narration: string) => Promise<TimelinePlan>;
  chooseOutput: () => Promise<string | null>;
  renderTimeline: (plan: TimelinePlan, outputPath: string) => Promise<RenderResult>;
};
