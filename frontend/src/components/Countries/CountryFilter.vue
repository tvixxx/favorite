<script setup lang="ts">
import type { SelectProps } from "ant-design-vue";
import {
  PRODUCTION_COUNTRIES,
  type ProductionCountryOption,
} from "@/constants/countries/production-countries";

const selectedCountries = defineModel<string[]>({ default: () => [] });

const options: SelectProps["options"] = PRODUCTION_COUNTRIES.map(
  (c: ProductionCountryOption) => ({
    label: c.label,
    value: c.code,
  })
);

const filterOption = (input: string, option: { label?: string }) =>
  (option.label ?? "").toLowerCase().includes(input.toLowerCase());
</script>

<template>
  <a-select
    v-model:value="selectedCountries"
    mode="multiple"
    :allow-clear="true"
    :filter-option="filterOption"
    :max-tag-count="2"
    :options="options"
    class="country-filter"
    placeholder="Страны"
    show-search
    size="large"
  />
</template>

<style lang="scss" scoped>
.country-filter {
  min-width: 180px;
}
</style>
