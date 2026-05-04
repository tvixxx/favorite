import { useRouter } from "vue-router";
import type { RouteLocationRaw } from "vue-router";

/**
 * Грамотный «назад» без лишних записей в истории.
 * @see https://habr.com/ru/articles/1023578/
 *
 * - Режим history: сначала {@link router.back}, если стека почти нет — переход на fallback (push).
 * - replace / push: явный переход без попытки history (удобно для «вверх» по разделу).
 */
export interface NavigateBackPayload {
  fallback?: RouteLocationRaw;
  mode?: "history" | "replace" | "push";
  beforeNavigate?: () => boolean | Promise<boolean>;
}

export function useNavigateBack() {
  const router = useRouter();

  async function navigateBack(
    payload: NavigateBackPayload = {},
  ): Promise<void> {
    const { fallback, mode = "history", beforeNavigate } = payload;

    if (beforeNavigate) {
      const ok = await beforeNavigate();
      if (!ok) return;
    }

    if (mode === "replace") {
      if (fallback) {
        await router.replace(fallback);
      } else {
        router.back();
      }
      return;
    }

    if (mode === "push") {
      if (fallback) {
        await router.push(fallback);
      } else {
        router.back();
      }
      return;
    }

    const state = window.history.state as { position?: number } | undefined;
    const canGoBackInApp =
      (typeof state?.position === "number" && state.position > 1) ||
      (typeof window.history.length === "number" && window.history.length > 1);

    if (fallback && !canGoBackInApp) {
      await router.push(fallback);
      return;
    }

    router.back();
  }

  return { navigateBack };
}
