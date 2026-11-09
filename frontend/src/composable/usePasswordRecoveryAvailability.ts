import {
  computed,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  type ComputedRef,
} from "vue";
import api from "@/services/api";

export function usePasswordRecoveryAvailability(): {
  enabled: ComputedRef<boolean>;
  checking: ComputedRef<boolean>;
  failed: ComputedRef<boolean>;
  load: () => Promise<void>;
} {
  const status = shallowRef<"checking" | "enabled" | "disabled" | "error">(
    "checking"
  );
  const enabled = computed(() => status.value === "enabled");
  const checking = computed(() => status.value === "checking");
  const failed = computed(() => status.value === "error");
  let controller: AbortController | undefined;

  async function load(): Promise<void> {
    controller?.abort();

    const current = new AbortController();

    controller = current;
    status.value = "checking";
    try {
      const { data } = await api.get<{ passwordRecovery?: unknown }>(
        "/auth/password/capabilities",
        { signal: current.signal, timeout: 10000 }
      );

      if (!current.signal.aborted)
        status.value = data?.passwordRecovery === true ? "enabled" : "disabled";
    } catch {
      if (!current.signal.aborted) status.value = "error";
    }
  }

  onMounted(() => void load());
  onBeforeUnmount(() => controller?.abort());

  return { enabled, checking, failed, load };
}
