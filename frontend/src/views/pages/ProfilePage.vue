<script lang="ts" setup>
import SectionHeading from "@/components/SectionHeading/SectionHeading.vue";
import { useMainStore } from "@/state/state";
import { useRouter } from "vue-router";

import { computed, onMounted, ref, shallowRef, watch } from "vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import BaseModal from "@/components/BaseModal/BaseModal.vue";
import SkeletonBar from "@/components/Skeleton/SkeletonBar.vue";
import { useMinLoading } from "@/components/Skeleton/useMinLoading";
import type { UserData } from "@/state/types";
import ProfileSettings from "@/components/ProfileSettings/ProfileSettings.vue";
import ProfileAchievements from "@/components/ProfileSettings/ProfileAchievements.vue";
import ProfileWatching from "@/components/ProfileSettings/ProfileWatching.vue";
import { PROFILE_THEME_META } from "@/components/ProfileSettings/constants";
import { currentTheme } from "@/composable";
import StateBlock from "@/components/StateBlock/StateBlock.vue";
import SettingBlock from "@/components/ProfileSettings/components/SettingBlock/SettingBlock.vue";
import { message } from "ant-design-vue";
import ProfileAnalyticsTiles from "@/components/ProfileSettings/ProfileAnalyticsTiles.vue";
import { useBadgesStore, useUserMoviesStore } from "@/stores";
import { avatarGradient } from "@/composable/useAvatarGradient";
import ImagePicker from "@/components/ImagePicker/ImagePicker.vue";
import type { ImageSelection } from "@/services/media";
import TimezoneSelect from "@/components/TimezoneSelect/TimezoneSelect.vue";
import { timezoneLabel } from "@/utils/timezoneLabel";
import { getApiResponseMessage } from "@/services/api";
import { getUserPreference } from "@/utils/userPreferences";

const store = useMainStore();
const router = useRouter();
const badgesStore = useBadgesStore();
const userMoviesStore = useUserMoviesStore();

const showBadgesSkeleton = useMinLoading(
  () =>
    badgesStore.isLoading &&
    !badgesStore.unlockedBadges.length &&
    !badgesStore.lockedBadges.length
);
const showAnalyticsSkeleton = useMinLoading(
  () => userMoviesStore.isAnalyticsLoading && !userMoviesStore.analytics
);

const isModalVisible = ref(false);
const isThemeModalVisible = shallowRef(false);
const isSaving = ref(false);
const editForm = ref({ fullName: "", username: "", timezone: "UTC" });
const editAvatar = ref<ImageSelection | null>(null);
const avatarUploading = ref(false);

const user = computed<UserData | null>(() => store.userData ?? null);
const avatarFailed = ref(false);
const avatarPreviewFailed = ref(false);

watch(
  () => user.value?.avatarUrl,
  () => {
    avatarFailed.value = false;
  }
);

watch(
  () => editAvatar.value?.url,
  () => {
    avatarPreviewFailed.value = false;
  }
);

const fullName = computed(() => store.userData?.fullName || "");
const showCard = computed(() => store.isLoggedIn);
const showContent = computed(() => showCard.value && user.value);
const userId = computed(() => store.userData?.id || "");
const showAchievements = computed(() =>
  getUserPreference(user.value, "showAchievements")
);
const showDetailedAnalytics = computed(() =>
  getUserPreference(user.value, "showDetailedAnalytics")
);

const initials = computed(() => {
  if (!user.value?.fullName) {
    return "U";
  }

  return (
    user.value.fullName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((name) => Array.from(name)[0]?.toUpperCase())
      .join("") || "U"
  );
});

const analytics = computed(() => userMoviesStore.analytics);

const hasQuickActions = computed(() => {
  const a = analytics.value;

  if (!a) {
    return false;
  }

  return (
    a.watchingSerialsCount > 0 ||
    a.statusBreakdown.dropped > 0 ||
    a.seeLaterCount > 0
  );
});

const continueWatchingItem = computed(
  () => analytics.value?.continueWatching?.[0] ?? null
);

const openContinueWatching = () => {
  if (continueWatchingItem.value) {
    router.push(`/detail/${continueWatchingItem.value.movieId}`);
  }
};

const openWatchingSerials = () => {
  router.push({
    path: "/library/collection",
    query: {
      watchStatus: "WATCHING",
      isSerial: "true",
    },
  });
};

const openDroppedTitles = () => {
  router.push({
    path: "/library/collection",
    query: {
      watchStatus: "DROPPED",
    },
  });
};

const openSeeLaterTitles = () => {
  router.push({
    path: "/library/collection",
    query: {
      seeLater: "true",
    },
  });
};

const goToLogin = () => {
  router.push("/login");
};

const saveProfile = async () => {
  if (isSaving.value || avatarUploading.value || store.isUpdatingProfile) {
    return;
  }

  const name = editForm.value.fullName.trim();

  if (name.length < 3 || name.length > 50) {
    message.error("Имя должно содержать от 3 до 50 символов");

    return;
  }

  isSaving.value = true;

  try {
    await store.updateProfile({
      fullName: name,
      username:
        editForm.value.username.trim().replace(/^@/, "").toLowerCase() || null,
      timezone: editForm.value.timezone,
      avatarAssetId: editAvatar.value?.assetId ?? null,
      avatarUrl: editAvatar.value?.assetId
        ? undefined
        : editAvatar.value?.url ?? null,
    });

    message.success("Профиль сохранён");
    isModalVisible.value = false;
  } catch (error) {
    message.error(
      getApiResponseMessage(error) ?? "Не удалось сохранить профиль"
    );
  } finally {
    isSaving.value = false;
  }
};

const showEditDisplayNameModal = () => {
  editForm.value.fullName = fullName.value;
  editForm.value.username = user.value?.username ?? "";
  editForm.value.timezone = user.value?.timezone ?? "UTC";
  editAvatar.value = user.value?.avatarUrl
    ? {
        url: user.value.avatarUrl,
        thumbnailUrl: user.value.avatarThumbnailUrl,
        assetId: user.value.avatarAssetId,
      }
    : null;

  isModalVisible.value = true;
};

const openAdditionalSettings = (): void => {
  isModalVisible.value = false;
  void router.push({ name: "profile-settings" });
};

const retryBadges = (): void => {
  if (userId.value) {
    void badgesStore.fetchUserBadges(userId.value);
  }
};

const retryAnalytics = (): void => {
  if (userId.value) {
    void userMoviesStore.fetchUserMoviesAnalytics(userId.value);
  }
};

onMounted(async () => {
  if (userId.value) {
    await Promise.all([
      badgesStore.fetchUserBadges(userId.value),
      userMoviesStore.fetchUserMoviesAnalytics(userId.value),
    ]);
  }
});
</script>

<template>
  <div class="profile-page">
    <div class="profile-page__content">
      <template v-if="showContent">
        <section class="profile-hero">
          <div
            class="profile-hero__avatar"
            :style="{ background: avatarGradient(userId) }"
          >
            <img
              v-if="user?.avatarUrl && !avatarFailed"
              :src="user.avatarThumbnailUrl || user.avatarUrl"
              alt="Фото профиля"
              class="profile-avatar-image"
              @error="avatarFailed = true"
            />
            <template v-else>{{ initials }}</template>
          </div>
          <div class="profile-hero__info">
            <p class="profile-hero__eyebrow">Ваш кинопрофиль</p>
            <h1 class="profile-hero__name">
              {{ fullName || user?.username || "Профиль" }}
            </h1>
            <div v-if="user" class="profile-hero__meta">
              <span v-if="user.username" class="profile-hero__meta-item">{{
                `@${user.username}`
              }}</span>
              <span class="profile-hero__meta-item">
                <BaseIcon
                  name="ph:envelope-simple"
                  class="profile-hero__meta-icon"
                />
                <span>{{ user.email }}</span>
              </span>
              <span class="profile-hero__meta-item"
                >Часовой пояс: {{ timezoneLabel(user.timezone ?? "UTC") }}</span
              >
            </div>
          </div>
          <div class="profile-hero__actions">
            <button
              type="button"
              class="profile-hero__settings"
              data-tour="profile-settings"
              aria-label="Настройки"
              title="Настройки профиля"
              @click="showEditDisplayNameModal"
            >
              <BaseIcon name="ph:gear" :width="16" :height="16" />
              Настройки
            </button>
            <button
              type="button"
              class="profile-hero__settings"
              aria-label="Цветовая тема"
              @click="isThemeModalVisible = true"
            >
              <BaseIcon name="ph:palette" :width="16" :height="16" />
              Тема · {{ PROFILE_THEME_META[currentTheme]?.label ?? "Светлая" }}
            </button>
          </div>
        </section>

        <div class="profile-page__grid">
          <ProfileWatching
            v-if="
              showDetailedAnalytics &&
              (showAnalyticsSkeleton ||
                (analytics && !userMoviesStore.isAnalyticsError))
            "
            class="profile-page__watching"
            :item="continueWatchingItem"
            :loading="showAnalyticsSkeleton"
            @open="openContinueWatching"
          />
          <ProfileSettings
            class="profile-page__sidebar"
            :types="['stats', 'friends']"
          />

          <article v-if="showAchievements" class="badges-card">
            <SectionHeading
              class="badges-card__header"
              title="Достижения"
              icon="ph:trophy"
              tag="h2"
              v-if="badgesStore.isError && !showBadgesSkeleton"
            />
            <StateBlock
              v-if="badgesStore.isError && !showBadgesSkeleton"
              compact
              variant="error"
              icon="ph:warning-circle"
              title="Не удалось загрузить достижения"
              :actions="[
                {
                  label: 'Повторить',
                  icon: 'ph:arrow-clockwise',
                  kind: 'primary',
                  onClick: retryBadges,
                },
              ]"
            />
            <ProfileAchievements
              v-else
              :unlocked="badgesStore.unlockedBadges"
              :locked="badgesStore.lockedBadges"
              :loading="showBadgesSkeleton"
            >
              <SectionHeading title="Достижения" icon="ph:trophy" tag="h2" />
            </ProfileAchievements>
          </article>

          <article v-if="showDetailedAnalytics" class="analytics-card">
            <SectionHeading
              class="analytics-card__header"
              title="Персональная аналитика"
              icon="ph:chart-line-up"
              tag="h3"
            />

            <div v-if="showAnalyticsSkeleton" class="analytics-card__content">
              <ProfileAnalyticsTiles />
              <div class="analytics-card__quick-actions" aria-hidden="true">
                <SkeletonBar
                  width="176px"
                  height="var(--profile-action-height)"
                  radius="var(--fv-radius-control)"
                />
                <SkeletonBar
                  width="168px"
                  height="var(--profile-action-height)"
                  radius="var(--fv-radius-control)"
                />
              </div>
            </div>

            <StateBlock
              v-else-if="userMoviesStore.isAnalyticsError || !analytics"
              compact
              variant="error"
              icon="ph:warning-circle"
              title="Не удалось загрузить аналитику"
              :actions="[
                {
                  label: 'Повторить',
                  icon: 'ph:arrow-clockwise',
                  kind: 'primary',
                  onClick: retryAnalytics,
                },
              ]"
            />

            <div v-else class="analytics-card__content">
              <ProfileAnalyticsTiles :analytics="analytics" />

              <div v-if="hasQuickActions" class="analytics-card__quick-actions">
                <a-button
                  v-if="analytics.watchingSerialsCount > 0"
                  @click="openWatchingSerials"
                >
                  Сериалы в процессе ({{ analytics.watchingSerialsCount }})
                </a-button>
                <a-button
                  v-if="analytics.statusBreakdown.dropped > 0"
                  @click="openDroppedTitles"
                >
                  Брошено ({{ analytics.statusBreakdown.dropped }})
                </a-button>
                <a-button
                  v-if="analytics.seeLaterCount > 0"
                  @click="openSeeLaterTitles"
                >
                  Досмотреть позже ({{ analytics.seeLaterCount }})
                </a-button>
              </div>
            </div>
          </article>
        </div>
      </template>

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
          <BaseIcon name="ph:sign-in" class="guest-card__login-btn__icon" />
          Войти в аккаунт
        </a-button>
      </div>
    </div>
  </div>

  <BaseModal
    v-model="isModalVisible"
    layout="form"
    class="profile-settings-modal"
  >
    <template #title>Настройки профиля</template>

    <template #body>
      <div class="settings-modal">
        <div class="settings-modal__avatar-row">
          <div
            class="settings-modal__avatar"
            :style="{ background: avatarGradient(userId) }"
          >
            <img
              v-if="editAvatar?.url && !avatarPreviewFailed"
              :src="editAvatar.thumbnailUrl || editAvatar.url"
              alt="Предпросмотр фото профиля"
              class="profile-avatar-image"
              @error="avatarPreviewFailed = true"
            />
            <template v-else>{{ initials }}</template>
          </div>
          <ImagePicker
            v-model="editAvatar"
            purpose="USER_AVATAR"
            label="Фото профиля"
            :show-preview="false"
            :disabled="isSaving"
            @busy="avatarUploading = $event"
          />
        </div>

        <div class="settings-modal__fields">
          <TimezoneSelect v-model="editForm.timezone" :disabled="isSaving" />
          <label class="settings-modal__field">
            <span class="settings-modal__label">Уникальный ник</span>
            <a-input
              v-model:value="editForm.username"
              :maxlength="33"
              :disabled="isSaving"
              autocomplete="off"
              autocapitalize="none"
              :spellcheck="false"
              placeholder="Например: movie_fan"
              aria-label="Уникальный ник"
              size="large"
            />
            <span class="settings-modal__label"
              >Необязательно. Уникальный ник для поиска друзей, 3–32 латинские
              буквы, цифры или _. Имя может повторяться, ник — нет. Для входа
              используется почта.</span
            >
          </label>
          <label class="settings-modal__field">
            <span class="settings-modal__label">Имя</span>
            <a-input
              v-model:value="editForm.fullName"
              :maxlength="50"
              :disabled="isSaving"
              size="large"
            >
              <template #prefix>
                <BaseIcon name="ph:user" :width="18" :height="18" />
              </template>
            </a-input>
          </label>

          <label class="settings-modal__field">
            <span class="settings-modal__label">Email</span>
            <a-input :value="user?.email" size="large" disabled>
              <template #prefix>
                <BaseIcon name="ph:envelope-simple" :width="18" :height="18" />
              </template>
            </a-input>
          </label>
        </div>

        <button
          type="button"
          class="settings-modal__additional"
          :disabled="isSaving || avatarUploading || store.isUpdatingProfile"
          @click="openAdditionalSettings"
        >
          <BaseIcon name="ph:gear" :width="24" :height="24" />
          <span
            ><strong>Дополнительные настройки</strong
            ><small>Вид приложения, инструменты и уведомления</small></span
          >
          <BaseIcon name="ph:caret-right" :width="20" :height="20" />
        </button>
      </div>
    </template>

    <template #footer>
      <a-button @click="isModalVisible = false">Отмена</a-button>
      <a-button
        type="primary"
        html-type="button"
        :loading="isSaving"
        :disabled="avatarUploading || store.isUpdatingProfile"
        @click="saveProfile"
      >
        Сохранить
      </a-button>
    </template>
  </BaseModal>
  <BaseModal
    v-model="isThemeModalVisible"
    layout="quick"
    class="profile-theme-modal"
    hide-footer
  >
    <template #title>Цветовая тема</template>
    <template #body>
      <SettingBlock
        class="profile-theme-options"
        title="Цветовая тема"
        description=""
        type="theme"
        icon="ph:palette"
        hide-heading
        @theme-selected="isThemeModalVisible = false"
      />
    </template>
  </BaseModal>
</template>

<style scoped lang="scss">
@use "../../styles/media" as *;
@use "@/styles/layout" as *;

@include mediaTablet {
  :global(.profile-theme-modal.modal--quick) {
    width: min(450px, calc(100% - 28px));
  }
}

.profile-avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
}

.settings-modal {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding-bottom: 16px;

  @include mediaTablet {
    padding-bottom: 24px;
  }

  &__avatar-row {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  &__avatar {
    flex-shrink: 0;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-weight: 700;
    font-size: 24px;
  }

  &__fields {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--fv-color-text-secondary);
  }

  &__additional {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--fv-space-12);
    min-height: 80px;
    padding: var(--fv-space-16);
    border: 1px solid var(--fv-color-border);
    border-radius: var(--fv-radius-md);
    background: var(--fv-color-bg-secondary);
    color: var(--fv-color-text-primary);
    font: inherit;
    text-align: left;
    cursor: pointer;
    > span {
      flex: 1;
      min-width: 0;
    }
    > :first-child {
      color: var(--fv-color-accent);
      flex-shrink: 0;
    }
    > :last-child {
      color: var(--fv-color-text-tertiary);
      flex-shrink: 0;
    }
    strong {
      display: block;
      font-size: var(--fv-text-p3-size);
      line-height: var(--fv-text-p3-lh);
      font-weight: var(--fv-weight-medium);
    }
    small {
      display: block;
      margin-top: var(--fv-space-4);
      font-size: var(--fv-text-p4-size);
      line-height: var(--fv-text-p4-lh);
      color: var(--fv-color-text-secondary);
    }
    &:focus-visible {
      outline: 2px solid var(--fv-color-accent);
      outline-offset: 3px;
    }
    &:disabled {
      cursor: wait;
      opacity: 0.5;
    }
    &:hover:not(:disabled) {
      background: var(--fv-color-bg-hover);
    }
  }
}

.profile-page {
  --profile-action-height: 40px;
  @include pageShell(0);
  display: flex;
  flex-direction: column;

  &__content {
    width: 100%;
    min-width: 0;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem;
  }

  &__grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
    margin: 16px 0 32px;
    align-items: start;

    @include mediaDesktopXS {
      &:has(.profile-page__watching) {
        grid-template-columns: minmax(0, 2.55fr) minmax(0, 1fr);
      }
    }
  }

  &__sidebar {
    min-width: 0;
  }
}

.profile-hero {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  margin-top: 20px;

  @include mediaTablet {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 16px;
    margin-top: 32px;
  }

  &__avatar {
    display: grid;
    place-items: center;
    width: clamp(44px, 6vw, 58px);
    aspect-ratio: 1;
    border-radius: 50%;
    color: #fff;
    font-size: 1.25rem;
    font-weight: 700;
  }

  &__info {
    min-width: 0;
  }

  &__eyebrow {
    margin: 0 0 4px;
    font-size: 0.75rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--fv-color-text-secondary);
  }

  &__name {
    margin: 0;
    font-family: var(--fv-font-display);
    font-size: clamp(1.4rem, 3.5vw, 2.25rem);
    line-height: 1.12;
    overflow-wrap: anywhere;
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    margin-top: 5px;
  }

  &__meta-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    max-width: 100%;
    font-size: 0.85rem;
    color: var(--fv-color-text-secondary);
    overflow-wrap: anywhere;
  }

  &__actions {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    @include mediaTablet {
      grid-column: auto;
      justify-content: flex-end;
    }
  }

  &__settings {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: var(--profile-action-height);
    max-width: 100%;
    padding: 6px 10px;
    border: 1px solid var(--fv-color-border);
    border-radius: var(--fv-radius-control);
    background: var(--fv-color-bg-primary);
    color: var(--fv-color-text-primary);
    font: inherit;
    font-size: 0.875rem;
    font-weight: 500;
    overflow-wrap: anywhere;
    cursor: pointer;

    &:hover {
      background: var(--fv-color-bg-hover);
    }

    &:focus-visible {
      outline: 2px solid var(--fv-color-accent);
      outline-offset: 2px;
    }

    svg {
      flex: none;
    }
  }
}

.guest-card {
  background: var(--fv-color-bg-primary);
  border-radius: 24px;
  box-shadow: var(--fv-shadow-low);
  border: 1px solid var(--fv-color-border);
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
    color: var(--fv-color-warning);
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
    font-weight: 500;
    margin: 0 0 1rem 0;
    color: var(--fv-color-text-primary);
  }

  &__description {
    color: var(--fv-color-text-secondary);
    font-size: 1.1rem;
    margin-bottom: 2.5rem;
    line-height: 1.6;
  }

  &__login-btn {
    display: flex;
    align-items: center;
    justify-content: center;
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

.badges-card {
  grid-column: 1 / -1;
  min-width: 0;
  background: var(--fv-color-bg-primary);
  border-radius: var(--fv-radius-lg);
  box-shadow: var(--fv-shadow-card);
  border: 1px solid var(--fv-color-border);
  padding: clamp(16px, 3vw, 24px);

  &__header {
    margin-bottom: 12px;
  }
}

.analytics-card {
  grid-column: 1 / -1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 4px;

  &__content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  &__quick-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;

    :deep(.ant-btn) {
      max-width: 100%;
      min-height: var(--profile-action-height);
      height: auto;
      padding: 6px 10px;
      white-space: normal;
      overflow-wrap: anywhere;
      border-radius: var(--fv-radius-control);
      border-color: var(--fv-color-border);
      font-size: 0.875rem;
      font-weight: 500;
    }
  }
}

.profile-theme-options {
  padding-bottom: 20px;
}

:deep(.ant-select) {
  border-radius: 12px;

  &:focus-within {
    box-shadow: 0 0 0 3px
      color-mix(in srgb, var(--fv-color-accent) 10%, transparent);
  }
}
</style>
