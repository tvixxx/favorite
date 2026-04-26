<script lang="ts" setup>
import SettingBlock from "@/components/ProfileSettings/components/SettingBlock/SettingBlock.vue";
import { onMounted, computed } from "vue";
import { useUserMoviesStore } from "@/stores";
import { useMainStore } from "@/state/state";
import { SETTING_BLOCKS } from "@/components/ProfileSettings/constants";

const userMoviesStore = useUserMoviesStore();
const mainStore = useMainStore();

const userId = computed(() => mainStore.userData?.id || "");

onMounted(async () => {
  if (userId.value) {
    await userMoviesStore.fetchUserMoviesStats(userId.value);
  }
});
</script>

<template>
  <aside class="settings-card">
    <div
      class="settings-card__widget"
      v-for="item in SETTING_BLOCKS"
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
  padding: 2.5rem;

  @include mediaMobileXL {
    padding: 2rem;
  }

  &__widget {
    position: relative;

    & + & {
      margin-top: 2rem;
      padding-top: 1rem;

      &::before {
        position: absolute;
        content: "";
        width: 100%;
        height: 1px;
        left: 0;
        right: 0;
        top: 0;
        transform: translateY(-50%);
        background: rgba(0, 0, 0, 0.2);
        opacity: 1;
        z-index: 0;
        border-radius: 50%;
      }
    }
  }
}
</style>
