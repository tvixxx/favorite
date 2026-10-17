import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { probePoster } from "./catalogQuality";

const images: FakeImage[] = [];
const imageRequests: { url: string; referrerPolicy: string }[] = [];
class FakeImage {
  private source = "";
  public get src(): string { return this.source; }
  public set src(url: string) {
    this.source = url;
    imageRequests.push({ url, referrerPolicy: this.referrerPolicy });
  }
  naturalWidth = 32;
  referrerPolicy = "";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    images.push(this);
  }
}
describe("Доступность внешнего постера в браузере", () => {
  beforeEach(() => {
    images.length = 0;
    imageRequests.length = 0;
    vi.useFakeTimers();
    vi.stubGlobal("Image", FakeImage);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  it("подтверждает успешно загруженное изображение", async () => {
    const result = probePoster(
      "https://images.example.test/ok.webp",
      new AbortController().signal
    );
    images[0].onload?.();
    await expect(result).resolves.toBe("loaded");
    expect(vi.getTimerCount()).toBe(0);
  });
  it("начинает загрузку внешнего постера без передачи адреса страницы", async () => {
    const result = probePoster(
      "https://images.example.test/private-page-poster.webp",
      new AbortController().signal
    );

    expect(imageRequests).toEqual([{
      url: "https://images.example.test/private-page-poster.webp",
      referrerPolicy: "no-referrer",
    }]);
    images[0].onload?.();
    await expect(result).resolves.toBe("loaded");
  });
  it("отличает ошибку изображения от истечения времени ожидания", async () => {
    const result = probePoster(
      "https://images.example.test/bad.webp",
      new AbortController().signal
    );
    images[0].onerror?.();
    await expect(result).resolves.toBe("unavailable");
    const slow = probePoster(
      "https://images.example.test/slow.webp",
      new AbortController().signal
    );
    await vi.advanceTimersByTimeAsync(8000);
    await expect(slow).resolves.toBe("timeout");
  });
  it("отмена освобождает ожидание и не выдаёт ошибку постера", async () => {
    const controller = new AbortController();
    const result = probePoster(
      "https://images.example.test/cancel.webp",
      controller.signal
    );
    const assertion = expect(result).rejects.toMatchObject({
      name: "AbortError",
    });
    controller.abort();
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });
  it("не начинает загрузку при заранее отменённой проверке", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      probePoster("https://images.example.test/cancel.webp", controller.signal)
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(images).toEqual([]);
  });
});
