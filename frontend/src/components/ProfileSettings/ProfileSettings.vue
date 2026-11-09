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
.settings-card {
  height: fit-content;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: clamp(14px, 2vw, 20px);
  background: var(--fv-color-bg-primary);
  border-radius: var(--fv-radius-lg);
  box-shadow: var(--fv-shadow-card);
  border: 1px solid var(--fv-color-border);

  &__widget + &__widget {
    border-top: 1px solid var(--fv-color-border);
    padding-top: 12px;
  }
}
</style>
