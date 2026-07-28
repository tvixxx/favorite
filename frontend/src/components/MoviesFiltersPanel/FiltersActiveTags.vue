<script setup lang="ts">
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";

/** Строка применённых фильтров: пилюля с крестиком на каждый + «Сбросить всё» (эталон) */
export type FilterTag = { key: string; label: string };

defineProps<{ tags: FilterTag[] }>();

const emit = defineEmits<{ remove: [key: string]; reset: [] }>();
</script>

<template>
  <div v-if="tags.length" class="ftags">
    <button
      v-for="tag in tags"
      :key="tag.key"
      type="button"
      class="ftags__tag"
      :aria-label="`Убрать фильтр: ${tag.label}`"
      @click="emit('remove', tag.key)"
    >
      {{ tag.label }}
      <BaseIcon name="ph:x" :width="13" :height="13" />
    </button>

    <button type="button" class="ftags__reset" @click="emit('reset')">
      Сбросить всё
    </button>
  </div>
</template>

<style lang="scss" scoped>
.ftags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 12px;

  &__tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 8px 0 13px;
    border: 0;
    border-radius: 999px;
    background: var(--fv-color-bg-active-soft);
    color: var(--fv-color-link);
    font: inherit;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;

    svg {
      opacity: 0.65;
    }

    &:hover svg {
      opacity: 1;
    }
  }

  &__reset {
    padding: 0 4px;
    border: 0;
    background: none;
    color: var(--fv-color-link);
    font: inherit;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
  }
}
</style>
