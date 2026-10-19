<script setup lang="ts">
import { computed, ref, watch } from "vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import type { Actor } from "@/stores/actors/actorsStore";

const props = withDefaults(
  defineProps<{
    actors: Actor[];
    resetKey: string;
    variant: "detail" | "preview";
    collapsible?: boolean;
  }>(),
  { collapsible: true }
);
const emit = defineEmits<{ select: [actorId: string] }>();
const ACTORS_PREVIEW_COUNT = 6;
const actorsExpanded = ref(false);
const actorPhotoErrors = ref(new Set<string>());
const visibleActors = computed(() =>
  !props.collapsible || actorsExpanded.value
    ? props.actors
    : props.actors.slice(0, ACTORS_PREVIEW_COUNT)
);

watch(
  () => props.resetKey,
  () => {
    actorsExpanded.value = false;
  }
);

watch(
  () => props.actors,
  () => {
    actorPhotoErrors.value.clear();
  }
);

const actorInitials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
</script>

<template>
  <div v-if="variant === 'detail'" id="movie-actors" class="actors-grid">
    <button
      v-for="actor in visibleActors"
      :key="actor.id"
      type="button"
      class="actor-card"
      @click="emit('select', actor.id)"
    >
      <span class="actor-card__avatar">
        <img
          v-if="actor.imageUrl && !actorPhotoErrors.has(actor.id)"
          :src="actor.imageThumbnailUrl || actor.imageUrl"
          alt=""
          class="actor-card__photo"
          @error="actorPhotoErrors.add(actor.id)"
        />
        <template v-else>
          <BaseIcon
            class="actor-card__avatar-icon"
            name="ph:user"
            :width="21"
            :height="21"
          />
          <span class="actor-card__initials">
            {{ actorInitials(actor.name) }}
          </span>
        </template>
      </span>
      <span class="actor-card__info">
        <span class="actor-card__name">{{ actor.name }}</span>
        <span class="actor-card__role">в главной роли</span>
      </span>
      <BaseIcon
        class="actor-card__caret"
        name="ph:caret-right"
        :width="15"
        :height="15"
      />
    </button>
  </div>
  <div v-else id="catalog-preview-actors" class="catalog-preview__actors">
    <div
      v-for="actor in visibleActors"
      :key="actor.id"
      class="catalog-preview__actor"
    >
      <div class="catalog-preview__actor-avatar">
        <BaseIcon name="ph:user" :width="18" :height="18" />
      </div>
      <span>{{ actor.name }}</span>
    </div>
  </div>
  <button
    v-if="collapsible && actors.length > ACTORS_PREVIEW_COUNT"
    type="button"
    :class="
      variant === 'detail' ? 'actors-toggle' : 'catalog-preview__actors-toggle'
    "
    :aria-expanded="actorsExpanded"
    :aria-controls="
      variant === 'detail' ? 'movie-actors' : 'catalog-preview-actors'
    "
    @click="actorsExpanded = !actorsExpanded"
  >
    {{ actorsExpanded ? "Свернуть" : `Показать всех · ${actors.length}` }}
    <BaseIcon
      :name="actorsExpanded ? 'ph:caret-up' : 'ph:caret-down'"
      :width="18"
      :height="18"
      aria-hidden="true"
    />
  </button>
</template>

<style scoped lang="scss">
@use "@/styles/media" as *;

.actor-card__photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
}

.actor-card__initials {
  display: none;
}

.actors-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 12px;
}

.actors-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  margin: 16px auto 0;
  padding: 10px 16px;
  border: 1px solid var(--fv-color-border);
  border-radius: var(--fv-radius-sm);
  background: var(--fv-color-bg-secondary);
  color: var(--fv-color-text-primary);
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;

  &:hover {
    color: var(--fv-color-accent);
    border-color: var(--fv-color-accent);
  }

  &:focus-visible {
    outline: 2px solid var(--fv-color-accent);
    outline-offset: 2px;
  }
}

.actor-card {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  padding: 9px 12px 9px 9px;
  border: 1.5px solid transparent;
  border-radius: 14px;
  background: var(--fv-color-bg-secondary);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color var(--fv-motion-fast) var(--fv-ease),
    background var(--fv-motion-fast) var(--fv-ease);

  &:hover {
    border-color: var(--fv-color-accent);
    background: var(--fv-color-accent-soft);
  }

  &:focus-visible {
    outline: 2px solid var(--fv-color-accent);
    outline-offset: 2px;
  }

  &__avatar {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--fv-color-accent-soft);
    color: var(--fv-color-accent);
  }

  &__info {
    min-width: 0;
  }

  &__name {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: var(--fv-color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__role {
    display: block;
    margin-top: 2px;
    font-size: 12px;
    color: var(--fv-color-text-tertiary);
  }

  &__caret {
    flex-shrink: 0;
    margin-inline-start: auto;
    color: var(--fv-color-text-tertiary);
  }
}

.catalog-preview__actors {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.catalog-preview__actors-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  margin-top: 12px;
  padding: 10px 16px;
  border: 1px solid var(--fv-color-border);
  border-radius: var(--fv-radius-sm);
  background: var(--fv-color-bg-primary);
  color: var(--fv-color-text-primary);
  font: inherit;
  font-size: 14px;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--fv-color-accent);
    outline-offset: -2px;
  }
}

.catalog-preview__actor {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 13px 0 7px;
  border-radius: 999px;
  background: var(--fv-color-bg-primary);
  font-size: 14px;
  font-weight: 500;
}

.catalog-preview__actor-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--fv-color-bg-secondary);
  color: var(--fv-color-text-secondary);
}

@include mediaMax($tablet - 0.02px) {
  .actors-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .actors-toggle {
    width: 100%;
  }

  .actor-card {
    width: auto;
    max-width: 100%;
    min-height: 36px;
    align-items: center;
    gap: 7px;
    padding: 4px 13px 4px 5px;
    border-radius: 999px;
    border-color: var(--fv-color-border);

    &__avatar {
      width: 26px;
      height: 26px;
      flex: none;
      background: var(--fv-color-accent-soft);
      color: var(--fv-color-accent);
    }

    &__avatar-icon {
      display: none;
    }

    &__initials {
      display: block;
      font-size: 11px;
      font-weight: 500;
      line-height: 1;
      text-transform: uppercase;
    }

    &__info {
      display: flex;
      align-items: center;
    }

    &__name {
      font-size: 13px;
      line-height: 1.2;
    }

    &__role,
    &__caret {
      display: none;
    }
  }
}
</style>
