<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import {
  Button as AButton,
  Select as ASelect,
  Textarea as ATextarea,
} from "ant-design-vue";
import BaseModal from "@/components/BaseModal/BaseModal.vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import api, { getApiResponseMessage } from "@/services/api";
import { useMainStore } from "@/state/state";
import { friendlyRequestError, getRequestStatus } from "@/utils/friendlyError";
import { createRequestGuard } from "@/utils/requestGuard";
import { trackUsage } from "@/services/usage";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  imported: [];
}>();
const main = useMainStore();
const format = ref<"json" | "csv">("json");
const content = ref("");
const fileInput = ref<HTMLInputElement | null>(null);
const filename = ref("");
const readable = ref("");
const error = ref("");
const busy = ref<"check" | "import" | "file" | null>(null);
const result = ref<{ added: number; skipped: number } | null>(null);
interface Preview {
  valid: boolean;
  proof: string | null;
  ready: number;
  existing: number;
  errors: number;
  rows: {
    row: number;
    title: string;
    watchStatus: string;
    isFavorite: boolean;
    personalRate: number;
    status: "ready" | "exists" | "error";
    issue: string;
  }[];
}
const preview = ref<Preview | null>(null);
let checkedInput = "";
let controller: AbortController | undefined;
const requests = createRequestGuard();
const MAX_BYTES = 32768;
const canImport = computed(
  () =>
    !busy.value &&
    preview.value?.valid &&
    !!preview.value.proof &&
    preview.value.ready > 0
);
const exampleJson = JSON.stringify(
  {
    version: 1,
    movies: [
      {
        title: "Начало",
        isSerial: false,
        year: 2010,
        watchStatus: "COMPLETED",
        isFavorite: true,
        personalRate: 8,
      },
    ],
  },
  null,
  2
);
const exampleCsv =
  "title,isSerial,year,watchStatus,isFavorite,seeLater,personalRate\nНачало,false,2010,COMPLETED,true,false,8\n";
const statusLabels = {
  ready: "Будет добавлен",
  exists: "Уже в коллекции, будет пропущен",
  error: "Ошибка",
};
const watchLabels: Record<string, string> = {
  NOT_STARTED: "Не начато",
  WATCHING: "Смотрю",
  COMPLETED: "Просмотрено",
  DROPPED: "Брошено",
};

function invalidate() {
  requests.invalidate();
  controller?.abort();
  preview.value = null;
  checkedInput = "";
  busy.value = null;
  error.value = "";
  result.value = null;
}

watch(
  [format, content],
  () => {
    filename.value = "";
    readable.value = "";
    invalidate();
  },
  { flush: "sync" }
);
watch(
  () => main.sessionRevision,
  () => {
    invalidate();
    emit("update:modelValue", false);
  },
  { flush: "sync" }
);
watch(
  () => props.modelValue,
  (value) => {
    if (!value) invalidate();
  }
);
onBeforeUnmount(() => {
  requests.invalidate();
  controller?.abort();
});
function close() {
  if (busy.value !== "import") emit("update:modelValue", false);
}

function inputKey() {
  return format.value + "\n" + content.value;
}

function toggleReadable() {
  if (readable.value) {
    readable.value = "";

    return;
  }

  try {
    if (new TextEncoder().encode(content.value).length > MAX_BYTES)
      throw new Error("Файл должен быть не больше 32 КБ");
    readable.value = JSON.stringify(
      JSON.parse(content.value.replace(/^\ufeff/, "")),
      null,
      2
    );
  } catch {
    error.value =
      "Не удалось представить JSON. Проверьте его синтаксис и размер файла.";
  }
}

function validate() {
  if (!content.value.trim())
    throw new Error("Выберите файл или вставьте его содержимое");
  if (new TextEncoder().encode(content.value).length > MAX_BYTES)
    throw new Error("Файл должен быть не больше 32 КБ");
  const text = content.value.replace(/^\ufeff/, "");
  if (format.value === "json") {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Некорректный JSON");
    }

    if (
      !data ||
      typeof data !== "object" ||
      !("version" in data) ||
      data.version !== 1 ||
      !("movies" in data) ||
      !Array.isArray(data.movies) ||
      data.movies.length < 1 ||
      data.movies.length > 200
    )
      throw new Error(
        "Ожидается JSON версии 1 с массивом movies от 1 до 200 записей"
      );
  } else {
    if (text.trimEnd().split(/\r\n|\r|\n/).length > 201)
      throw new Error("Не более 200 записей за один импорт");
    const header = text
      .split(/\r\n|\r|\n/, 1)[0]
      .split(",")
      .map((value) => value.replace(/^"|"$/g, ""));
    if (
      !["title", "isSerial", "watchStatus"].every((key) => header.includes(key))
    )
      throw new Error(
        "В CSV нужны заголовки title,isSerial,watchStatus. Сверьтесь с примером."
      );
  }
}

async function chooseFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file || busy.value) return;
  invalidate();
  const current = requests.begin();
  busy.value = "file";
  try {
    const extension = file.name.split(".").at(-1)?.toLowerCase();
    if (extension !== "csv" && extension !== "json")
      throw new Error("Выберите файл .csv или .json");
    if (file.size > MAX_BYTES)
      throw new Error("Файл должен быть не больше 32 КБ");
    const bytes = await file.arrayBuffer();
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (current()) {
      format.value = extension;
      content.value = text;
      filename.value = file.name;
    }
  } catch (cause) {
    if (current())
      error.value =
        cause instanceof TypeError
          ? "Сохраните файл в кодировке UTF-8"
          : (cause as Error).message;
  } finally {
    if (current()) busy.value = null;
  }
}

async function check() {
  if (busy.value || !main.userData?.id) return;
  invalidate();
  try {
    validate();
  } catch (cause) {
    error.value = (cause as Error).message;

    return;
  }

  const current = requests.begin();
  const key = inputKey();
  busy.value = "check";
  controller = new AbortController();
  try {
    const response = await api.post<Preview>(
      `/users/${main.userData.id}/movies/import/check`,
      { format: format.value, content: content.value },
      { signal: controller.signal, timeout: 15000 }
    );
    if (current() && key === inputKey()) {
      preview.value = response.data;
      checkedInput = key;
    }
  } catch (cause) {
    if (current())
      error.value = getApiResponseMessage(cause) ?? friendlyRequestError(cause);
  } finally {
    if (current()) busy.value = null;
  }
}

async function commit() {
  if (!canImport.value || !main.userData?.id || checkedInput !== inputKey())
    return;
  try {
    validate();
  } catch (cause) {
    invalidate();
    error.value = (cause as Error).message;

    return;
  }

  const current = requests.begin();
  busy.value = "import";
  error.value = "";
  controller = new AbortController();
  try {
    const response = await api.post<{ added: number; skipped: number }>(
      `/users/${main.userData.id}/movies/import`,
      {
        format: format.value,
        content: content.value,
        proof: preview.value!.proof,
      },
      { signal: controller.signal, timeout: 30000 }
    );
    if (current()) {
      result.value = response.data;
        if(response.data.added>0)trackUsage(`/users/${main.userData.id}/movies/import`,'POST');
      preview.value = null;
      checkedInput = "";
      emit("imported");
    }
  } catch (cause) {
    if (current()) {
      if ([400, 409].includes(getRequestStatus(cause) ?? 0)) {
        preview.value = null;
        checkedInput = "";
      }

      error.value = getApiResponseMessage(cause) ?? friendlyRequestError(cause);
    }
  } finally {
    if (current()) busy.value = null;
  }
}

function downloadExample(kind: "csv" | "json") {
  const url = URL.createObjectURL(
    new Blob([kind === "json" ? exampleJson : exampleCsv], {
      type: kind === "json" ? "application/json" : "text/csv;charset=utf-8",
    })
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `favorite-collection-example.${kind}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
</script>

<template>
  <BaseModal
    :model-value="modelValue"
    layout="detail"
    @update:model-value="close"
  >
    <template #title>Импорт коллекции</template>
    <template #body>
      <div class="collection-import">
        <p>
          CSV с разделителем-запятой или JSON нашего формата, UTF-8, до 32 КБ и 200 записей. Названия
          сверяются с каталогом без учёта регистра и лишних пробелов. Тип и
          указанный год должны совпадать.
        </p>
        <p>
          Существующие записи пропустим, сохранив ваши оценки и прогресс.
          Неизвестные тайтлы сначала добавьте в каталог. Ошибки и дубли в файле
          блокируют всю партию.
        </p>
        <details>
          <summary>Пример JSON</summary>
          <pre>{{ exampleJson }}</pre>
          <AButton :disabled="!!busy" @click="downloadExample('json')"
            >Скачать пример JSON</AButton
          >
        </details>
        <details>
          <summary>Пример CSV</summary>
          <pre>{{ exampleCsv }}</pre>
          <AButton :disabled="!!busy" @click="downloadExample('csv')"
            >Скачать пример CSV</AButton
          >
        </details>
        <p class="collection-import__hint">
          Замените пример своими данными. watchStatus: NOT_STARTED, WATCHING,
          COMPLETED или DROPPED. isSerial/isFavorite/seeLater: true или false.
          personalRate: целое число 0–10, где 0 означает без оценки. year,
          isFavorite, seeLater и personalRate необязательны. Прогресс серий при
          статусе COMPLETED будет выставлен до конца по данным каталога.
        </p>
        <span class="collection-import__label">Файл коллекции</span>
        <div class="collection-import__file">
          <input
            ref="fileInput"
            type="file"
            accept=".csv,.json"
            hidden
            :disabled="!!busy"
            @change="chooseFile"
          />
          <AButton
            :disabled="!!busy"
            :loading="busy === 'file'"
            aria-describedby="collection-import-filename"
            @click="fileInput?.click()"
            ><BaseIcon
              name="ph:upload-simple"
              :width="18"
              :height="18"
            />Выбрать файл</AButton
          >
          <span
            id="collection-import-filename"
            class="collection-import__filename"
            aria-live="polite"
            >{{
              filename || "Файл не выбран. Можно вставить содержимое ниже."
            }}</span
          >
        </div>
        <label for="collection-import-format">Формат</label
        ><ASelect
          id="collection-import-format"
          v-model:value="format"
          class="collection-import__format"
          :options="[
            { value: 'json', label: 'JSON' },
            { value: 'csv', label: 'CSV' },
          ]"
          :get-popup-container="(trigger: HTMLElement) => trigger.parentElement ?? trigger"
          :disabled="busy === 'import' || busy === 'file'"
        >
          <template #suffixIcon
            ><BaseIcon name="ph:caret-down" :width="16" :height="16"
          /></template>
        </ASelect>
        <div class="collection-import__content-head">
          <label for="collection-import-content">Содержимое файла</label
          ><AButton
            v-if="format === 'json'"
            data-testid="import-readable"
            :disabled="!!busy || !content.trim()"
            :aria-pressed="!!readable"
            @click="toggleReadable"
            >{{ readable ? "Исходный текст" : "Читаемый JSON" }}</AButton
          >
        </div>
        <pre
          v-if="readable"
          data-testid="import-pretty"
          class="collection-import__pretty"
          tabindex="0"
          aria-label="Читаемый JSON"
          >{{ readable }}</pre
        >
        <ATextarea
          v-else
          id="collection-import-content"
          v-model:value="content"
          :rows="6"
          :maxlength="32768"
          :disabled="busy === 'import' || busy === 'file'"
          spellcheck="false"
        />
        <p v-if="error" role="alert" class="collection-import__error">
          {{ error }}
        </p>
        <p v-if="result" role="status">
          Импорт завершён. Добавлено: {{ result.added }}. Пропущено:
          {{ result.skipped }}. Коллекция обновлена.
        </p>
        <section v-if="preview" aria-label="Результат проверки">
          <h4>Результат проверки</h4>
          <p>
            К добавлению: {{ preview.ready }} · Уже есть:
            {{ preview.existing }} · Ошибок: {{ preview.errors }}
          </p>
          <p v-if="!preview.valid" role="alert">
            Исправьте ошибки и нажмите «Проверить» ещё раз.
          </p>
          <p v-else-if="!preview.ready">Все записи уже есть в коллекции.</p>
          <ol class="collection-import__rows" tabindex="0" aria-label="Записи файла">
            <li v-for="row in preview.rows" :key="row.row">
              <strong>{{ row.title }}</strong
              ><span>{{ statusLabels[row.status] }}</span
              ><span v-if="row.issue" class="collection-import__error">{{
                row.issue
              }}</span
              ><span v-else-if="row.status === 'ready'"
                >{{ watchLabels[row.watchStatus] }} · Оценка:
                {{ row.personalRate || "нет" }} ·
                {{ row.isFavorite ? "В избранном" : "Без избранного" }}</span
              ><span v-else
                >Текущие оценка, избранное и прогресс сохранятся.</span
              >
            </li>
          </ol>
          <p>
            Проверка действует 10 минут. Изменение файла потребует новой
            проверки.
          </p>
        </section>
      </div>
    </template>
    <template #footer>
      <AButton :disabled="busy === 'import'" @click="close">Закрыть</AButton>
      <AButton
        data-testid="import-check"
        :disabled="!!busy"
        :loading="busy === 'check' || busy === 'file'"
        @click="check"
        >Проверить</AButton
      >
      <AButton
        data-testid="import-commit"
        type="primary"
        :disabled="!canImport"
        :loading="busy === 'import'"
        @click="commit"
        >Импортировать{{ preview?.ready ? " " + preview.ready : "" }}</AButton
      >
    </template>
  </BaseModal>
</template>
<style scoped lang="scss">
.collection-import {
  min-width: 0;
  p {
    color: var(--fv-color-text-secondary);
    line-height: 1.5;
  }
  label,
  &__label {
    display: block;
    margin: 16px 0 6px;
    font-weight: 500;
  }
  textarea,
  input {
    font: inherit;
    max-width: 100%;
  }
  textarea {
    width: 100%;
    padding: 10px;
    border: 1px solid var(--fv-color-border);
    border-radius: var(--fv-radius-sm);
    background: var(--fv-color-bg-secondary);
    color: var(--fv-color-text-primary);
  }
  textarea {
    resize: vertical;
    font-family: monospace;
  }
  &__file {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    button {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
  }
  &__filename {
    font-size: 13px;
    color: var(--fv-color-text-secondary);
    overflow-wrap: anywhere;
    min-width: 0;
  }
  &__format {
    width: 100%;
  }
  details {
    margin: 12px 0;
  }
  summary {
    cursor: pointer;
    color: var(--fv-color-link);
  }
  pre {
    max-width: 100%;
    overflow-x: auto;
    padding: 12px;
    background: var(--fv-color-bg-secondary);
    font-size: 12px;
  }
  &__hint {
    font-size: 13px;
  }
  &__content-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    margin: 16px 0 6px;
    label {
      margin: 0;
    }
  }
  &__pretty {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    max-height: 320px;
    overflow-y: auto;
    line-height: 1.5;
    border-radius: var(--fv-radius-sm);
    margin: 0;
  }
  &__error {
    color: var(--fv-color-negative) !important;
  }
  &__rows {
    padding-left: 24px;
    max-height: 360px;
    overflow-y: auto;
    li {
      padding: 12px 0;
      border-bottom: 1px solid var(--fv-color-border);
      overflow-wrap: anywhere;
    }
    span {
      display: block;
      margin-top: 4px;
    }
  }
}
</style>
