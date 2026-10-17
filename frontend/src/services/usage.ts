import { API_BASE_URL } from "@/constants/api/endpoints";
import { useMainStore } from "@/state/state";
import { usageFeature } from "./usage-feature";

export function trackUsage(url: string, method: string, data?: unknown): void {
  try {
    const feature = usageFeature(url, method, data);
    const token = useMainStore().accessToken;

    if (!feature || !token) {
      return;
    }

    void fetch(`${API_BASE_URL}/usage-events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id: crypto.randomUUID(), feature }),
      signal: AbortSignal.timeout(3000),
    }).catch(() => {});
  } catch {
    // Аналитика не должна менять результат пользовательского действия.
  }
}
