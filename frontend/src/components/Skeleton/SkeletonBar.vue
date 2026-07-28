<script setup lang="ts">
interface Props {
  width?: string;
  height?: string;
  radius?: string;
  /** aspect-ratio, напр. "2/3" */
  aspect?: string;
  circle?: boolean;
}

const {
  width = "100%",
  height = "",
  radius = "10px",
  aspect = "",
  circle = false,
} = defineProps<Props>();
</script>

<template>
  <span
    class="skel"
    :style="{
      width,
      height: height || undefined,
      borderRadius: circle ? '50%' : radius,
      aspectRatio: aspect || undefined,
    }"
  />
</template>

<style scoped lang="scss">
/* Примитив-плейсхолдер загрузки (эталон): бегущий шиммер */
.skel {
  display: block;
  position: relative;
  overflow: hidden;
  background: var(--fv-skeleton-base);
}

.skel::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(
    90deg,
    transparent,
    var(--fv-skeleton-sweep),
    transparent
  );
  animation: skel-sh 1.45s ease-in-out infinite;
}

@keyframes skel-sh {
  100% {
    transform: translateX(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .skel::after {
    animation: none;
  }
}
</style>
