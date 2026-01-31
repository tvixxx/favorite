<script lang="ts" setup>
import { computed, onMounted } from "vue";
import NavigationLinks from "@/components/NavigationLinks.vue";
import { useMainStore } from "@/state/state";
import { ConfigProvider } from "ant-design-vue";
import { themeConfig, useHotThemeKeys, useTheme } from "@/composable";

const store = useMainStore();

const isAuthLoaded = computed(() => store.user.isAuthLoaded);
const showNavMenu = computed(() => isAuthLoaded.value && store.isLoggedIn);

onMounted(async () => {
  useTheme();
  useHotThemeKeys();

  if (!isAuthLoaded.value) {
    await store.fetchUser();
  }
});
</script>

<template>
  <ConfigProvider :theme="themeConfig">
    <NavigationLinks v-if="showNavMenu" />

    <Suspense>
      <router-view />
      <template #fallback>
        <div>Загрузка...</div>
      </template>
    </Suspense>
  </ConfigProvider>
</template>

<style lang="scss">
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  width: 100%;
  height: 100%;
}

body {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
</style>
