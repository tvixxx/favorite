import type { AxiosProgressEvent } from "axios";
import api from "./api";

export type ImagePurpose = "MOVIE_POSTER" | "USER_AVATAR" | "ACTOR_PHOTO";
export interface ImageSelection {
  url: string;
  assetId?: string | null;
  thumbnailUrl?: string | null;
}
export interface UploadedImage {
  id: string;
  url: string;
  thumbnailUrl?: string;
  mimeType?: string;
  byteSize?: number;
  width?: number;
  height?: number;
}

export async function uploadImage(
  file: File,
  purpose: ImagePurpose,
  options: {
    signal?: AbortSignal;
    onProgress?: (loaded: number, total?: number) => void;
  }
): Promise<UploadedImage> {
  const body = new FormData();

  body.append("file", file);
  body.append("purpose", purpose);
  const response = await api.post<UploadedImage>("/uploads/images", body, {
    headers: { "Content-Type": undefined },
    signal: options.signal,
    onUploadProgress: (event: AxiosProgressEvent) =>
      options.onProgress?.(event.loaded, event.total),
  });

  if (!response.data.id || !response.data.url) {
    throw new Error("Не удалось получить загруженное изображение");
  }

  return response.data;
}

export async function discardImage(id: string): Promise<void> {
  await api.delete(`/uploads/images/${id}`);
}
