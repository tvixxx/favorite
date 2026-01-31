<script lang="ts" setup>
import { useMainStore } from "@/state/state";
import { useRouter } from "vue-router";

import { computed, ref } from "vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import type { SelectProps } from "ant-design-vue";
import { currentTheme, themes } from "@/composable";
import BaseModal from "@/components/BaseModal/BaseModal.vue";
import HeroHeader from "@/components/HeroHeader/HeroHeader.vue";
import type { UserData } from "@/state/types";

const store = useMainStore();
const router = useRouter();

const isModalVisible = ref(false);
const editForm = ref({ fullName: "" });

const user = computed<UserData | null>(() => store.userData ?? null);
const fullName = computed(() => store.userData?.fullName || "");
const showCard = computed(() => store.isLoggedIn);
const showContent = computed(() => showCard.value && user.value);

const initials = computed(() => {
  if (!user.value?.fullName) {
    return "U";
  }

  return user.value.fullName
    .split(" ")
    .map((n) => n.charAt(0).toUpperCase())
    .join("");
});

const shortId = computed(() => {
  if (user.value?.id) {
    return user.value?.id.split("-")[0];
  }

  return user.value?.id;
});

const themeOptions: SelectProps["options"] = themes.map((theme) => ({
  label: theme.charAt(0).toUpperCase() + theme.slice(1),
  value: theme,
}));

const filterOption = (input: string, option: any) => {
  return option.value.toLowerCase().indexOf(input.toLowerCase()) >= 0;
};

const goToLogin = () => {
  router.push("/login");
};

const updateName = async () => {
  await store.updateDisplayName(editForm.value.fullName);
  isModalVisible.value = false;
};

const showEditDisplayNameModal = () => {
  isModalVisible.value = true;
};
</script>

<template>
  <div class="profile-page">
    <HeroHeader
      v-if="showContent"
      title="Ваш КиноПрофиль"
      subtitle="Все ваши фильмы, статистика и настройки в одном месте"
      badge-text="Профиль"
      icon-name="mdi:account-star"
    />

    <div class="profile-page__content">
      <div v-if="showContent" class="profile-page__grid">
        <article class="user-card">
          <div class="user-card__avatar-section">
            <div class="user-card__avatar">
              <div class="user-card__avatar-initials">{{ initials }}</div>
            </div>
            <div class="user-card__info">
              <h2 class="user-card__name" @click="showEditDisplayNameModal">
                {{ fullName }}
              </h2>
              <template v-if="user">
                <div class="user-card__email">
                  <BaseIcon name="mdi:email" class="user-card__email-icon" />
                  {{ user.email }}
                </div>
                <div class="user-card__id">
                  <BaseIcon name="mdi:identifier" class="user-card__id-icon" />
                  <ATooltip :title="user?.id" placement="top">
                    <span class="user-card__short-id">{{ shortId }}</span>
                  </ATooltip>
                </div>
              </template>
            </div>
          </div>
        </article>

        <aside class="settings-card">
          <section class="setting-block">
            <div class="setting-block__header">
              <BaseIcon
                name="mdi:theme-light-dark"
                class="setting-block__icon"
              />
              <h3 class="setting-block__title">Цветовая тема</h3>
            </div>
            <p class="setting-block__description">
              Выберите тему, которая вам больше нравится
            </p>
            <a-select
              v-model:value="currentTheme"
              show-search
              placeholder="Выберите тему"
              size="large"
              :style="{ width: '100%' }"
              :options="themeOptions"
              :filter-option="filterOption"
              :allow-clear="true"
            />
          </section>
        </aside>
      </div>

      <div v-else class="guest-card">
        <BaseIcon name="fluent-color:warning-24" class="guest-card__icon" />
        <h2 class="guest-card__title">Авторизация требуется</h2>
        <p class="guest-card__description">
          Войдите в аккаунт, чтобы управлять фильмами и настройками
        </p>
        <a-button
          type="primary"
          size="large"
          class="guest-card__login-btn"
          @click="goToLogin"
        >
          <BaseIcon name="mdi:login" class="guest-card__login-btn__icon" />
          Войти в аккаунт
        </a-button>
      </div>
    </div>
  </div>

  <BaseModal v-model="isModalVisible" @confirm="updateName">
    <template #title>
      <h3>Смена имени</h3>
    </template>

    <template #body>
      <a-form :model="editForm" layout="vertical" @finish="updateName">
        <a-form-item label="Изменить отображаемое имя" name="fullName">
          <a-input
            v-model:value="editForm.fullName"
            size="large"
            :maxlength="50"
          />
        </a-form-item>
      </a-form>
    </template>
  </BaseModal>
</template>

<style scoped lang="scss">
@use "../../styles/screen-sizes" as *;
@use "../../styles/media" as *;

.profile-page {
  min-height: 100vh;
  background: linear-gradient(
    135deg,
    var(--bg-primary) 0%,
    var(--bg-secondary) 100%
  );
  color: var(--text-primary);
  display: flex;
  flex-direction: column;

  &__hero {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--ant-color-primary) 80%, transparent) 0%,
      transparent 100%
    );
    padding: 2rem 0;
  }

  &__content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem;
  }

  &__title {
    font-size: clamp(2rem, 6vw, 3rem);
    font-weight: 800;
    margin: 1rem 0 0 0;
    background: linear-gradient(
      135deg,
      var(--ant-color-primary),
      var(--text-primary)
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    text-align: center;
  }

  &__grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
    margin: 2rem 0;
    min-height: 600px;

    @include mediaMobileXL {
      min-height: auto;
    }

    @include mediaTablet {
      grid-template-columns: 430px 280px;
      gap: 2.5rem;
    }

    @include mediaDesktopXS {
      grid-template-columns: 480px 1fr;
      gap: 3rem;
    }
  }
}

.user-card {
  height: 100%;
  display: flex;
  background: var(--bg-primary);
  border-radius: 24px;
  box-shadow: var(--shadow), 0 20px 40px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-color);
  overflow: hidden;
  padding: 2.5rem;

  @include mediaMobileXL {
    height: auto;
    padding: 2rem;
  }

  &__avatar-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2rem;
    text-align: center;

    @include mediaTablet {
      flex-direction: row;
      text-align: left;
      gap: 2.5rem;
    }
  }

  &__avatar {
    position: relative;
    width: 120px;
    height: 120px;

    @include mediaMobile {
      width: 100px;
      height: 100px;
    }
  }

  &__avatar-initials {
    width: 100%;
    height: 100%;
    background: linear-gradient(
      135deg,
      var(--ant-color-primary),
      var(--text-primary)
    );
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2.5rem;
    font-weight: 800;
    color: white;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  &__info {
    flex: 1;
  }

  &__name {
    font-size: clamp(1.5rem, 4vw, 2rem);
    font-weight: 800;
    margin: 0 0 0.5rem 0;
    background: linear-gradient(
      135deg,
      var(--ant-color-primary),
      var(--text-primary)
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    cursor: pointer;
  }

  &__email {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.1rem;
    color: var(--text-secondary);
    margin-bottom: 1rem;
    word-break: break-all;
  }

  &__email-icon {
    width: 18px;
    height: 18px;
    color: var(--ant-color-primary);
  }

  &__id {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.95rem;
    color: var(--text-secondary);
    font-family: monospace;
  }

  &__id-icon {
    width: 18px;
    height: 18px;
    color: var(--ant-color-primary);
  }

  &__short-id {
    cursor: pointer;
  }
}

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
}

.setting-block {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  &__header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  &__icon {
    width: 28px;
    height: 28px;
    color: var(--ant-color-primary);
  }

  &__title {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  &__description {
    color: var(--text-secondary);
    margin-bottom: 1rem;
    line-height: 1.6;
  }
}

.guest-card {
  background: var(--bg-primary);
  border-radius: 24px;
  box-shadow: var(--shadow), 0 20px 40px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-color);
  padding: 4rem 2.5rem;
  text-align: center;
  max-width: 500px;
  margin: 2rem auto;

  @include mediaMobileXL {
    padding: 3rem 2rem;
    margin: 1.5rem auto;
  }

  &__icon {
    width: 96px;
    height: 96px;
    color: var(--ant-color-warning);
    margin-bottom: 2rem;
    opacity: 0.8;

    @include mediaMobile {
      width: 72px;
      height: 72px;
      margin-bottom: 1.5rem;
    }
  }

  &__title {
    font-size: clamp(1.5rem, 4vw, 2rem);
    font-weight: 800;
    margin: 0 0 1rem 0;
    color: var(--text-primary);
  }

  &__description {
    color: var(--text-secondary);
    font-size: 1.1rem;
    margin-bottom: 2.5rem;
    line-height: 1.6;
  }

  &__login-btn {
    min-width: 220px;

    @include mediaMobile {
      width: 100%;
      min-width: unset;
    }

    &__icon {
      margin-right: 8px;
      width: 20px;
      height: 20px;
    }
  }
}

:deep(.ant-select) {
  border-radius: 12px;

  &:focus-within {
    box-shadow: 0 0 0 3px
      color-mix(in srgb, var(--ant-color-primary) 10%, transparent);
  }
}
</style>
