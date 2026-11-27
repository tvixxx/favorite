<script setup lang="ts">
import SkeletonBar from "@/components/Skeleton/SkeletonBar.vue";
</script>

<template>
  <div class="tvdb tvdb-search-skeleton" aria-hidden="true">
    <p class="tvdb-hint">
      <SkeletonBar
        class="tvdb-search-skeleton__line"
        width="min(100%, 740px)"
        height="14px"
      />
      <SkeletonBar
        class="tvdb-search-skeleton__line tvdb-search-skeleton__hint-extra"
        width="66%"
        height="14px"
      />
      <SkeletonBar
        class="tvdb-search-skeleton__line tvdb-search-skeleton__hint-mobile"
        width="42%"
        height="14px"
      />
    </p>

    <div class="tvdb-search">
      <div class="tvdb-field tvdb-search__query">
        <SkeletonBar
          class="tvdb-search-skeleton__label"
          width="68px"
          height="12px"
        />
        <SkeletonBar height="52px" radius="var(--fv-radius-sm)" />
      </div>
      <div class="tvdb-field">
        <SkeletonBar
          class="tvdb-search-skeleton__label"
          width="56px"
          height="12px"
        />
        <SkeletonBar height="52px" radius="var(--fv-radius-sm)" />
      </div>
      <div class="tvdb-field">
        <SkeletonBar
          class="tvdb-search-skeleton__label"
          width="min(100%, 124px)"
          height="12px"
        />
        <SkeletonBar height="52px" radius="var(--fv-radius-sm)" />
      </div>
      <SkeletonBar
        class="tvdb-search__submit tvdb-search-skeleton__submit"
        width="auto"
        radius="var(--fv-radius-sm)"
      />
    </div>

    <div class="tvdb-link">
      <SkeletonBar
        class="tvdb-search-skeleton__line"
        width="146px"
        height="14px"
      />
    </div>
    <p class="tvdb-attribution">
      <SkeletonBar
        class="tvdb-search-skeleton__line"
        width="186px"
        height="12px"
      />
    </p>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/media" as *;

.tvdb-search-skeleton {
  &__line {
    display: inline-block;
    vertical-align: middle;
  }

  &__label {
    margin-block: 4px;
  }

  &__submit {
    min-width: 88px;
  }

  &__hint-extra,
  &__hint-mobile {
    display: none;
  }

  @include mediaMax(850px) {
    &__hint-extra {
      display: inline-block;
    }
  }

  @include mediaMax(420px) {
    &__hint-mobile {
      display: inline-block;
    }
  }
}
</style>
