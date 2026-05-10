<script lang="ts" setup>
import SettingBlock from "@/components/ProfileSettings/components/SettingBlock/SettingBlock.vue";
import { onMounted, computed } from "vue";
import { useUserMoviesStore } from "@/stores";
import { useMainStore } from "@/state/state";
import { SETTING_BLOCKS } from "@/components/ProfileSettings/constants";
import type { SettingBlockType } from "@/shared/profile/profile.types";

const userMoviesStore = useUserMoviesStore();
const mainStore = useMainStore();

const props = withDefaults(
  defineProps<{
    types?: SettingBlockType[];
  }>(),
  {
    types: () => ["theme", "stats", "friends"],
  }
);

const userId = computed(() => mainStore.userData?.id || "");
const selectedBlocks = computed(() => {
  return SETTING_BLOCKS.filter((item) => props.types.includes(item.type));
});
const hasStatsBlock = computed(() => props.types.includes("stats"));

onMounted(async () => {
  if (hasStatsBlock.value && userId.value) {
    await userMoviesStore.fetchUserMoviesStats(userId.value);
  }
});
</script>

<template>
  <aside class="settings-card">
    <div
      class="settings-card__widget"
      v-for="item in selectedBlocks"
      :key="item.type"
    >
      <SettingBlock
        :title="item.title"
        :description="item.description"
        :type="item.type"
        :icon="item.icon"
      />
    </div>
  </aside>
</template>

<style scoped lang="scss">
@use "../../styles/media" as *;

.settings-card {
  height: fit-content;
  background: var(--bg-primary);
  border-radius: 24px;
  box-shadow: var(--shadow), 0 20px 40px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-color);
  padding: 1.5rem;

  @include mediaMobileXL {
    padding: 1.25rem;
  }

  &__widget {
    position: relative;
    border-radius: 14px;
    padding: 0.75rem;
    background: color-mix(in srgb, var(--bg-secondary) 58%, transparent);
    border: 1px solid color-mix(in srgb, var(--border-color) 70%, transparent);

    & + & {
      margin-top: 0.9rem;

      &::before {
        display: none;
      }
    }
  }
}
</style>
