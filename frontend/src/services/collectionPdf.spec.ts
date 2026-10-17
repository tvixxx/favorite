import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Blob as NativeBlob } from "node:buffer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCollectionPdf } from "./collectionPdf";
import type { CollectionReport } from "./collectionFiles";

const report: CollectionReport = {
  exportedAt: "2026-10-16T00:00:00Z",
  movies: Array.from({ length: 30 }, (_, i) => ({
    title: `Кириллица: фильм ${i + 1}`,
    year: 2020,
    isSerial: false,
    contentKind: null,
    watchStatus: "COMPLETED",
    personalRate: i === 0 ? null : 8,
    completedAt: "2026-10-15T22:30:00Z",
    posterUrl: null,
  })),
};
beforeEach(() => {
  vi.stubGlobal("Blob", NativeBlob);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const name = url.includes("regular")
        ? "fv-sans-regular.woff"
        : "fv-sans-bold.woff";
      const bytes = await readFile(resolve("src/assets/fonts", name));

      return {
        ok: true,
        arrayBuffer: async () =>
          bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength
          ),
      };
    })
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PDF коллекции", () => {
  it("открывает для печати действительный PDF после подготовки файла", async () => {
    let printed: Blob | undefined;
    vi.stubGlobal("URL", {
      createObjectURL: (blob: Blob) => {
        printed = blob;

        return "blob:print-test";
      },
    });
    const popup = { location: { href: "" }, close: vi.fn() };
    const result = await createCollectionPdf(
      { ...report, movies: report.movies.slice(0, 1) },
      {
        posters: false,
        timezone: "UTC",
        completedOnly: true,
        signal: new AbortController().signal,
      }
    );
    await result.print(popup as unknown as Window);
    expect(popup.location.href).toBe("blob:print-test");
    const bytes = Buffer.from(await printed!.arrayBuffer()).toString("latin1");
    expect(bytes).toContain("/OpenAction");
    expect(bytes).toContain("/N /Print");
  });

  it("встраивает миниатюру в PDF, не отправляя адрес страницы источнику постера", async () => {
    const requests: Array<{ url: string; referrer: string; cors: string }> = [];
    const dimensions: number[][] = [];
    const image = await readFile(resolve("public/pwa-192.png"));
    vi.stubGlobal(
      "Image",
      class {
        crossOrigin = "";
        referrerPolicy = "";
        naturalWidth = 192;
        naturalHeight = 192;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(url: string) {
          if (!url) return;
          requests.push({
            url,
            referrer: this.referrerPolicy,
            cors: this.crossOrigin,
          });
          queueMicrotask(() => this.onload?.());
        }
      }
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      function (this: HTMLCanvasElement) {
        dimensions.push([this.width, this.height]);

        return { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D;
      }
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      `data:image/png;base64,${image.toString("base64")}`
    );
    const result = await createCollectionPdf(
      {
        ...report,
        movies: [
          {
            ...report.movies[0],
            posterUrl: "https://poster.example/image.png",
          },
        ],
      },
      {
        posters: true,
        timezone: "UTC",
        completedOnly: true,
        signal: new AbortController().signal,
      }
    );
    const bytes = Buffer.from(await result.blob.arrayBuffer());
    expect(bytes.toString("latin1")).toContain("/Subtype /Image");
    expect(result.missingPosters).toBe(0);
    expect(requests).toEqual([
      {
        url: "https://poster.example/image.png",
        referrer: "no-referrer",
        cors: "anonymous",
      },
    ]);
    expect(dimensions).toEqual([[160, 160]]);
    let printed: Blob | undefined;
    vi.stubGlobal("URL", {
      createObjectURL: (blob: Blob) => {
        printed = blob;

        return "blob:poster-print-test";
      },
    });
    const popup = { location: { href: "" }, close: vi.fn() };
    await result.print(popup as unknown as Window);
    const printBytes = Buffer.from(await printed!.arrayBuffer()).toString(
      "latin1"
    );
    expect(printBytes).toContain("/Subtype /Image");
    expect(printBytes).toContain("/N /Print");
  });

  it("формирует настоящий многостраничный PDF со шрифтом сайта и кириллицей", async () => {
    const result = await createCollectionPdf(report, {
      posters: false,
      timezone: "Asia/Samarkand",
      completedOnly: true,
      signal: new AbortController().signal,
    });
    expect(result.blob.type).toBe("application/pdf");
    const bytes = Buffer.from(await result.blob.arrayBuffer());
    const text = bytes.toString("latin1");
    expect(text.startsWith("%PDF-")).toBe(true);
    expect((text.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
    expect(text).toMatch(/\/FontFile[23]\b/);
    expect(result.missingPosters).toBe(0);
    await writeFile(
      "/private/tmp/favourite-collection-pdf-verified.pdf",
      bytes
    );
  });

  it("сохраняет документ с иллюстрированными обложками, если постеров нет", async () => {
    const result = await createCollectionPdf(
      { ...report, movies: report.movies.slice(0, 2) },
      {
        posters: true,
        timezone: "UTC",
        completedOnly: true,
        signal: new AbortController().signal,
      }
    );
    expect(result.missingPosters).toBe(2);
    expect(result.blob.size).toBeGreaterThan(1000);
    await writeFile("/private/tmp/favourite-illustrated-posters.pdf", Buffer.from(await result.blob.arrayBuffer()));
  });

  it("не формирует документ после отмены", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      createCollectionPdf(report, {
        posters: true,
        timezone: "UTC",
        completedOnly: true,
        signal: controller.signal,
      })
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
