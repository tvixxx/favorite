import { onBeforeUnmount, onMounted, ref, type Ref } from "vue";
import api from "@/services/api";

export function usePasswordRecoveryAvailability(): {
  enabled: Ref<boolean>;
  checking: Ref<boolean>;
  failed: Ref<boolean>;
  load: () => Promise<void>;
} {
  const enabled = ref(false);
  const checking = ref(true);
  const failed = ref(false);
  let controller: AbortController | undefined;

  async function load(): Promise<void> {
    controller?.abort();
    const current = new AbortController();
    controller = current;
    enabled.value = false;
    checking.value = true;
    failed.value = false;
    try {
      const { data } = await api.get<{ passwordRecovery?: unknown }>(
        "/auth/password/capabilities",
        { signal: current.signal, timeout: 10000 }
      );
      if (!current.signal.aborted) enabled.value = data?.passwordRecovery === true;
    } catch {
      if (!current.signal.aborted) failed.value = true;
    } finally {
      if (!current.signal.aborted) checking.value = false;
    }
  }

  onMounted(() => void load());
  onBeforeUnmount(() => controller?.abort());

  return { enabled, checking, failed, load };
}
