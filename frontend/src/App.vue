<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useOnline } from "@vueuse/core";
import NavigationLinks from "@/components/NavigationLinks/NavigationLinks.vue";
import MobileTabBar from "@/components/MobileTabBar/MobileTabBar.vue";
import OnboardingModal from "@/components/Onboarding/OnboardingModal.vue";
import AppSpinner from "@/components/AppSpinner/AppSpinner.vue";
import PwaStatus from "@/components/PwaStatus/PwaStatus.vue";
import StateBlock from "@/components/StateBlock/StateBlock.vue";
import { useMainStore } from "@/state/state";
import { ConfigProvider } from "ant-design-vue";
import { themeConfig, useHotThemeKeys, useTheme } from "@/composable";
import { getOnboardingDone } from "@/composable/useOnboarding";
import { useChatStore } from "@/stores/chat/chatStore";
import { useNotificationsStore } from "@/stores/notifications/notificationsStore";

const store = useMainStore();
const chatStore = useChatStore();
const notificationsStore = useNotificationsStore();

const route = useRoute();
const router = useRouter();
const online = useOnline();

async function retryAuth(): Promise<void> {
  if (store.isFetchingUser) {
    return;
  }

  try {
    await store.fetchUser();
    if (store.isLoggedIn) {
      const target = route.query.redirect;

      await router.replace(
        typeof target === "string" &&
          target.startsWith("/") &&
          !target.startsWith("//")
          ? target
          : "/library/collection"
      );
    }
  } catch {
    // Экран повторной попытки остаётся видимым, данные форм не перезагружаем.
  }
}

watch(online, (connected) => {
  if (connected && store.authUnavailable) {
    void retryAuth();
  }
});

const isAuthLoaded = computed(() => store.user.isAuthLoaded);

// Гостевые экраны (вход/регистрация) — без шапки и таб-бара, даже если
// состояние авторизации ещё «догоняет»
const isGuestRoute = computed(() =>
  route.matched.some((record) => record.meta.guest || record.meta.authScreen),
);

const showNavMenu = computed(
  () => isAuthLoaded.value && store.isLoggedIn && !isGuestRoute.value,
);

// Экраны со своей нижней панелью действий (детальная) прячут таб-бар
const hideMobileTabBar = computed(() =>
  route.matched.some((record) => record.meta.hideMobileTabBar),
);

const onboardingOpen = ref(false);

watch(
  [() => store.user.isAuthLoaded, () => store.isLoggedIn, () => store.userData?.id],
  ([authLoaded, loggedIn, userId]) => {
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
  [() => store.user.isAuthLoaded, () => store.isLoggedIn, () => store.userData?.id],
  async ([authLoaded, loggedIn, userId]) => {
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

useTheme();
useHotThemeKeys();
</script>

<template>
  <ConfigProvider :theme="themeConfig">
    <NavigationLinks v-if="showNavMenu" />
    <MobileTabBar v-if="showNavMenu && !hideMobileTabBar" />
    <PwaStatus />

    <OnboardingModal
      v-if="store.userData?.id && !isGuestRoute"
      v-model:open="onboardingOpen"
      :user-id="store.userData.id"
    />

    <StateBlock
      v-if="store.authUnavailable"
      variant="error"
      icon="ph:wifi-slash"
      title="Не удалось подключиться"
      description="Проверьте соединение и повторите загрузку. Проверим вход, когда сервер станет доступен."
      :actions="[
        {
          label: 'Повторить',
          onClick: retryAuth,
          loading: store.isFetchingUser,
        },
      ]"
    />
    <Suspense v-else>
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
@use "./styles/media" as *;
#app {
  font-family: var(--fv-font-ui);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
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

/* Канва темы должна доходить до html: иначе при оверскролле (в том числе
   инерционном на macOS) из-под контента проступает белый фон браузера */
html,
body {
  background: var(--fv-color-bg-secondary);
}

body {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* Видимый фокус для клавиатуры (эталон: двойное кольцо — «вырез» фоном + синий контур).
   Поля обслуживает forms.scss, компоненты со своим фокусом переопределяют правило сами. */
:where(button, a, [role="button"], [tabindex]:not([tabindex="-1"])):focus-visible {
  outline: none;
  box-shadow:
    0 0 0 3px var(--fv-color-bg-primary),
    0 0 0 5px var(--fv-color-accent);
}

/* Место под нижний таб-бар на мобиле, чтобы контент не прятался */
@include mediaMax($tablet) {
  #app {
    padding-bottom: calc(82px + env(safe-area-inset-bottom, 0px));
  }

  /* Экраны со своей нижней панелью (детальная, обратная связь):
     таб-бар скрыт, значит место под него не нужно */
  #app:has(.detail-actionbar),
  #app:has(.feedback-actionbar),
  #app:has(.cm-footer) {
    padding-bottom: 0;
  }

  #app:has(.auth-page) { padding-bottom: 0; }
}
</style>
