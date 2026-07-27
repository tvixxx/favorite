<script setup lang="ts">
import SkeletonBar from "./SkeletonBar.vue";

/**
 * Скелетон детали фильма.
 *  - `preview` (по умолчанию) — постер + инфо в ряд: модалка превью каталога;
 *  - `page` — раскладка детальной страницы: контент слева, липкая панель справа.
 */
const { layout = "preview" } = defineProps<{ layout?: "preview" | "page" }>();
</script>

<template>
  <div v-if="layout === 'page'" class="detail-skel-page" aria-hidden="true">
    <div class="detail-skel-page__grid">
      <div class="detail-skel-page__main">
        <div class="detail-skel-page__card">
          <SkeletonBar width="140px" height="22px" radius="7px" />
          <SkeletonBar height="14px" width="100%" radius="6px" />
          <SkeletonBar height="14px" width="92%" radius="6px" />
          <SkeletonBar height="14px" width="64%" radius="6px" />
        </div>

        <div class="detail-skel-page__card">
          <SkeletonBar width="110px" height="22px" radius="7px" />
          <div class="detail-skel-page__row">
            <SkeletonBar width="180px" height="62px" radius="14px" />
            <SkeletonBar width="180px" height="62px" radius="14px" />
          </div>
        </div>
      </div>

      <div class="detail-skel-page__side">
        <div class="detail-skel-page__panel">
          <div class="detail-skel-page__head">
            <div class="detail-skel-page__poster">
              <SkeletonBar aspect="2 / 3" radius="14px" />
            </div>
            <div class="detail-skel-page__info">
              <SkeletonBar height="20px" width="85%" radius="6px" />
              <SkeletonBar height="13px" width="100%" radius="6px" />
              <SkeletonBar height="13px" width="55%" radius="6px" />
            </div>
            <div class="detail-skel-page__rates">
              <SkeletonBar height="62px" radius="14px" />
              <SkeletonBar height="62px" radius="14px" />
            </div>
          </div>

          <SkeletonBar
            class="detail-skel-page__status-label"
            width="56px"
            height="12px"
            radius="6px"
          />
          <SkeletonBar height="46px" radius="var(--fv-radius-sm)" />

          <div class="detail-skel-page__actions">
            <SkeletonBar height="44px" radius="8px" />
            <SkeletonBar height="44px" radius="8px" />
            <SkeletonBar height="44px" radius="8px" />
            <SkeletonBar height="44px" radius="8px" />
          </div>

          <SkeletonBar height="13px" width="88%" radius="6px" />
        </div>
      </div>
    </div>
  </div>

  <div v-else class="detail-skel" aria-hidden="true">
    <div class="detail-skel__poster">
      <SkeletonBar aspect="2 / 3" radius="var(--fv-radius-lg)" />
    </div>

    <div class="detail-skel__info">
      <SkeletonBar height="34px" width="70%" radius="8px" />

      <div class="detail-skel__chips">
        <SkeletonBar width="72px" height="28px" radius="999px" />
        <SkeletonBar width="92px" height="28px" radius="999px" />
        <SkeletonBar width="60px" height="28px" radius="999px" />
      </div>

      <SkeletonBar height="14px" width="100%" radius="6px" />
      <SkeletonBar height="14px" width="94%" radius="6px" />
      <SkeletonBar height="14px" width="80%" radius="6px" />

      <div class="detail-skel__actions">
        <SkeletonBar width="200px" height="46px" radius="var(--fv-radius-sm)" />
        <SkeletonBar width="120px" height="46px" radius="var(--fv-radius-sm)" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/media" as *;

/* ---- Раскладка детальной страницы (контент + панель) ---- */
.detail-skel-page {
  width: 100%;

  &__grid {
    display: grid;
    grid-template-columns: 1fr 348px;
    gap: 22px;
    align-items: start;

    @media (max-width: 1080px) {
      grid-template-columns: 1fr;
    }
  }

  &__main {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }

  // Повторяет карточку-секцию контента
  &__card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 26px;
    border-radius: var(--fv-radius-lg);
    background: var(--fv-color-bg-primary);
    box-shadow: var(--fv-shadow-low);
  }

  &__row {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  &__side {
    @media (max-width: 1080px) {
      order: -1;
    }
  }

  // Повторяет панель фильма
  &__panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 22px;
    border-radius: var(--fv-radius-lg);
    background: var(--fv-color-bg-primary);
    box-shadow: var(--fv-shadow-low);
  }

  &__head {
    display: grid;
    grid-template-columns: 112px 1fr;
    grid-template-areas: "poster info" "rates rates";
    gap: 16px;
    align-items: start;
    margin-bottom: 6px;

    @media (max-width: 1080px) {
      grid-template-columns: 150px 1fr;
      grid-template-areas: "poster info" "poster rates";
      gap: 10px 22px;
      align-content: start;
    }
  }

  &__poster {
    grid-area: poster;
  }

  &__info {
    grid-area: info;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__rates {
    grid-area: rates;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  &__status-label {
    margin-top: 4px;
  }

  &__actions {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-bottom: 6px;
  }
}

/* ---- Превью в модалке каталога ---- */
.detail-skel {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
  margin: 1.5rem 0;

  @include mediaTablet {
    flex-direction: row;
    align-items: flex-start;
  }

  &__poster {
    flex-shrink: 0;
    width: 100%;
    max-width: 280px;

    @include mediaMax(767px) {
      max-width: 220px;
      margin: 0 auto;
    }
  }

  &__info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 8px;
  }
}
</style>
