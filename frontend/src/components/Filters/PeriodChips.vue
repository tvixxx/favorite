<script setup lang="ts">
import { computed } from "vue";
import dayjs, { type Dayjs } from "dayjs";

/** Периоды выхода чипами (эталон) — вместо календарного пикера «От/До» */
const range = defineModel<[Dayjs, Dayjs] | null>({ default: null });

type Period = { key: string; label: string; from?: number; to?: number };

const CURRENT_YEAR = dayjs().year();

const PERIODS: Period[] = [
  { key: "any", label: "Любой год" },
  { key: "2020", label: "2020 и новее", from: 2020 },
  { key: "2010", label: "2010–2019", from: 2010, to: 2019 },
  { key: "2000", label: "2000–2009", from: 2000, to: 2009 },
  { key: "old", label: "До 2000", to: 1999 },
];

const activeKey = computed(() => {
  const [from, to] = range.value ?? [];

  if (!from || !to) {
    return "any";
  }

  const period = PERIODS.find(
    (p) =>
      (p.from ?? 1900) === dayjs(from).year() &&
      (p.to ?? CURRENT_YEAR) === dayjs(to).year(),
  );

  return period?.key ?? "";
});

const select = (period: Period): void => {
  range.value =
    period.key === "any"
      ? null
      : [
          dayjs(`${period.from ?? 1900}-01-01`),
          dayjs(`${period.to ?? CURRENT_YEAR}-12-31`),
        ];
};
</script>

<template>
  <div class="period-chips">
    <span class="period-chips__label">Дата выхода</span>
    <div class="period-chips__row" role="group">
      <button
        v-for="period in PERIODS"
        :key="period.key"
        type="button"
        class="period-chips__chip"
        :class="{ 'period-chips__chip--active': activeKey === period.key }"
        @click="select(period)"
      >
        {{ period.label }}
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.period-chips {
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__label {
    font-size: 13px;
    font-weight: 500;
    color: var(--fv-color-text-secondary);
  }

  &__row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  &__chip {
    height: 36px;
    padding: 0 16px;
    border: 1px solid var(--fv-color-border);
    border-radius: 999px;
    background: var(--fv-color-bg-primary);
    color: var(--fv-color-text-primary);
    font: inherit;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition:
      background var(--fv-motion-fast) var(--fv-ease),
      color var(--fv-motion-fast) var(--fv-ease);

    &:hover:not(&--active) {
      background: var(--fv-color-bg-secondary);
    }

    &--active {
      background: var(--fv-color-text-primary);
      border-color: transparent;
      color: var(--fv-color-bg-primary);
    }
  }
}
</style>
