<script lang="ts" setup>
import { computed, onMounted, ref, watch } from "vue";
import NavigationLinks from "@/components/NavigationLinks/NavigationLinks.vue";
import OnboardingModal from "@/components/Onboarding/OnboardingModal.vue";
import { useMainStore } from "@/state/state";
import { ConfigProvider } from "ant-design-vue";
import { themeConfig, useHotThemeKeys, useTheme } from "@/composable";
import { getOnboardingDone } from "@/composable/useOnboarding";
import { useChatStore } from "@/stores/chat/chatStore";
import { useNotificationsStore } from "@/stores/notifications/notificationsStore";

const store = useMainStore();
const chatStore = useChatStore();
const notificationsStore = useNotificationsStore();

const isAuthLoaded = computed(() => store.user.isAuthLoaded);
const showNavMenu = computed(() => isAuthLoaded.value && store.isLoggedIn);

const onboardingOpen = ref(false);

watch(
  () => ({
    authLoaded: store.user.isAuthLoaded,
    loggedIn: store.isLoggedIn,
    userId: store.userData?.id,
  }),
  ({ authLoaded, loggedIn, userId }) => {
    if (!authLoaded || !loggedIn || !userId) {
      onboardingOpen.value = false;

      return;
    }

    if (!getOnboardingDone(userId)) {
      onboardingOpen.value = true;
    }
  },
  { immediate: true },
);

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

    <OnboardingModal
      v-if="store.userData?.id"
      v-model:open="onboardingOpen"
      :user-id="store.userData.id"
    />

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
