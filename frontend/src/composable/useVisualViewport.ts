import { onMounted, onScopeDispose, shallowRef, type CSSProperties } from "vue";

export function useVisualViewport(placement: "overlay" | "bottom" = "overlay") {
  const style = shallowRef<CSSProperties>();
  const viewport = window.visualViewport;
  const update = (): void => {
    if (!viewport || viewport.scale !== 1) {
      style.value = undefined;

      return;
    }

    // Safari can retain a wrong bottom: 0 anchor after dismissing the keyboard.
    style.value =
      placement === "bottom"
        ? {
            top: `${viewport.offsetTop + viewport.height}px`,
            bottom: "auto",
            transform: "translateY(-100%)",
          }
        : {
            top: `${viewport.offsetTop}px`,
            height: `${viewport.height}px`,
            bottom: "auto",
          };
  };

  onMounted(() => {
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);

    if (placement === "bottom") {
      window.addEventListener("resize", update);
      window.addEventListener("scroll", update, { passive: true });
    }
  });

  onScopeDispose(() => {
    viewport?.removeEventListener("resize", update);
    viewport?.removeEventListener("scroll", update);

    if (placement === "bottom") {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
    }
  });

  return style;
}
