<script lang="ts" setup>
import { useMainStore } from "@/state/state";
import { useRouter } from "vue-router";

import { computed, onMounted, ref } from "vue";
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
import {
  ERROR_UPDATE_USER_NAME_TEXT,
  SUCCESS_UPDATE_USER_NAME_TEXT,
} from "@/state/constants";
import { useBadgesStore, useUserMoviesStore } from "@/stores";
import { useNotificationPrefs } from "@/composable/useNotificationPrefs";
import { avatarGradient } from "@/composable/useAvatarGradient";

const store = useMainStore();
const router = useRouter();
const badgesStore = useBadgesStore();
const userMoviesStore = useUserMoviesStore();

// min-display скелетонов (шиммер появляется сразу, держится минимум ~0.4с)
const showBadgesSkeleton = useMinLoading(() => badgesStore.isLoading);
const showAnalyticsSkeleton = useMinLoading(
  () => userMoviesStore.isAnalyticsLoading,
);

const isModalVisible = ref(false);
const isSaving = ref(false);
const editForm = ref({ fullName: "" });

// Настройки уведомлений (локально, без бэка). Единый источник ключей в composable;
// эти же значения гейтят входящие уведомления в notificationsStore.applyIncoming
const {
  newMessages: notifyNewMessages,
  friendRequests: notifyFriendRequests,
  recommendations: notifyRecommendations,
} = useNotificationPrefs();
const achievementsView = ref<"unlocked" | "locked">("unlocked");

const user = computed<UserData | null>(() => store.userData ?? null);
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
  () => analytics.value?.continueWatching?.[0] ?? null,
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

const updateName = async () => {
  isSaving.value = true;

  try {
    await store.updateDisplayName(editForm.value.fullName);
    message.success(SUCCESS_UPDATE_USER_NAME_TEXT);
    isModalVisible.value = false;
  } catch {
    message.error(ERROR_UPDATE_USER_NAME_TEXT);
  } finally {
    isSaving.value = false;
  }
};

const showEditDisplayNameModal = () => {
  editForm.value.fullName = fullName.value;
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
          <div class="profile-hero__avatar">{{ initials }}</div>
          <div class="profile-hero__info">
            <p class="profile-hero__eyebrow">Ваш кинопрофиль</p>
            <h1 class="profile-hero__name" @click="showEditDisplayNameModal">
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
            @click="showEditDisplayNameModal"
          >
            <BaseIcon
              name="ph:gear"
              class="profile-hero__settings-icon"
            />
            Настройки
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
          <div class="badges-card__header">
            <BaseIcon name="ph:trophy" class="badges-card__icon" />
            <h3 class="badges-card__title">Достижения</h3>
          </div>

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
                  'badges-card__seg-btn--on': achievementsView === 'unlocked',
                }"
                @click="achievementsView = 'unlocked'"
              >
                Открытые
              </button>
              <button
                type="button"
                class="badges-card__seg-btn"
                :class="{
                  'badges-card__seg-btn--on': achievementsView === 'locked',
                }"
                @click="achievementsView = 'locked'"
              >
                Закрытые
              </button>
            </div>

            <BadgesList
              v-if="achievementsView === 'unlocked'"
              :badges="badgesStore.unlockedBadges"
            />
            <BadgesList
              v-else
              :badges="badgesStore.lockedBadges"
              :show-locked="true"
            />
          </div>
            </article>
          </div>

          <article class="analytics-card">
            <div class="analytics-card__header">
              <BaseIcon name="ph:chart-line-up" class="analytics-card__icon" />
              <h3 class="analytics-card__title">Персональная аналитика</h3>
            </div>

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
                  <span class="analytics-tile__label">Продолжить смотреть</span>
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

              <div v-if="hasQuickActions" class="analytics-card__quick-actions">
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

  <BaseModal v-model="isModalVisible" layout="form">
    <template #title>Настройки</template>

    <template #body>
      <div class="settings-modal">
        <div class="settings-modal__avatar-row">
          <div
            class="settings-modal__avatar"
            :style="{ background: avatarGradient(userId) }"
          >
            {{ initials }}
          </div>
          <button
            type="button"
            class="settings-modal__photo-btn"
            disabled
            title="Загрузка фото появится позже"
          >
            <BaseIcon name="ph:camera" :width="18" :height="18" />
            Сменить фото
          </button>
        </div>

        <div class="settings-modal__fields">
          <label class="settings-modal__field">
            <span class="settings-modal__label">Имя</span>
            <a-input
              v-model:value="editForm.fullName"
              size="large"
              :maxlength="50"
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

        <div class="settings-modal__notifs-group">
          <p class="settings-modal__section">Уведомления</p>
          <div class="settings-modal__notifs">
            <div class="settings-modal__notif-row">
              <span>Новые сообщения</span>
              <a-switch v-model:checked="notifyNewMessages" />
            </div>
            <div class="settings-modal__notif-row">
              <span>Запросы в друзья</span>
              <a-switch v-model:checked="notifyFriendRequests" />
            </div>
            <div class="settings-modal__notif-row">
              <span>Рекомендации от друзей</span>
              <a-switch v-model:checked="notifyRecommendations" />
            </div>
          </div>
        </div>
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
        @click="updateName"
      >
        Сохранить
      </a-button>
    </template>
  </BaseModal>
</template>

<style scoped lang="scss">
@use "../../styles/media" as *;
@use "@/styles/layout" as *;

/* ── Модалка «Настройки» (эталон) ── */
.settings-modal {
  display: flex;
  flex-direction: column;
  gap: 24px;

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

  &__photo-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 44px;
    padding: 0 18px;
    border: 0;
    border-radius: var(--fv-radius-sm);
    background: var(--fv-color-bg-secondary);
    color: var(--fv-color-text-primary);
    font: inherit;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease;

    &:hover:not(:disabled) {
      background: color-mix(
        in srgb,
        var(--fv-color-text-primary) 6%,
        var(--fv-color-bg-secondary)
      );
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
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

  &__notifs-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__section {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--fv-color-text-secondary);
  }

  &__notifs {
    background: var(--fv-color-bg-secondary);
    border-radius: 16px;
    padding: 4px 16px;
  }

  &__notif-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 13px 0;
    font-size: 0.95rem;
    color: var(--fv-color-text-primary);
    border-bottom: 1px solid var(--fv-color-border);

    &:last-child {
      border-bottom: none;
    }
  }

  &__logout {
    margin-inline-end: auto; // прижать влево (Сохранить остаётся справа)
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: none;
    background: color-mix(in srgb, var(--fv-color-brand) 12%, transparent);
    color: var(--fv-color-brand);

    &:hover {
      background: color-mix(in srgb, var(--fv-color-brand) 18%, transparent) !important;
      color: var(--fv-color-brand) !important;
    }
  }
}

.profile-page {
  @include pageShell(0);
  display: flex;
  flex-direction: column;

  &__content {
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

    // Эталон: основа 2/3 + боковая колонка 1/3 (высокий блок не ломает сетку)
    @include mediaDesktopXS {
      grid-template-columns: 2fr 1fr;
      gap: 1.25rem;
    }
  }

  &__primary-column {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    min-width: 0;
  }

  // Друзья + Достижения в ряд (1fr/1fr), схлопывается в 1 колонку на узких
  &__top-row {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.25rem;
    align-items: stretch;

    @include mediaTablet {
      grid-template-columns: 1fr 1fr;
    }
  }

  &__secondary-column {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    min-width: 0;
  }
}

// Профиль-карточка = шапка страницы (эталон: аватар + инфо + «Настройки»)
.profile-hero {
  display: flex;
  align-items: center;
  text-align: left; // перебиваем глобальный #app { text-align: center }
  gap: 24px;
  margin-top: 2rem;
  padding: 1.75rem 2rem;
  background: var(--fv-color-bg-primary);
  border-radius: var(--fv-radius-lg);
  box-shadow: var(--fv-shadow-card);
  border: 1px solid color-mix(in srgb, var(--fv-color-border) 55%, transparent);

  @include mediaMax(640px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    padding: 1.5rem;
  }

  &__avatar {
    flex-shrink: 0;
    width: 84px;
    height: 84px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #3a6ff0, #1b2a6b);
    color: #fff;
    font-size: 2rem;
    font-weight: 500;
  }

  &__info {
    flex: 1;
    min-width: 0;
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
    cursor: pointer;
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    margin-top: 8px;
  }

  &__meta-item {
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
    color: inherit; // нейтральный цвет по тексту строки (не синий accent)
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
    transition: background 0.15s ease;

    &:hover {
      background: color-mix(
        in srgb,
        var(--fv-color-text-primary) 8%,
        var(--fv-color-bg-secondary)
      );
    }
  }

  &__settings-icon {
    width: 18px;
    height: 18px;
  }
}

.friends-card {
  background: var(--fv-color-bg-primary);
  border-radius: 24px;
  box-shadow: var(--fv-shadow-low), 0 20px 40px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--fv-color-border);
  padding: 1.5rem;
}

.guest-card {
  background: var(--fv-color-bg-primary);
  border-radius: 24px;
  box-shadow: var(--fv-shadow-low), 0 20px 40px rgba(0, 0, 0, 0.1);
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
  align-self: start;
  background: var(--fv-color-bg-primary);
  border-radius: 24px;
  box-shadow: var(--fv-shadow-low), 0 20px 40px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--fv-color-border);
  padding: 2rem;

  @include mediaMobileXL {
    padding: 1.5rem;
  }

  &__header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  &__icon {
    width: 28px;
    height: 28px;
    color: var(--fv-color-accent);
  }

  &__title {
    font-size: 1.5rem;
    font-weight: 500;
    margin: 0;
    color: var(--fv-color-text-primary);
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

  // Эталон: сегмент-переключатель Открытые / Закрытые
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
    transition:
      color 0.15s ease,
      background 0.15s ease;

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
  box-shadow: var(--fv-shadow-low), 0 20px 40px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--fv-color-border);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;

  &__header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  &__icon {
    width: 22px;
    height: 22px;
    color: var(--fv-color-accent);
  }

  &__title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 500;
    color: var(--fv-color-text-primary);
  }

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

// Эталон: аналитика — сетка из 4 тайлов
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
    border: 1px solid var(--fv-color-border); // обводка (эталон .chip)
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
