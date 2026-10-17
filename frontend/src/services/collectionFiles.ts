import api from "@/services/api";
import { isAxiosError } from "axios";
import type { ContentKind } from "@/utils/content-kind";

export interface CollectionReportMovie {
  title: string;
  year: number | null;
  isSerial: boolean;
  contentKind: ContentKind | null;
  watchStatus: string;
  personalRate: number | null;
  completedAt: string | null;
  posterUrl: string | null;
}
export interface CollectionReport {
  exportedAt: string;
  movies: CollectionReportMovie[];
}

export async function fetchCollectionFile(
  userId: string,
  params: URLSearchParams,
  signal: AbortSignal
): Promise<Blob | CollectionReport | null> {
  const pdf = params.get("format") === "pdf";
  try {
    const { data, status } = await api.get<Blob | CollectionReport>(
      `/users/${userId}/movies/export?${params}`,
      {
        responseType: pdf ? "json" : "blob",
        signal,
      }
    );

    return status === 204 ? null : data;
  } catch (cause) {
    if (
      isAxiosError(cause) &&
      cause.response?.data instanceof Blob &&
      cause.response.data.size < 65536
    ) {
      try {
        cause.response.data = JSON.parse(await cause.response.data.text());
      } catch {
        /* Сохраняем исходную ошибку, если тело не JSON. */
      }
    }

    throw cause;
  }
}

export function downloadCollectionFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
