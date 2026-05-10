<script lang="ts" setup>
import { computed, onMounted, watch } from "vue";
import NavigationLinks from "@/components/NavigationLinks/NavigationLinks.vue";
import { useMainStore } from "@/state/state";
import { ConfigProvider } from "ant-design-vue";
import { themeConfig, useHotThemeKeys, useTheme } from "@/composable";
import { useChatStore } from "@/stores/chat/chatStore";
import { useNotificationsStore } from "@/stores/notifications/notificationsStore";

const store = useMainStore();
const chatStore = useChatStore();
const notificationsStore = useNotificationsStore();

const isAuthLoaded = computed(() => store.user.isAuthLoaded);
const showNavMenu = computed(() => isAuthLoaded.value && store.isLoggedIn);

watch(
  () => ({
    authLoaded: store.user.isAuthLoaded,
    loggedIn: store.isLoggedIn,
    userId: store.userData?.id,
  }),
  async ({ authLoaded, loggedIn, userId }) => {
    if (!authLoaded) {
      return;
    }

    if (loggedIn && userId) {
      chatStore.connect(userId);

      try {
        await notificationsStore.hydrate(userId);
      } catch {
        // список уведомлений не блокирует приложение
      }
    } else {
      chatStore.disconnect();
      notificationsStore.resetSession();
    }
  },
  { immediate: true },
);

onMounted(async () => {
  useTheme();
  useHotThemeKeys();

  if (!isAuthLoaded.value) {
    try {
      await store.fetchUser();
      // eslint-disable-next-line
    } catch {}
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
