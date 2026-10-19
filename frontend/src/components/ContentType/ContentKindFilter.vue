<script setup lang="ts">
import { Select as ASelect } from "ant-design-vue";
import { useId } from "vue";
import { contentKindOptions, type ContentKind } from "@/utils/content-kind";

const props = defineProps<{
  contentKind?: ContentKind;
  isSerial?: boolean;
  showFormat?: boolean;
}>();
const emit = defineEmits<{
  change: [patch: { contentKind?: ContentKind; isSerial?: boolean }];
}>();
const id = useId();

function selectCategory(value: unknown): void {
  emit("change", {
    contentKind: contentKindOptions.find((option) => option.value === value)
      ?.value,
  });
}

function selectFormat(value: unknown): void {
  emit("change", {
    isSerial: value === "true" ? true : value === "false" ? false : undefined,
  });
}
</script>
<template>
  <div class="content-filter">
    <label :for="`${id}-category`">Категория</label>
    <ASelect
      :id="`${id}-category`"
      :value="props.contentKind"
      :options="contentKindOptions"
      placeholder="Все категории"
      allow-clear
      @update:value="selectCategory"
    />
    <template v-if="showFormat">
      <label :for="`${id}-format`">Формат</label>
      <ASelect
        :id="`${id}-format`"
        :value="
          props.isSerial === undefined ? undefined : String(props.isSerial)
        "
        :options="[
          { value: 'false', label: 'Фильмы' },
          { value: 'true', label: 'Сериалы и выпуски' },
        ]"
        placeholder="Все форматы"
        allow-clear
        @update:value="selectFormat"
      />
    </template>
  </div>
</template>
<style scoped lang="scss">
.content-filter {
  display: grid;
  gap: 8px;
  min-width: 0;
  color: var(--fv-color-text-primary);
}

.content-filter label {
  font-weight: 500;
}

.content-filter :deep(.ant-select) {
  width: 100%;
  min-width: 0;
}
</style>
