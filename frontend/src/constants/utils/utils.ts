import { MIN_SPINNER_TIME } from "@/constants/movies";

export const getDefaultLoaderDelayTime = (start: number) => {
  const duration = Date.now() - start;

  return Math.max(MIN_SPINNER_TIME - duration, 0);
};
