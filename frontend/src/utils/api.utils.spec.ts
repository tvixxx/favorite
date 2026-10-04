import { describe, expect, it } from "vitest";
import { isSuccessStatus, isErrorStatus } from "./api.utils";

describe("Классификация HTTP статусов", () => {
  it.each([200, 201, 202, 204, 206])("считает %s успешным ответом", (status) => {
    expect(isSuccessStatus(status)).toBe(true);
  });
  it.each([400, 401, 403, 404, 409, 422, 429, 500, 503])("считает %s ошибкой API", (status) => {
    expect(isErrorStatus(status)).toBe(true);
    expect(isSuccessStatus(status)).toBe(false);
  });
});
