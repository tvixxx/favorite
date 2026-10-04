import { effectScope, ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useChatMovie } from "./useChatMovie";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/composable", () => ({ useFetch: mocks.fetch, FETCH_METHOD: { get: "GET" } }));

describe("Карточки фильмов в сообщениях", () => {
  const scopes: ReturnType<typeof effectScope>[] = [];
  afterEach(() => { scopes.forEach((scope) => scope.stop()); scopes.length = 0; mocks.fetch.mockReset(); });

  it("не подменяет новый id поздним ответом старого фильма", async () => {
    let finish!: (value: unknown) => void;
    mocks.fetch.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    mocks.fetch.mockResolvedValueOnce({ status: 200, data: { id: "new-chat-movie", title: "Новый", genres: [], countryCodes: [], isSerial: false, poster: null } });
    const scope = effectScope(); scopes.push(scope);
    const id = ref("old-chat-movie");
    const movie = scope.run(() => useChatMovie(id))!;
    id.value = "new-chat-movie";
    await flushPromises();
    finish({ status: 200, data: { id: "old-chat-movie", title: "Старый", genres: [], countryCodes: [], isSerial: false, poster: null } });
    await flushPromises();
    expect(movie.value?.id).toBe("new-chat-movie");
  });

  it("позволяет повторить загрузку после временной сетевой ошибки", async () => {
    mocks.fetch.mockRejectedValueOnce(new Error("Temporary network failure"));
    const firstScope = effectScope(); scopes.push(firstScope);
    firstScope.run(() => useChatMovie(ref("retry-chat-movie")));
    await flushPromises();
    firstScope.stop();
    mocks.fetch.mockResolvedValueOnce({ status: 200, data: { id: "retry-chat-movie", title: "Восстановлен", genres: [], countryCodes: [], isSerial: false, poster: null } });
    const secondScope = effectScope(); scopes.push(secondScope);
    const restored = secondScope.run(() => useChatMovie(ref("retry-chat-movie")))!;
    await flushPromises();
    expect(restored.value?.id).toBe("retry-chat-movie");
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
});
