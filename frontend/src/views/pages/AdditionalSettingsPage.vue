<script setup lang="ts">
import { computed, onScopeDispose, useTemplateRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import PersonalSettings from "@/components/PersonalSettings/PersonalSettings.vue";
import { useMainStore } from "@/state/state";

const route = useRoute();
const router = useRouter();
const store = useMainStore();
const sections = [
  {
    id: "appearance",
    title: "Вид приложения",
    description: "Что показывать в вашем интерфейсе",
    icon: "ph:eye",
    count: "4 настройки",
  },
  {
    id: "personal",
    title: "Персональные настройки",
    description: "Инструменты для работы с коллекцией",
    icon: "ph:gear",
    count: "3 настройки",
  },
  {
    id: "notifications",
    title: "Уведомления",
    description: "Какие события присылать в приложении",
    icon: "ph:bell",
    count: "3 настройки",
  },
] as const;
const selected = computed(
  () =>
    sections.find((section) => section.id === route.query.section) ??
    sections[0]
);
const content = useTemplateRef<HTMLDivElement>("content");
let animation: Animation | undefined;

function chooseSection(section: (typeof sections)[number]["id"]): void {
  if (store.isUpdatingProfile || selected.value.id === section) return;
  void router.replace({
    name: "profile-settings",
    query: section === "appearance" ? {} : { section },
  });
}

watch(
  () => selected.value.id,
  () => {
    animation?.cancel();
    animation = undefined;
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
      animation = content.value?.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 180,
        easing: "ease-out",
      });
  },
  { flush: "post" }
);

onScopeDispose(() => animation?.cancel());
</script>

<template>
  <main class="additional-settings" aria-labelledby="additional-settings-title">
    <RouterLink to="/profile" class="additional-settings__back"
      ><BaseIcon name="ph:arrow-left" :width="18" :height="18" />В
      профиль</RouterLink
    >
    <header class="additional-settings__heading">
      <div>
        <h1 id="additional-settings-title">Дополнительные настройки</h1>
        <p>Вид приложения, инструменты коллекции и уведомления.</p>
      </div>
      <span class="additional-settings__save-hint"
        ><BaseIcon name="ph:check" :width="16" :height="16" />Сохраняются
        автоматически</span
      >
    </header>
    <div class="additional-settings__shell">
      <nav
        class="additional-settings__categories"
        aria-label="Категории настроек"
      >
        <h2>Разделы настроек</h2>
        <p>Выберите, что настроить</p>
        <button
          v-for="section in sections"
          :key="section.id"
          type="button"
          :aria-label="section.title"
          :aria-pressed="selected.id === section.id"
          :disabled="store.isUpdatingProfile"
          @click="chooseSection(section.id)"
        >
          <BaseIcon :name="section.icon" :width="20" :height="20" /><span
            >{{ section.title }}<small>{{ section.count }}</small></span
          >
        </button>
      </nav>
      <section
        class="additional-settings__detail"
        :aria-labelledby="`settings-${selected.id}-title`"
      >
        <header class="additional-settings__selected">
          <span class="additional-settings__icon"
            ><BaseIcon :name="selected.icon" :width="22" :height="22"
          /></span>
          <div>
            <h2 :id="`settings-${selected.id}-title`">{{ selected.title }}</h2>
            <p>{{ selected.description }}</p>
          </div>
        </header>
        <div ref="content" class="additional-settings__content">
          <PersonalSettings :section="selected.id" />
        </div>
      </section>
    </div>
    <p class="additional-settings__note">
      Выбор сохраняется в вашем аккаунте и доступен после входа на других
      устройствах.
    </p>
  </main>
</template>

<style scoped lang="scss">
@use "@/styles/media" as *;
.additional-settings {
  width: 100%;
  min-width: 0;
  max-width: 1200px;
  margin: 0 auto;
  padding: 28px 32px 40px;
  &__back {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    margin-bottom: 12px;
    color: var(--fv-color-text-secondary);
    font-size: var(--fv-text-p4-size);
    line-height: var(--fv-text-p4-lh);
  }
  &__heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 24px;
    h1 {
      margin: 0 0 8px;
      font-size: 30px;
      line-height: 36px;
    }
    p {
      margin: 0;
      color: var(--fv-color-text-secondary);
      font-size: var(--fv-text-p4-size);
      line-height: var(--fv-text-p4-lh);
    }
  }
  &__save-hint {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    color: var(--fv-color-text-secondary);
    font-size: var(--fv-text-caption-size);
    line-height: var(--fv-text-caption-lh);
    :deep(svg) {
      color: var(--fv-color-positive);
    }
  }
  &__shell {
    display: grid;
    grid-template-columns: 260px minmax(0, 1fr);
    align-items: start;
    min-width: 0;
    border: 1px solid var(--fv-color-border);
    border-radius: 18px;
    background: var(--fv-color-bg-primary);
    box-shadow: var(--fv-shadow-low);
    overflow: clip;
  }
  &__categories {
    align-self: stretch;
    padding: 20px 16px;
    border-right: 1px solid var(--fv-color-border);
    background: var(--fv-color-bg-secondary);
    h2 {
      font: 700 17px/24px var(--fv-font-ui);
      margin: 0 0 8px;
    }
    > p {
      margin: 0 0 16px;
      color: var(--fv-color-text-secondary);
      font-size: 12px;
      line-height: 16px;
    }
    button {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      min-height: 64px;
      padding: 12px 10px;
      border: 1px solid transparent;
      border-radius: 8px;
      background: transparent;
      color: var(--fv-color-text-secondary);
      text-align: left;
      font: inherit;
      font-size: 14px;
      line-height: 20px;
      cursor: pointer;
      :deep(svg) {
        flex-shrink: 0;
      }
      > span {
        min-width: 0;
      }
      small {
        display: block;
        color: var(--fv-color-text-tertiary);
        font-size: 12px;
        line-height: 16px;
        margin-top: 2px;
      }
      &[aria-pressed="true"] {
        background: var(--fv-color-bg-primary);
        border-color: var(--fv-color-border);
        color: var(--fv-color-text-primary);
      }
      &:disabled {
        cursor: wait;
        opacity: 0.5;
      }
    }
  }
  &__detail {
    min-width: 0;
  }
  &__selected {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 20px 22px;
    border-bottom: 1px solid var(--fv-color-border);
    h2 {
      margin: 0 0 4px;
      font: 700 17px/24px var(--fv-font-ui);
    }
    p {
      margin: 0;
      color: var(--fv-color-text-secondary);
      font-size: 12px;
      line-height: 16px;
    }
  }
  &__icon {
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    border-radius: var(--fv-radius-sm);
    color: var(--fv-color-accent);
    background: var(--fv-color-accent-soft);
  }
  &__content {
    min-width: 0;
    padding: 20px 22px;
  }
  &__note {
    margin: 16px 0 0;
    color: var(--fv-color-text-secondary);
    font-size: var(--fv-text-p4-size);
    line-height: var(--fv-text-p4-lh);
  }
  button:focus-visible,
  &__back:focus-visible {
    outline: 2px solid var(--fv-color-accent);
    outline-offset: 2px;
  }
}
@include mediaMax(1000px) {
  .additional-settings__shell {
    grid-template-columns: 220px minmax(0, 1fr);
  }
}
@include mediaMax(767px) {
  .additional-settings {
    padding: 24px var(--fv-gutter-mobile);
    &__heading {
      align-items: flex-start;
      flex-direction: column;
      gap: 12px;
      h1 {
        font-size: 25px;
        line-height: 30px;
      }
    }
    &__shell {
      display: block;
    }
    &__categories {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 4px;
      padding: 8px;
      border: 0;
      border-bottom: 1px solid var(--fv-color-border);
      > h2,
      > p,
      button small,
      button :deep(svg) {
        display: none;
      }
      button {
        position: relative;
        justify-content: center;
        text-align: center;
        min-height: 48px;
        padding: 8px 4px;
        font-size: 12px;
        line-height: 16px;
        &[aria-pressed="true"]::after {
          content: "";
          position: absolute;
          left: 8px;
          right: 8px;
          bottom: 0;
          height: 3px;
          border-radius: 2px;
          background: var(--fv-color-brand);
        }
      }
    }
    &__selected,
    &__content {
      padding: 16px;
    }
  }
}
</style>
