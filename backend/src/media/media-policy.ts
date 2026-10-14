export const MEDIA_POLICIES = {
  MOVIE_POSTER: {
    maxBytes: 10 * 1024 * 1024,
    mainSize: 1200,
    thumbnailSize: 360,
  },
  USER_AVATAR: { maxBytes: 5 * 1024 * 1024, mainSize: 512, thumbnailSize: 128 },
  FEEDBACK_SCREENSHOT: {
    maxBytes: 5 * 1024 * 1024,
    mainSize: 1600,
    thumbnailSize: 360,
  },
  ACTOR_PHOTO: {
    maxBytes: 10 * 1024 * 1024,
    mainSize: 1200,
    thumbnailSize: 360,
  },
} as const;

export type ImagePurpose = keyof typeof MEDIA_POLICIES;
export type ImagePolicy = {
  maxBytes: number;
  mainSize: number;
  thumbnailSize: number;
};
export const MAX_IMAGE_PIXELS = 50_000_000;
export const MAX_USER_MEDIA_BYTES = 500 * 1024 * 1024;
export const MAX_DAILY_UPLOADS = 100;
export const TEMPORARY_MEDIA_MS = 24 * 60 * 60 * 1000;
