import regularFontUrl from "@/assets/fonts/fv-sans-regular.woff?url";
import boldFontUrl from "@/assets/fonts/fv-sans-bold.woff?url";
import type { CollectionReport } from "./collectionFiles";
import { contentTypeLabel } from "@/utils/content-kind";
import { formatInstant } from "@/utils/date.utils";
import { pluralize, PLURAL } from "@/utils/plural.utils";
import { fallbackPosterSvg } from "@/utils/fallbackPoster";

interface PdfOptions {
  posters: boolean;
  timezone: string;
  completedOnly: boolean;
  signal: AbortSignal;
}

function checkCancelled(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException("Отменено", "AbortError");
}

function base64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let text = "";

  for (let offset = 0; offset < bytes.length; offset += 32768) {
    text += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  }

  return btoa(text);
}

async function font(url: string, signal: AbortSignal): Promise<string> {
  const response = await fetch(url, {
    signal,
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });

  if (!response.ok) throw new Error("Не удалось загрузить шрифт PDF");

  return base64(await response.arrayBuffer());
}

function poster(
  raw: string | null,
  signal: AbortSignal
): Promise<string | null> {
  if (!raw) return Promise.resolve(null);

  let url: URL;

  try {
    url = new URL(raw, location.href);
  } catch {
    return Promise.resolve(null);
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const image = new Image();
    let settled = false;
    const finish = (value: string | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      image.onload = null;
      image.onerror = null;
      resolve(value);
    };

    const cancel = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      image.onload = null;
      image.onerror = null;
      image.src = "";
      reject(new DOMException("Отменено", "AbortError"));
    };

    const timer = setTimeout(() => {
      finish(null);
      image.src = "";
    }, 5000);

    image.crossOrigin = "anonymous";
    image.referrerPolicy = "no-referrer";
    image.onload = () => {
      try {
        if (!image.naturalWidth || !image.naturalHeight) return finish(null);

        const scale = Math.min(
          160 / image.naturalWidth,
          240 / image.naturalHeight,
          1
        );
        const canvas = document.createElement("canvas");

        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

        const context = canvas.getContext("2d");

        if (!context) return finish(null);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        finish(canvas.toDataURL("image/jpeg", 0.8));
      } catch {
        finish(null);
      }
    };

    image.onerror = () => finish(null);
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel();
    else image.src = url.href;
  });
}

export async function createCollectionPdf(
  report: CollectionReport,
  options: PdfOptions
): Promise<{
  blob: Blob;
  print: (window: Window) => Promise<void>;
  missingPosters: number;
}> {
  checkCancelled(options.signal);

  const [{ default: pdfmake }, regular, bold] = await Promise.all([
    import("pdfmake/build/pdfmake.min"),
    font(regularFontUrl, options.signal),
    font(boldFontUrl, options.signal),
  ]);

  checkCancelled(options.signal);
  pdfmake.addVirtualFileSystem({
    "Favorite-Regular.woff": regular,
    "Favorite-Bold.woff": bold,
  });

  pdfmake.addFonts({
    Favorite: {
      normal: "Favorite-Regular.woff",
      bold: "Favorite-Bold.woff",
      italics: "Favorite-Regular.woff",
      bolditalics: "Favorite-Bold.woff",
    },
  });

  pdfmake.setUrlAccessPolicy(() => false);

  const images: Array<string | null> = Array(report.movies.length).fill(null);

  if (options.posters) {
    let next = 0;
    const deadline = Date.now() + 15000;

    await Promise.all(
      Array.from({ length: Math.min(4, report.movies.length) }, async () => {
        while (next < report.movies.length && Date.now() < deadline) {
          checkCancelled(options.signal);

          const index = next++;

          images[index] = await poster(
            report.movies[index].posterUrl,
            options.signal
          );
        }
      })
    );
  }

  checkCancelled(options.signal);

  const date = (value: string | null): string =>
    value
      ? formatInstant(value, options.timezone, {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "Дата не указана";
  const statuses: Record<string, string> = {
    NOT_STARTED: "Не начато",
    WATCHING: "Смотрю",
    COMPLETED: "Просмотрено",
    DROPPED: "Брошено",
  };
  const body = report.movies.map((movie, index) => {
    const title = {
      stack: [
        { text: movie.title, bold: true, fontSize: 11, margin: [0, 0, 0, 5] },
        {
          text: [movie.year, contentTypeLabel(movie)]
            .filter((value) => value !== null)
            .join(" · "),
          color: "#626b78",
          fontSize: 9,
        },
        ...(!options.completedOnly
          ? [
              {
                text: statuses[movie.watchStatus] ?? movie.watchStatus,
                fontSize: 9,
                color: "#626b78",
                margin: [0, 5, 0, 0],
              },
            ]
          : []),
      ],
    };
    const rating = {
      stack: [
        {
          text:
            movie.personalRate === null || movie.personalRate === 0
              ? "Без оценки"
              : `${movie.personalRate}/10`,
          bold: true,
          alignment: "right",
          fontSize: 10,
        },
        {
          text: date(movie.completedAt),
          alignment: "right",
          color: "#626b78",
          fontSize: 9,
          margin: [0, 6, 0, 0],
        },
      ],
    };
    const image = images[index]
      ? { image: images[index], fit: [44, 66] }
      : {
          svg: fallbackPosterSvg(movie.title, "light"),
          width: 44,
          height: 66,
        };

    return options.posters ? [image, title, rating] : [title, rating];
  });
  const createDocument = () =>
    pdfmake.createPdf({
      pageSize: "A4",
      pageMargins: [36, 38, 36, 42],
      defaultStyle: { font: "Favorite", fontSize: 10, color: "#1d2023" },
      info: {
        title: options.completedOnly
          ? "Просмотрено — Favorite"
          : "Моя коллекция — Favorite",
      },
      content: [
        {
          text: options.completedOnly ? "Просмотрено" : "Моя коллекция",
          fontSize: 24,
          bold: true,
          margin: [0, 0, 0, 6],
        },
        {
          text: `${pluralize(report.movies.length, PLURAL.title)} · ${date(
            report.exportedAt
          )}`,
          color: "#626b78",
          margin: [0, 0, 0, 22],
        },
        {
          table: {
            widths: options.posters ? [48, "*", 88] : ["*", 88],
            // pdfmake заменяет data URL картинок внутренними ссылками при генерации.
            body: structuredClone(body),
            dontBreakRows: true,
          },
          layout: {
            hLineWidth: () => 0,
            vLineWidth: () => 0,
            paddingLeft: () => 0,
            paddingRight: () => 10,
            paddingTop: () => 6,
            paddingBottom: () => 12,
          },
        },
      ],
      footer: (page: number, total: number) => ({
        text: `Favorite · ${page} / ${total}`,
        alignment: "center",
        fontSize: 8,
        color: "#626b78",
        margin: [0, 14, 0, 0],
      }),
    });
  const blob = await createDocument().getBlob();

  checkCancelled(options.signal);

  return {
    blob,
    print: (window) => createDocument().print(window),
    missingPosters: options.posters
      ? images.filter((image) => !image).length
      : 0,
  };
}
