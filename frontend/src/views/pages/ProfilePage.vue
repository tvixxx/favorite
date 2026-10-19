<script lang="ts" setup>
import SectionHeading from "@/components/SectionHeading/SectionHeading.vue";
import { useMainStore } from "@/state/state";
import { useRouter } from "vue-router";

import { computed, onMounted, ref, watch } from "vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import BaseModal from "@/components/BaseModal/BaseModal.vue";
import SkeletonBar from "@/components/Skeleton/SkeletonBar.vue";
import RowsSkeleton from "@/components/Skeleton/RowsSkeleton.vue";
import { useMinLoading } from "@/components/Skeleton/useMinLoading";
import type { UserData } from "@/state/types";
import ProfileSettings from "@/components/ProfileSettings/ProfileSettings.vue";
import BadgesList from "@/components/Badges/BadgesList.vue";
import StateBlock from "@/components/StateBlock/StateBlock.vue";
import SettingBlock from "@/components/ProfileSettings/components/SettingBlock/SettingBlock.vue";
import { message } from "ant-design-vue";
import { GenreLabels } from "@/components/Genres/constants/genres.constants";
import { useBadgesStore, useUserMoviesStore } from "@/stores";
import PersonalSettings from "@/components/PersonalSettings/PersonalSettings.vue";
import { avatarGradient } from "@/composable/useAvatarGradient";
import ImagePicker from "@/components/ImagePicker/ImagePicker.vue";
import type { ImageSelection } from "@/services/media";
import TimezoneSelect from "@/components/TimezoneSelect/TimezoneSelect.vue";

const store = useMainStore();
const router = useRouter();
const badgesStore = useBadgesStore();
const userMoviesStore = useUserMoviesStore();

const showBadgesSkeleton = useMinLoading(() => badgesStore.isLoading);
const showAnalyticsSkeleton = useMinLoading(
  () => userMoviesStore.isAnalyticsLoading
);

const isModalVisible = ref(false);
const isSaving = ref(false);
const editForm = ref({ fullName: "", timezone: "UTC" });
const editAvatar = ref<ImageSelection | null>(null);
const avatarUploading = ref(false);

const achievementsView = ref<"unlocked" | "locked">("unlocked");

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
      timezone: editForm.value.timezone,
      avatarAssetId: editAvatar.value?.assetId ?? null,
      avatarUrl: editAvatar.value?.assetId
        ? undefined
        : editAvatar.value?.url ?? null,
    });

    message.success("Профиль сохранён");
    isModalVisible.value = false;
  } catch {
    message.error("Не удалось сохранить профиль");
  } finally {
    isSaving.value = false;
  }
};

const showEditDisplayNameModal = () => {
  editForm.value.fullName = fullName.value;
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

const signOut = () => {
  store.logOut();
  router.push("/login");
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
              {{ fullName }}
            </h1>
            <div v-if="user" class="profile-hero__meta">
              <span class="profile-hero__meta-item">
                <BaseIcon
                  name="ph:envelope-simple"
                  class="profile-hero__meta-icon"
                />
                {{ user.email }}
              </span>
              <span class="profile-hero__meta-item"
                >Часовой пояс: {{ user.timezone ?? "UTC" }}</span
              >
              <span
                class="profile-hero__meta-item profile-hero__meta-item--muted"
              >
                <BaseIcon
                  name="ph:identification-card"
                  class="profile-hero__meta-icon"
                />
                <ATooltip :title="user.id" placement="top">
                  <span class="profile-hero__short-id">{{ shortId }}</span>
                </ATooltip>
              </span>
            </div>
          </div>
          <button
            type="button"
            class="profile-hero__settings"
            data-tour="profile-settings"
            aria-label="Настройки"
            title="Настройки профиля"
            @click="showEditDisplayNameModal"
          >
            <span class="profile-hero__settings-content">
              <BaseIcon
                name="ph:gear"
                class="profile-hero__settings-icon"
                :width="18"
                :height="18"
              />
              <span class="profile-hero__settings-label">Настройки</span>
            </span>
          </button>
        </section>

        <div class="profile-page__grid">
          <div class="profile-page__primary-column">
            <div class="profile-page__top-row">
              <article class="friends-card">
                <SettingBlock
                  title="Друзья"
                  description="Управление друзьями и подписками"
                  type="friends"
                  icon="ph:users-three"
                />
              </article>

              <article class="badges-card">
                <SectionHeading
                  class="badges-card__header"
                  title="Достижения"
                  icon="ph:trophy"
                  tag="h3"
                />

                <RowsSkeleton
                  v-if="showBadgesSkeleton"
                  :count="4"
                  :badge="false"
                />

                <StateBlock
                  v-else-if="badgesStore.isError"
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

                <div v-else class="badges-card__content">
                  <div class="badges-card__seg" role="tablist">
                    <button
                      type="button"
                      class="badges-card__seg-btn"
                      :class="{
                        'badges-card__seg-btn--on':
                          achievementsView === 'unlocked',
                      }"
                      @click="achievementsView = 'unlocked'"
                    >
                      Открытые
                    </button>
                    <button
                      type="button"
                      class="badges-card__seg-btn"
                      :class="{
                        'badges-card__seg-btn--on':
                          achievementsView === 'locked',
                      }"
                      @click="achievementsView = 'locked'"
                    >
                      Закрытые
                    </button>
                  </div>

                  <BadgesList
                    v-if="achievementsView === 'unlocked'"
                    class="badges-card__list"
                    tabindex="0"
                    role="region"
                    aria-label="Открытые достижения"
                    :badges="badgesStore.unlockedBadges"
                  />
                  <BadgesList
                    v-else
                    class="badges-card__list"
                    tabindex="0"
                    role="region"
                    aria-label="Закрытые достижения"
                    :badges="badgesStore.lockedBadges"
                    :show-locked="true"
                  />
                </div>
              </article>
            </div>

            <article class="analytics-card">
              <SectionHeading
                class="analytics-card__header"
                title="Персональная аналитика"
                icon="ph:chart-line-up"
                tag="h3"
              />

              <div v-if="showAnalyticsSkeleton" class="analytics-card__skel">
                <SkeletonBar
                  v-for="i in 4"
                  :key="`an-skel-${i}`"
                  height="92px"
                  radius="var(--fv-radius-md)"
                />
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
                <div class="analytics-tiles">
                  <div class="analytics-tile">
                    <span class="analytics-tile__label">Тренд просмотров</span>
                    <div class="analytics-tile__trend">
                      <span class="analytics-tile__trend-part">
                        <b>{{ analytics.addedLast7Days }}</b> за 7 дней
                      </span>
                      <span class="analytics-tile__trend-part">
                        <b>{{ analytics.addedLast30Days }}</b> за 30 дней
                      </span>
                    </div>
                  </div>

                  <div class="analytics-tile">
                    <span class="analytics-tile__label">Фильмы / Сериалы</span>
                    <span class="analytics-tile__value">
                      {{ analytics.totalMovies }} / {{ analytics.totalSerials }}
                    </span>
                    <span class="analytics-tile__hint">
                      завершено {{ analytics.completionRate }}%
                    </span>
                  </div>

                  <div class="analytics-tile">
                    <span class="analytics-tile__label">Топ жанров</span>
                    <div
                      v-if="analytics.topGenres.length"
                      class="analytics-tile__chips"
                    >
                      <span
                        v-for="g in analytics.topGenres"
                        :key="g.genre"
                        class="analytics-tile__chip"
                      >
                        {{ GenreLabels[g.genre] ?? g.genre }} · {{ g.count }}
                      </span>
                    </div>
                    <span v-else class="analytics-tile__hint">
                      Пока недостаточно данных
                    </span>
                  </div>

                  <div class="analytics-tile">
                    <span class="analytics-tile__label"
                      >Продолжить смотреть</span
                    >
                    <button
                      v-if="continueWatchingItem"
                      type="button"
                      class="analytics-tile__continue"
                      @click="openContinueWatching"
                    >
                      <span
                        class="analytics-tile__poster"
                        aria-hidden="true"
                      ></span>
                      <span class="analytics-tile__continue-info">
                        <span class="analytics-tile__continue-title">
                          {{ continueWatchingItem.title }}
                        </span>
                        <span class="analytics-tile__continue-meta">
                          С{{ continueWatchingItem.currentSeason ?? 0 }} · Э{{
                            continueWatchingItem.currentEpisode ?? 0
                          }}<template v-if="continueWatchingItem.episodeCount">
                            из {{ continueWatchingItem.episodeCount }}</template
                          >
                        </span>
                      </span>
                    </button>
                    <span v-else class="analytics-tile__hint">
                      Нет сериалов в процессе
                    </span>
                  </div>
                </div>

                <div
                  v-if="hasQuickActions"
                  class="analytics-card__quick-actions"
                >
                  <a-button
                    v-if="analytics.watchingSerialsCount > 0"
                    type="primary"
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

          <div class="profile-page__secondary-column">
            <ProfileSettings :types="['theme', 'stats']" />
          </div>
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
    <template #title>Настройки</template>

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

        <PersonalSettings />
      </div>
    </template>

    <template #footer>
      <a-button class="settings-modal__logout" @click="signOut">
        <BaseIcon name="ph:sign-out" :width="18" :height="18" />
        Выйти
      </a-button>
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
</template>

<style scoped lang="scss">
@use "../../styles/media" as *;
@use "@/styles/layout" as *;
@use "@/styles/scrollbar" as *;

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

  &__logout {
    margin-inline-end: auto;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: none;
    background: color-mix(in srgb, var(--fv-color-brand) 12%, transparent);
    color: var(--fv-color-brand);

    &:hover {
      background: color-mix(
        in srgb,
        var(--fv-color-brand) 18%,
        transparent
      ) !important;
      color: var(--fv-color-brand) !important;
    }
  }
}

.profile-page {
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
    grid-template-columns: 1fr;
    gap: 1.25rem;
    margin: 2rem 0;
    align-items: start;

    @include mediaDesktopXS {
      grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
      gap: 1.25rem;
    }
  }

  &__primary-column {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    min-width: 0;
  }

  &__top-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1.25rem;
    align-items: stretch;

    @include mediaTablet {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    > * {
      min-width: 0;
    }
  }

  &__secondary-column {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    min-width: 0;
  }
}

.profile-hero {
  position: relative;
  display: flex;
  align-items: center;
  gap: 24px;
  margin-top: 2rem;
  padding: 1.75rem 2rem;
  background: var(--fv-color-bg-primary);
  border-radius: var(--fv-radius-lg);
  box-shadow: var(--fv-shadow-card);
  border: 1px solid color-mix(in srgb, var(--fv-color-border) 55%, transparent);

  @include mediaMax(640px) {
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 1.5rem;
    text-align: center;
  }

  &__avatar {
    flex-shrink: 0;
    width: 84px;
    height: 84px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 34px;
    font-weight: 700;
  }

  &__info {
    flex: 1;
    min-width: 0;

    @include mediaMax(640px) {
      width: 100%;
    }
  }

  &__eyebrow {
    margin: 0 0 6px;
    font-family: var(--fv-font-display);
    font-size: 0.72rem;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--fv-color-text-tertiary);
  }

  &__name {
    margin: 0;
    font-family: var(--fv-font-display);
    font-size: clamp(1.5rem, 4vw, 2rem);
    font-weight: 500;
    line-height: 1.1;
    color: var(--fv-color-text-primary);
    overflow-wrap: anywhere;
    cursor: pointer;
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    margin-top: 8px;

    @include mediaMax(640px) {
      justify-content: center;
    }
  }

  &__meta-item {
    min-width: 0;
    max-width: 100%;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.95rem;
    color: var(--fv-color-text-secondary);
    word-break: break-word;

    &--muted {
      color: var(--fv-color-text-tertiary);
    }
  }

  &__meta-icon {
    width: 16px;
    height: 16px;
    color: inherit;
    flex-shrink: 0;
  }

  &__short-id {
    cursor: pointer;
    font-family: monospace;
  }

  &__settings {
    flex-shrink: 0;
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 44px;
    padding: 0 20px;
    border: none;
    border-radius: var(--fv-radius-sm);
    background: var(--fv-color-bg-secondary);
    color: var(--fv-color-text-primary);
    font: inherit;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition: background var(--fv-motion-fast) var(--fv-ease);

    &:hover {
      background: color-mix(
        in srgb,
        var(--fv-color-text-primary) 8%,
        var(--fv-color-bg-secondary)
      );
    }

    &:focus-visible {
      outline: 2px solid var(--fv-color-accent);
      outline-offset: 3px;
    }

    @include mediaMax(640px) {
      position: absolute;
      top: var(--fv-space-16);
      right: var(--fv-space-16);
      width: 44px;
      padding: 0;
    }
  }

  &__settings-label {
    text-box-trim: trim-both;
    text-box-edge: cap alphabetic;

    @include mediaMax(640px) {
      display: none;
    }
  }

  &__settings-content {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    line-height: 1;
  }

  &__settings-icon {
    display: block;
    flex: none;
    width: 18px;
    height: 18px;
  }
}

.friends-card {
  background: var(--fv-color-bg-primary);
  border-radius: 24px;
  box-shadow: var(--fv-shadow-low);
  border: 1px solid var(--fv-color-border);
  padding: 1.5rem;
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
  background: var(--fv-color-bg-primary);
  border-radius: 24px;
  box-shadow: var(--fv-shadow-low);
  border: 1px solid var(--fv-color-border);
  padding: 2rem;

  @include mediaMobileXL {
    padding: 1.5rem;
  }

  &__header {
    margin-bottom: 1.5rem;
  }

  &__loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 3rem 1rem;
    text-align: center;
    color: var(--fv-color-text-secondary);
  }

  &__loader {
    width: 40px;
    height: 40px;
    border: 3px solid var(--fv-color-border);
    border-top-color: var(--fv-color-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  &__error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 3rem 1rem;
    text-align: center;
    color: var(--fv-color-negative);
  }

  &__error-icon {
    width: 2rem;
    height: 2rem;
  }

  &__content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  &__list {
    @include customScrollbar;
    height: 16rem;
    min-width: 0;
    overflow-y: auto;
    scrollbar-gutter: stable;
  }

  &__seg {
    display: inline-flex;
    align-self: flex-start;
    gap: 2px;
    padding: 4px;
    border-radius: 10px;
    background: var(--fv-color-bg-secondary);
  }

  &__seg-btn {
    height: 34px;
    padding: 0 16px;
    border: none;
    border-radius: 7px;
    background: transparent;
    font: inherit;
    font-size: 0.88rem;
    font-weight: 500;
    color: var(--fv-color-text-secondary);
    cursor: pointer;
    transition: color var(--fv-motion-fast) var(--fv-ease),
      background var(--fv-motion-fast) var(--fv-ease);

    &--on {
      background: var(--fv-color-bg-primary);
      color: var(--fv-color-text-primary);
      box-shadow: var(--fv-shadow-card);
    }
  }
}

.analytics-card {
  background: var(--fv-color-bg-primary);
  border-radius: 24px;
  box-shadow: var(--fv-shadow-low);
  border: 1px solid var(--fv-color-border);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;

  &__loading,
  &__error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 1.4rem 0.8rem;
    color: var(--fv-color-text-secondary);
  }

  &__loader {
    width: 32px;
    height: 32px;
    border: 3px solid var(--fv-color-border);
    border-top-color: var(--fv-color-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  &__skel {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
    padding: 0.5rem 0;
  }

  &__error {
    color: var(--fv-color-negative);
  }

  &__error-icon {
    width: 22px;
    height: 22px;
  }

  &__content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  &__quick-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
  }
}

.analytics-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
}

.analytics-tile {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px;
  border-radius: var(--fv-radius-md);
  background: var(--fv-color-bg-secondary);
  text-align: left;

  &__label {
    font-size: 0.72rem;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--fv-color-text-tertiary);
  }

  &__trend {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
  }

  &__trend-part {
    font-size: 0.9rem;
    color: var(--fv-color-text-secondary);

    b {
      font-family: var(--fv-font-display);
      font-size: 1.35rem;
      font-weight: 500;
      color: var(--fv-color-text-primary);
      margin-right: 2px;
    }
  }

  &__value {
    font-family: var(--fv-font-display);
    font-size: 1.35rem;
    font-weight: 500;
    color: var(--fv-color-text-primary);
  }

  &__hint {
    font-size: 0.85rem;
    color: var(--fv-color-text-secondary);
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 2px;
  }

  &__chip {
    display: inline-flex;
    align-items: center;
    height: 30px;
    padding: 0 14px;
    border-radius: 999px;
    background: var(--fv-color-bg-secondary);
    border: 1px solid var(--fv-color-border);
    font-size: 0.82rem;
    font-weight: 500;
    color: var(--fv-color-text-primary);
  }

  &__continue {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 2px;
    padding: 0;
    width: 100%;
    min-width: 0;
    border: none;
    background: none;
    cursor: pointer;
    text-align: left;
  }

  &__poster {
    flex-shrink: 0;
    width: 34px;
    aspect-ratio: 2 / 3;
    border-radius: 6px;
    background: linear-gradient(160deg, #2a3550, #0e1524);
  }

  &__continue-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  &__continue-title {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--fv-color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__continue-meta {
    font-size: 0.78rem;
    color: var(--fv-color-text-secondary);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

:deep(.ant-select) {
  border-radius: 12px;

  &:focus-within {
    box-shadow: 0 0 0 3px
      color-mix(in srgb, var(--fv-color-accent) 10%, transparent);
  }
}
</style>
