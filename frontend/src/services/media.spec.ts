import { describe, expect, it, vi } from "vitest";
import { uploadImage } from "./media";
const mocks = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock("./api", () => ({ default: { post: mocks.post } }));

describe("Передача файла", () => {
  it("использует FormData и не оставляет JSON Content-Type", async () => {
    mocks.post.mockResolvedValue({
      data: { id: "asset-id", url: "https://media.example.test/image.webp" },
    });
    const file = new File(["fixture"], "poster.png", { type: "image/png" });

    await uploadImage(file, "MOVIE_POSTER", {});
    const [url, data, config] = mocks.post.mock.calls[0];

    expect(url).toBe("/uploads/images");
    expect(data).toBeInstanceOf(FormData);
    expect(data.get("file").name).toBe("poster.png");
    expect(data.get("purpose")).toBe("MOVIE_POSTER");
    expect(config.headers["Content-Type"]).toBeUndefined();
  });
});
