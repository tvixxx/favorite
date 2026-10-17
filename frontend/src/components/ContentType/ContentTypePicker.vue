<script setup lang="ts">
import { computed } from "vue";
import { type ContentKind, type ContentSelection } from "@/utils/content-kind";

const props = defineProps<{
  modelValue: ContentSelection;
  disabled?: boolean;
  legacy?: boolean;
}>();
const emit = defineEmits<{ "update:modelValue": [value: ContentSelection] }>();
const choices = [
  { value: "FILM", label: "Фильм" },
  { value: "SERIES", label: "Сериал" },
  { value: "ANIME", label: "Аниме" },
  { value: "ANIMATION", label: "Мультфильм" },
  { value: "TV_SHOW", label: "ТВ-шоу" },
] as const;
const selected = computed(() =>
  props.modelValue.contentKind === "GENERAL"
    ? props.modelValue.isSerial
      ? "SERIES"
      : "FILM"
    : props.modelValue.contentKind
);
const needsFormat = computed(
  () => !!selected.value && props.modelValue.contentKind !== "GENERAL"
);
const show = computed(() => props.modelValue.contentKind === "TV_SHOW");

function choose(value: (typeof choices)[number]["value"]): void {
  if (value === "FILM" || value === "SERIES") {
    emit("update:modelValue", {
      contentKind: "GENERAL",
      isSerial: value === "SERIES",
    });
  } else {
    emit("update:modelValue", {
      contentKind: value as ContentKind,
      isSerial: props.modelValue.isSerial,
    });
  }
}

function chooseFormat(isSerial: boolean): void {
  emit("update:modelValue", { ...props.modelValue, isSerial });
}
</script>

<template>
  <div class="content-type">
    <div class="content-type__choices" role="group" aria-label="Что добавляем">
      <button
        v-for="choice in choices"
        :key="choice.value"
        type="button"
        :aria-pressed="selected === choice.value"
        :disabled="disabled"
        class="content-type__choice"
        @click="choose(choice.value)"
      >
        {{ choice.label }}
      </button>
    </div>
    <p v-if="legacy && !selected" class="content-type__hint">
      Сейчас: {{ modelValue.isSerial ? "сериал" : "фильм" }}.
    </p>
    <div v-if="needsFormat" class="content-type__format">
      <span class="content-type__label">Формат</span>
      <div class="content-type__choices" role="group" aria-label="Формат">
        <button
          type="button"
          class="content-type__choice"
          :aria-pressed="modelValue.isSerial === false"
          :disabled="disabled"
          @click="chooseFormat(false)"
        >
          {{ show ? "Разовая программа" : "Отдельный фильм" }}
        </button>
        <button
          type="button"
          class="content-type__choice"
          :aria-pressed="modelValue.isSerial === true"
          :disabled="disabled"
          @click="chooseFormat(true)"
        >
          {{ show ? "Выпуски" : "Сериал" }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.content-type {
  &__choices {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  &__choice {
    min-height: 44px;
    max-width: 100%;
    padding: 9px 16px;
    border: 1px solid var(--fv-color-border);
    border-radius: 12px;
    background: var(--fv-color-bg-primary);
    color: var(--fv-color-text-primary);
    font: inherit;
    font-weight: 500;
    cursor: pointer;
    overflow-wrap: anywhere;
    &[aria-pressed="true"] {
      border-color: var(--fv-color-accent);
      color: var(--fv-color-text-primary);
      background: color-mix(
        in srgb,
        var(--fv-color-accent) 12%,
        var(--fv-color-bg-primary)
      );
    }
    &:focus-visible {
      outline: 2px solid var(--fv-color-accent);
      outline-offset: 3px;
    }
    &:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
  }
  &__format {
    margin-top: 16px;
  }
  &__label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
  }
  &__hint {
    margin: 10px 0 0;
    color: var(--fv-color-text-secondary);
    font-size: 14px;
  }
}
</style>
