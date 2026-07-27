<script lang="ts" setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import NavigationLinks from "@/components/NavigationLinks/NavigationLinks.vue";
import MobileTabBar from "@/components/MobileTabBar/MobileTabBar.vue";
import OnboardingModal from "@/components/Onboarding/OnboardingModal.vue";
import AppSpinner from "@/components/AppSpinner/AppSpinner.vue";
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

// Экраны со своей нижней панелью действий (детальная) прячут таб-бар
const route = useRoute();
const hideMobileTabBar = computed(() =>
  route.matched.some((record) => record.meta.hideMobileTabBar),
);

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

      // диалоги грузим при логине — чтобы счётчик непрочитанных был доступен
      // в навигации / таб-баре / хаб-чипе на всех экранах
      chatStore.fetchConversations(userId).catch(() => {
        // не блокирует приложение
      });

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
    <MobileTabBar v-if="showNavMenu && !hideMobileTabBar" />

    <OnboardingModal
      v-if="store.userData?.id"
      v-model:open="onboardingOpen"
      :user-id="store.userData.id"
    />

    <Suspense>
      <router-view />
      <template #fallback>
        <div class="app-suspense-fallback">
          <AppSpinner :size="32" />
        </div>
      </template>
    </Suspense>
  </ConfigProvider>
</template>

<style lang="scss">
#app {
  font-family: var(--fv-font-ui);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: var(--fv-color-text-primary);
  width: 100%;
  height: 100%;
}

/* Фолбэк ленивой подгрузки роутов — брендовый спиннер по центру, без «голого» текста */
.app-suspense-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}

body {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* Место под нижний таб-бар на мобиле, чтобы контент не прятался */
@media (max-width: 768px) {
  #app {
    padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px));
  }

  /* Экран со своей нижней панелью (детальная) — таб-бара нет, отступ не нужен */
  #app:has(.detail-actionbar) {
    padding-bottom: 0;
  }
}
</style>
