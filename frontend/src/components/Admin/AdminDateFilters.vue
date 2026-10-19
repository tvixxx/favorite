<script setup lang="ts">
import { useId } from "vue";
import ruRU from "ant-design-vue/es/date-picker/locale/ru_RU";
import "dayjs/locale/ru";
import { useDateTime } from "@/composable/useDateTime";

const { timezone } = useDateTime();

const from = defineModel<string>("from", { required: true });
const to = defineModel<string>("to", { required: true });
const sort = defineModel<string>("sort", { required: true });
const id = useId();
</script>
<template>
  <div class="admin-filters admin-date-filters">
    <label :for="`${id}-from`"
      >С даты ({{ timezone }})<a-date-picker
        :id="`${id}-from`"
        v-model:value="from"
        value-format="YYYY-MM-DD"
        format="DD.MM.YYYY"
        :locale="ruRU"
        placeholder="Выберите дату"
        :input-read-only="true"
    /></label>
    <label :for="`${id}-to`"
      >По дату включительно<a-date-picker
        :id="`${id}-to`"
        v-model:value="to"
        value-format="YYYY-MM-DD"
        format="DD.MM.YYYY"
        :locale="ruRU"
        placeholder="Выберите дату"
        :input-read-only="true"
    /></label>
    <label :for="`${id}-sort`"
      >Порядок<a-select
        :id="`${id}-sort`"
        v-model:value="sort"
        :options="[
          { value: '', label: 'Сначала новые' },
          { value: 'oldest', label: 'Сначала старые' },
        ]"
    /></label>
  </div>
</template>
<style scoped lang="scss">
.admin-date-filters {
  margin: 16px 0;

  label {
    display: grid;
    gap: 6px;
    font-size: 14px;
    color: var(--fv-color-text-secondary);
  }
}
</style>
