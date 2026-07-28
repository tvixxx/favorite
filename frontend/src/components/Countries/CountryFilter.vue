<script setup lang="ts">
import MultiSelectField from "@/components/MoviesFiltersPanel/MultiSelectField.vue";
import {
  PRODUCTION_COUNTRIES,
  type ProductionCountryOption,
} from "@/constants/countries/production-countries";

const selectedCountries = defineModel<string[]>({ default: () => [] });

const options = PRODUCTION_COUNTRIES.map((c: ProductionCountryOption) => ({
  value: c.code,
  label: c.label,
}));
</script>

<template>
  <MultiSelectField
    v-model="selectedCountries"
    :options="options"
    label="Страны"
    placeholder="Добавить страну…"
  />
</template>
