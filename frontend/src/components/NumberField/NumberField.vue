<script setup lang="ts">
import { computed, ref, useId, watch, watchEffect } from "vue";
import { Input as AInput } from "ant-design-vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import { numericDraftError } from "@/utils/media-numbers";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    label: string;
    min?: number;
    max?: number;
    disabled?: boolean;
    placeholder?: string;
    controls?: boolean;
    compact?: boolean;
    minDigits?: number;
    maxDigits?: number;
  }>(),
  { placeholder: "—", controls: true }
);
const model = defineModel<number | undefined>();
const root = ref<HTMLElement>();
const draft = ref(model.value === undefined ? "" : String(model.value));
const touched = ref(false);
const errorId = useId();
const inputMaxLength = computed(
  () =>
    props.maxDigits ??
    (props.max === undefined ? undefined : String(props.max).length)
);
const error = computed(() => numericDraftError(draft.value, props));
const showError = computed(() =>
  Boolean(
    error.value &&
      (touched.value || /^0\d/.test(draft.value) || /\D/.test(draft.value))
  )
);
const canDecrease = computed(
  () =>
    !props.disabled &&
    !error.value &&
    model.value !== undefined &&
    model.value > (props.min ?? -Infinity)
);
const canIncrease = computed(
  () =>
    !props.disabled &&
    !error.value &&
    (model.value === undefined || model.value < (props.max ?? Infinity))
);

watch(model, (value) => {
  if (!Number.isNaN(value))
    draft.value = value === undefined ? "" : String(value);
  if (value === undefined) touched.value = false;
});

watchEffect(
  () => {
    root.value?.querySelector("input")?.setCustomValidity(error.value);
  },
  { flush: "post" }
);

function changeBy(direction: number): void {
  if (props.disabled || error.value) return;

  const next =
    model.value === undefined ? props.min ?? 0 : model.value + direction;

  model.value = Math.min(
    props.max ?? Infinity,
    Math.max(props.min ?? -Infinity, next)
  );
}

function updateValue(value: string): void {
  draft.value =
    inputMaxLength.value === undefined
      ? value
      : value.slice(0, inputMaxLength.value);

  const input = root.value?.querySelector("input");

  if (input && input.value !== draft.value) input.value = draft.value;
  // Ошибочный черновик не должен оставлять в форме прежнее допустимое число.
  model.value = error.value
    ? Number.NaN
    : draft.value === ""
    ? undefined
    : Number(draft.value);
}

function onKeydown(event: KeyboardEvent): void {
  if (!props.controls || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
  event.preventDefault();
  if (event.key === "ArrowUp" ? canIncrease.value : canDecrease.value)
    changeBy(event.key === "ArrowUp" ? 1 : -1);
}

function onInvalid(event: Event): void {
  touched.value = true;
  event.preventDefault();

  const input = event.target as HTMLInputElement;
  const firstInvalid = input.form?.querySelector("input:invalid");

  if (!firstInvalid || firstInvalid === input) input.focus();
}
</script>

<template>
  <div ref="root" class="number-control" @invalid.capture="onInvalid">
    <div
      class="number-field fv-native-field"
      :aria-invalid="showError || undefined"
      :class="{
        'number-field_disabled': disabled,
        'number-field_plain': !controls,
        'number-field_compact': compact,
      }"
    >
      <button
        v-if="controls"
        type="button"
        class="number-field__step"
        :aria-label="`Уменьшить: ${label}`"
        :disabled="!canDecrease"
        @click="changeBy(-1)"
      >
        <BaseIcon name="ph:minus" :width="18" :height="18" aria-hidden="true" />
      </button>
      <AInput
        v-bind="$attrs"
        :value="draft"
        :maxlength="inputMaxLength"
        :disabled="disabled"
        :aria-label="label"
        :placeholder="placeholder"
        inputmode="numeric"
        :role="controls ? 'spinbutton' : undefined"
        :aria-valuemin="controls ? min : undefined"
        :aria-valuemax="controls ? max : undefined"
        :aria-valuenow="
          controls && !error && model !== undefined ? model : undefined
        "
        :aria-invalid="showError || undefined"
        :aria-describedby="showError ? errorId : undefined"
        @update:value="updateValue"
        @keydown="onKeydown"
        @blur="touched = true"
      />
      <button
        v-if="controls"
        type="button"
        class="number-field__step"
        :aria-label="`Увеличить: ${label}`"
        :disabled="!canIncrease"
        @click="changeBy(1)"
      >
        <BaseIcon name="ph:plus" :width="18" :height="18" aria-hidden="true" />
      </button>
    </div>
    <p
      v-if="showError"
      :id="errorId"
      class="number-control__error"
      role="alert"
    >
      {{ error }}
    </p>
  </div>
</template>

<style scoped lang="scss">
.number-control {
  min-width: 0;
  width: 100%;
}

.number-control__error {
  margin: 6px 0 0;
  color: var(--fv-color-negative);
  font-size: 13px;
  font-weight: 400;
  line-height: 1.5;
}

.number-field {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  padding: 4px;

  &_disabled {
    opacity: 0.55;
  }

  :deep(.ant-input) {
    flex: 1;
    min-width: 0;
    width: 0;
    background: transparent !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    opacity: 1 !important;
  }

  :deep(.ant-input) {
    height: 40px;
    min-height: 0;
    padding: 0 4px;
    text-align: center;
    font-size: 15px;
    font-variant-numeric: tabular-nums;
    color: var(--fv-color-text-primary);
  }

  &_plain :deep(.ant-input) {
    text-align: left;
    padding: 0 10px;
  }

  &_compact {
    min-height: 44px;

    :deep(.ant-input) {
      height: 32px;
      font-size: 14px;
    }

    .number-field__step {
      width: 32px;
      height: 32px;
    }
  }

  &__step {
    display: grid;
    place-items: center;
    flex: none;
    width: 40px;
    height: 40px;
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: var(--fv-color-bg-primary);
    color: var(--fv-color-text-secondary);
    cursor: pointer;

    &:hover:not(:disabled) {
      background: var(--fv-color-accent-soft);
      color: var(--fv-color-accent);
    }

    &:focus-visible {
      outline: 2px solid var(--fv-color-accent);
      outline-offset: -2px;
    }

    &:disabled {
      opacity: 0.35;
      cursor: default;
    }
  }
}
</style>
