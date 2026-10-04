import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import { friendlyRequestError, getRequestStatus } from "./friendlyError";

describe("Понятные ошибки API", () => {
  it("сохраняет HTTP статус внутри обёрнутой ошибки", () => {
    const error = new Error("Operation failed", { cause: { response: { status: 409 } } });
    expect(getRequestStatus(error)).toBe(409);
    expect(friendlyRequestError(error, { byStatus: { 409: "Уже добавлено" } })).toBe("Уже добавлено");
  });
  it("не объявляет локальную ошибку отсутствием интернета", () => {
    expect(friendlyRequestError(new Error("Local validation"), { fallback: "Проверьте данные" })).toBe("Проверьте данные");
  });
  it("распознаёт настоящую сетевую ошибку axios", () => {
    expect(friendlyRequestError(new AxiosError("Network error", "ERR_NETWORK"))).toContain("Проверьте интернет");
  });
});
