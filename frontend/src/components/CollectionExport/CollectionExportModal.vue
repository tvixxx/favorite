<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import {
  Button as AButton,
  Radio as ARadio,
  RadioGroup as ARadioGroup,
  Checkbox as ACheckbox,
} from "ant-design-vue";
import BaseModal from "@/components/BaseModal/BaseModal.vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import AppDisclosure from '@/components/AppDisclosure/AppDisclosure.vue';
import { useMainStore } from "@/state/state";
import { useUserMoviesStore } from "@/stores";
import { buildUserSearchParams } from "@/stores/userMovies/build-user-search-params";
import {
  fetchCollectionFile,
  downloadCollectionFile,
  type CollectionReport,
} from "@/services/collectionFiles";
import { getApiResponseMessage } from "@/services/api";
import { createRequestGuard } from "@/utils/requestGuard";
import { pluralize, PLURAL } from "@/utils";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ "update:modelValue": [value: boolean] }>();
const main = useMainStore();
const collection = useUserMoviesStore();
const format = ref<"json" | "csv" | "pdf">("json");
const scope = ref<"all" | "filtered" | "completed">("all");
const posters = ref(true);
const busy = ref(false);
const error = ref("");
const notice = ref("");
const guard = createRequestGuard();
let controller: AbortController | undefined;
let printWindow: Window | null = null;
const filterParams = computed(() =>
  buildUserSearchParams(
    collection.filters,
    collection.searchQuery.trim() || undefined
  )
);
const hasFilters = computed(() => filterParams.value.size > 0);
const total = computed(() => collection.stats?.totalMovies);

function invalidate(): void {
  guard.invalidate();
  controller?.abort();
  printWindow?.close();
  printWindow = null;
  busy.value = false;
  error.value = "";
  notice.value = "";
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) invalidate();
  }
);
watch(
  () => [main.sessionRevision, main.userData?.id],
  () => {
    invalidate();
    emit("update:modelValue", false);
  },
  { flush: "sync" }
);
watch(format, (value, previous) => {
  if (value === "pdf") scope.value = "completed";
  else if (previous === "pdf" && scope.value === "completed")
    scope.value = "all";
  error.value = "";
  notice.value = "";
});
onBeforeUnmount(invalidate);

async function save(print = false): Promise<void> {
  if (busy.value || !main.userData?.id) return;
  error.value = "";
  notice.value = "";
  if (print) {
    printWindow = window.open("", "_blank");
    if (!printWindow) {
      error.value =
        "Разрешите всплывающее окно для печати и повторите попытку.";

      return;
    }

    printWindow.opener = null;
    printWindow.document.title = "Подготовка PDF";
  }

  const isCurrent = guard.begin();
  controller = new AbortController();
  const signal = controller.signal;
  const userId = main.userData.id;
  const selectedFormat = format.value;
  const params =
    scope.value === "filtered"
      ? new URLSearchParams(filterParams.value)
      : new URLSearchParams();
  params.set("format", selectedFormat);
  params.set("scope", scope.value);
  busy.value = true;
  try {
    const data = await fetchCollectionFile(userId, params, signal);
    if (!isCurrent() || main.userData?.id !== userId) return;
    if (data === null) {
      notice.value = "В выбранной выборке нет тайтлов.";
      printWindow?.close();
      printWindow = null;

      return;
    }

    if (selectedFormat === "pdf") {
      const report = data as CollectionReport;
      if (!Array.isArray(report.movies))
        throw new Error("Некорректный ответ сервера");
      if (!report.movies.length) {
        notice.value = "В выбранной выборке нет тайтлов.";
        printWindow?.close();
        printWindow = null;

        return;
      }

      const { createCollectionPdf } = await import("@/services/collectionPdf");
      const pdf = await createCollectionPdf(report, {
        posters: posters.value,
        timezone: main.userData?.timezone ?? "UTC",
        completedOnly: scope.value === "completed",
        signal,
      });
      if (!isCurrent() || signal.aborted) return;
      if (print && printWindow) {
        await pdf.print(printWindow);
        printWindow = null;
      } else
        downloadCollectionFile(
          pdf.blob,
          `favorite-collection-${report.exportedAt.slice(0, 10)}.pdf`
        );
      notice.value = pdf.missingPosters
        ? `Файл подготовлен. Недоступных постеров: ${pdf.missingPosters}. Вместо них использованы иллюстрированные обложки.`
        : print
        ? "Документ открыт для печати."
        : "Скачивание началось.";
    } else {
      if (!(data instanceof Blob)) throw new Error("Некорректный файл");
      downloadCollectionFile(
        data,
        `favorite-collection-${new Date()
          .toISOString()
          .slice(0, 10)}.${selectedFormat}`
      );
      notice.value = "Скачивание началось.";
    }
  } catch (cause) {
    if (isCurrent()) {
      if (!signal.aborted)
        error.value =
          getApiResponseMessage(cause) ||
          "Не удалось подготовить файл. Повторите попытку.";
      printWindow?.close();
      printWindow = null;
    }
  } finally {
    if (isCurrent()) busy.value = false;
  }
}
</script>

<template>
  <BaseModal
    :model-value="modelValue"
    layout="form"
    class="collection-export"
    @update:model-value="emit('update:modelValue', $event ?? false)"
  >
    <template #title>Скачать коллекцию</template>
    <template #body>
      <fieldset class="collection-export__group" :disabled="busy">
        <legend>Формат файла</legend>
        <ARadioGroup v-model:value="format" class="collection-export__formats">
          <ARadio value="json" class="collection-export__format"
            ><strong>JSON</strong><small>Для переноса в Favorite</small></ARadio
          >
          <ARadio value="csv" class="collection-export__format"
            ><strong>CSV</strong><small>Для Excel и таблиц</small></ARadio
          >
          <ARadio value="pdf" class="collection-export__format"
            ><strong>PDF</strong><small>Для отправки и печати</small></ARadio
          >
        </ARadioGroup>
      </fieldset>
      <fieldset class="collection-export__group" :disabled="busy">
        <legend>Какие тайтлы скачать</legend>
        <ARadioGroup v-model:value="scope" class="collection-export__scopes">
          <ARadio value="all"
            >Вся коллекция
            <small v-if="total !== undefined"
              >{{ pluralize(total, PLURAL.title) }}, независимо от
              фильтров</small
            ></ARadio
          >
          <ARadio v-if="hasFilters" value="filtered"
            >По текущим фильтрам
            <small
              >{{ pluralize(collection.totalCount, PLURAL.title) }}, включая все
              страницы</small
            ></ARadio
          >
          <ARadio v-if="format === 'pdf'" value="completed"
            >Только просмотренное</ARadio
          >
        </ARadioGroup>
      </fieldset>
      <template v-if="format === 'pdf'">
        <ACheckbox v-model:checked="posters" :disabled="busy"
          >С постерами</ACheckbox
        >
        <p class="collection-export__hint">
          Краткий список с названием, годом, типом, оценкой и датой завершения.
          Без отзывов. Файл можно отправить другому человеку.
        </p>
      </template>
      <template v-else>
        <AppDisclosure class="collection-export__details" label="Что войдёт в файл">
          <ul>
            <li>Название, год, вид и формат</li>
            <li>Статус, оценка, избранное и «Посмотреть позже»</li>
            <li>Текущий сезон и серия</li>
            <li>
              Даты добавления, начала, завершения, последнего просмотра и отказа
            </li>
          </ul>
        </AppDisclosure>
        <p class="collection-export__hint">
          Отзывы, списки и изображения не включаются. Формат версии 2 сохраняет
          прогресс и даты при обратном импорте.
        </p>
      </template>
      <p v-if="error" class="collection-export__error" role="alert">
        {{ error }}
      </p>
      <p v-if="notice" class="collection-export__hint" role="status">
        {{ notice }}
      </p>
      <p v-if="busy" class="collection-export__hint" role="status">
        Подготавливаем файл…
      </p>
    </template>
    <template #footer>
      <AButton @click="emit('update:modelValue', false)">Отмена</AButton>
      <AButton
        v-if="format === 'pdf'"
        :disabled="busy"
        @click="save(true)"
        aria-label="Открыть для печати"
        >Печать</AButton
      >
      <AButton type="primary" :loading="busy" :disabled="busy" @click="save()"
        ><BaseIcon name="ph:download-simple" :width="18" :height="18" /><span
          >Скачать {{ format.toUpperCase() }}</span
        ></AButton
      >
    </template>
  </BaseModal>
</template>

<style scoped lang="scss">
@use "@/styles/media" as *;

.collection-export {
  &__group {
    border: 0;
    padding: 0;
    margin: 0 0 22px;
    min-width: 0;
  }
  &__group legend {
    margin-bottom: 12px;
    color: var(--fv-color-text-secondary);
    font-size: 14px;
    font-weight: 500;
  }
  &__formats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    width: 100%;
  }
  &__format {
    display: flex;
    align-items: flex-start;
    padding: 12px 10px;
    margin: 0;
    border: 1px solid var(--fv-color-border);
    border-radius: 12px;
    white-space: normal;
  }
  &__format:has(input:checked) {
    border-color: var(--fv-color-brand);
    background: color-mix(
      in srgb,
      var(--fv-color-brand) 5%,
      var(--fv-color-bg-primary)
    );
  }
  &__format strong {
    display: block;
    font-weight: 600;
  }
  &__formats small,
  &__scopes small {
    display: block;
    color: var(--fv-color-text-secondary);
    font-size: 12px;
    margin-top: 4px;
  }
  &__scopes {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  &__details {
    border-top: 1px solid var(--fv-color-border);
    padding-top: 16px;
  }
  &__details ul {
    padding-left: 20px;
    margin-top: 12px;
    color: var(--fv-color-text-secondary);
  }
  &__hint {
    color: var(--fv-color-text-secondary);
    font-size: 13px;
    line-height: 1.5;
    margin: 16px 0 22px;
  }
  &__error {
    color: var(--fv-color-negative);
    margin: 16px 0 22px;
  }
  @include mediaMax(400px) {
    &__formats {
      grid-template-columns: 1fr;
    }
  }
}
</style>

<style lang="scss">
@use "@/styles/media" as *;

.collection-export .modal__footer {
  flex-wrap: wrap;
}
@include mediaMax(480px) {
  .collection-export .modal__footer > .ant-btn {
    flex: 1 1 calc(50% - 6px);
    min-width: 0;
  }
  .collection-export .modal__footer > .ant-btn-primary {
    flex-basis: 100%;
    order: -1;
  }
}
</style>
