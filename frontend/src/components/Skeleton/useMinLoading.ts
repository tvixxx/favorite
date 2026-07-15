import { onUnmounted, ref, watch, type Ref } from "vue";

/**
 * Минимальная длительность показа скелетона.
 *
 * Шиммер появляется СРАЗУ при начале загрузки и держится минимум `minMs`,
 * даже если данные пришли раньше — чтобы не мигал. То есть откладывается
 * переход «шиммер → контент», а не показ самого шиммера.
 *
 * @param source геттер флага загрузки, напр. `() => store.isLoading`
 */
export function useMinLoading(source: () => boolean, minMs = 400): Ref<boolean> {
  const shown = ref(false);
  let shownAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  watch(
    source,
    (loading) => {
      clearTimeout(timer);

      if (loading) {
        if (!shown.value) {
          shown.value = true;
          shownAt = Date.now();
        }

        return;
      }

      if (shown.value) {
        const elapsed = Date.now() - shownAt;

        if (elapsed >= minMs) {
          shown.value = false;
        } else {
          timer = setTimeout(() => {
            shown.value = false;
          }, minMs - elapsed);
        }
      }
    },
    { immediate: true },
  );

  onUnmounted(() => clearTimeout(timer));

  return shown;
}
