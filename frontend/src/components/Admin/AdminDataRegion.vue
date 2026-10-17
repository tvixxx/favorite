<script setup lang="ts">
import AppSpinner from "@/components/AppSpinner/AppSpinner.vue";
defineProps<{ loading: boolean }>();
</script>

<template>
  <div class="admin-data-region" :aria-busy="loading">
    <div v-if="loading" class="admin-data-region__loading">
      <div class="admin-data-region__status">
        <AppSpinner :size="32" />
        <span>Загрузка данных…</span>
      </div>
    </div>
    <div
      :inert="loading"
      :aria-hidden="loading || undefined"
      :style="{ visibility: loading ? 'hidden' : undefined }"
    >
      <slot />
    </div>
  </div>
</template>

<style scoped lang="scss">
.admin-data-region {
  position: relative;
  min-height: 160px;

  &__loading {
    position: absolute;
    inset: 0;
  }

  &__status {
    position: sticky;
    top: 80px;
    height: 160px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--fv-color-text-secondary);
    font-size: 14px;
  }
}
</style>
