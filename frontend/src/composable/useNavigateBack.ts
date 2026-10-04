import { useRouter } from "vue-router";
import type { RouteLocationRaw } from "vue-router";

/**
 * Возврат внутри истории Vue Router с безопасным переходом при прямой ссылке.
 *
 * - Режим history: {@link router.back}, если предыдущий маршрут принадлежит приложению.
 *   При прямой ссылке заменяем текущую запись на fallback.
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

      if (!ok) {
        return;
      }
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

    const state = window.history.state as { back?: unknown } | null;
    const canGoBackInApp =
      typeof state?.back === "string" && state.back.startsWith("/") && !state.back.startsWith("//");

    if (fallback && !canGoBackInApp) {
      await router.replace(fallback);

      return;
    }

    router.back();
  }

  return { navigateBack };
}
