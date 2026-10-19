import { onBeforeUnmount, onMounted, readonly, ref, type Ref } from "vue";
import api from "@/services/api";

export async function fetchFeedbackAvailability(
  signal?: AbortSignal
): Promise<boolean> {
  try {
    const { data } = await api.get<{ feedback?: unknown }>(
      "/feedback/capabilities",
      { signal, timeout: 10000 }
    );

    return data?.feedback === true;
  } catch {
    return false;
  }
}

export function useFeedbackAvailability(): { enabled: Readonly<Ref<boolean>> } {
  const enabled = ref(false);
  const controller = new AbortController();

  onMounted(async () => {
    const available = await fetchFeedbackAvailability(controller.signal);

    if (!controller.signal.aborted) enabled.value = available;
  });

  onBeforeUnmount(() => controller.abort());

  return { enabled: readonly(enabled) };
}
