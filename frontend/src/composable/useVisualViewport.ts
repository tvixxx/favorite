import { onMounted, onScopeDispose, shallowRef, type CSSProperties } from "vue";

export function useVisualViewport() {
  const style = shallowRef<CSSProperties>();
  const viewport = window.visualViewport;
  const update = (): void => {
    style.value =
      viewport && viewport.scale === 1
        ? {
            top: `${viewport.offsetTop}px`,
            height: `${viewport.height}px`,
            bottom: "auto",
          }
        : undefined;
  };

  onMounted(() => {
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
  });

  onScopeDispose(() => {
    viewport?.removeEventListener("resize", update);
    viewport?.removeEventListener("scroll", update);
  });

  return style;
}
