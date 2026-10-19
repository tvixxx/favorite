<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import {
  Button as AButton,
  Select as ASelect,
  Textarea as ATextarea,
} from "ant-design-vue";
import BaseModal from "@/components/BaseModal/BaseModal.vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import AppDisclosure from "@/components/AppDisclosure/AppDisclosure.vue";
import api, { getApiResponseMessage } from "@/services/api";
import { useMainStore } from "@/state/state";
import { friendlyRequestError, getRequestStatus } from "@/utils/friendlyError";
import { createRequestGuard } from "@/utils/requestGuard";
import { trackUsage } from "@/services/usage";
import { contentTypeLabel, type ContentKind } from "@/utils/content-kind";

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
const matches = ref<Record<number, string>>({});
const selectedMatches = computed(() =>
  Object.entries(matches.value)
    .filter(([, movieId]) => movieId)
    .map(([row, movieId]) => ({ row: Number(row), movieId }))
);

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
    personalRate: number | null;
    status: "ready" | "exists" | "error";
    issue: string;
    candidates?: {
      id: string;
      title: string;
      isSerial: boolean;
      contentKind?: ContentKind | null;
      year: number | null;
    }[];
  }[];
}

const preview = ref<Preview | null>(null);
let checkedInput = "";
let controller: AbortController | undefined;
const requests = createRequestGuard();
const MAX_BYTES = 2 * 1024 * 1024;
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
    matches.value = {};
    filename.value = "";
    readable.value = "";
    invalidate();
  },
  { flush: "sync" }
);

watch(
  () => main.sessionRevision,
  () => {
    matches.value = {};
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
  return (
    format.value +
    "\n" +
    content.value +
    "\n" +
    JSON.stringify(selectedMatches.value)
  );
}

function chooseMatch(row: number, movieId: unknown): void {
  matches.value = {
    ...matches.value,
    [row]: typeof movieId === "string" ? movieId : "",
  };

  if (preview.value) {
    preview.value.proof = null;
    preview.value.valid = false;
  }

  checkedInput = "";
}

function toggleReadable() {
  if (readable.value) {
    readable.value = "";

    return;
  }

  try {
    if (new TextEncoder().encode(content.value).length > MAX_BYTES)
      throw new Error("Файл должен быть не больше 2 МиБ");
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
    throw new Error("Файл должен быть не больше 2 МиБ");

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
      (data.version !== 1 && data.version !== 2) ||
      !("movies" in data) ||
      !Array.isArray(data.movies) ||
      data.movies.length < 1 ||
      data.movies.length > (data.version === 2 ? 1000 : 200)
    )
      throw new Error(
        "Ожидается JSON версии 1 (до 200 записей) или 2 (до 1000 записей) с массивом movies"
      );
    if (
      data.version === 1 &&
      new TextEncoder().encode(content.value).length > 32768
    )
      throw new Error("Файл версии 1 должен быть не больше 32 КБ");
  } else {
    const header = text
      .split(/\r\n|\r|\n/, 1)[0]
      .split(",")
      .map((value) => value.replace(/^"|"$/g, ""));
    const version2 = header.includes("formatVersion");

    if (text.trimEnd().split(/\r\n|\r|\n/).length > (version2 ? 1001 : 201))
      throw new Error(
        version2
          ? "Не более 1000 записей за один импорт"
          : "Не более 200 записей за один импорт"
      );
    if (!version2 && new TextEncoder().encode(content.value).length > 32768)
      throw new Error("Старый CSV должен быть не больше 32 КБ");
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
      throw new Error("Файл должен быть не больше 2 МиБ");

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
      {
        format: format.value,
        content: content.value,
        ...(selectedMatches.value.length
          ? { matches: selectedMatches.value }
          : {}),
      },
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
        ...(selectedMatches.value.length
          ? { matches: selectedMatches.value }
          : {}),
        proof: preview.value!.proof,
      },
      { signal: controller.signal, timeout: 30000 }
    );

    if (current()) {
      result.value = response.data;
      if (response.data.added > 0)
        trackUsage(`/users/${main.userData.id}/movies/import`, "POST");
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
          CSV с разделителем-запятой или JSON нашего формата, UTF-8. Старые
          файлы: до 32 КБ и 200 записей. Выгрузка версии 2: до 2 МиБ и 1000
          записей. Названия сверяются с каталогом без учёта регистра и лишних
          пробелов. Тип и указанный год должны совпадать.
        </p>
        <p>
          Существующие записи пропустим, сохранив ваши оценки и прогресс.
          Неизвестные тайтлы сначала добавьте в каталог. Ошибки и дубли в файле
          блокируют всю партию.
        </p>
        <AppDisclosure label="Пример JSON">
          <pre>{{ exampleJson }}</pre>
          <AButton :disabled="!!busy" @click="downloadExample('json')"
            >Скачать пример JSON</AButton
          >
        </AppDisclosure>
        <AppDisclosure label="Пример CSV">
          <pre>{{ exampleCsv }}</pre>
          <AButton :disabled="!!busy" @click="downloadExample('csv')"
            >Скачать пример CSV</AButton
          >
        </AppDisclosure>
        <section
          class="collection-import__hint"
          aria-label="Как заполнить файл"
        >
          <p>
            Примеры показывают формат файла. Замените названия на тайтлы из
            каталога Favorite. Импорт добавляет их в коллекцию, новые карточки
            каталога не создаёт.
          </p>
          <dl>
            <dt>Статус просмотра — <code>watchStatus</code></dt>
            <dd>
              <ul>
                <li><code>NOT_STARTED</code> — не начато</li>
                <li><code>WATCHING</code> — смотрю</li>
                <li><code>COMPLETED</code> — просмотрено</li>
                <li><code>DROPPED</code> — брошено</li>
              </ul>
            </dd>
            <dt>Да или нет</dt>
            <dd>
              <code>isSerial</code>, <code>isFavorite</code>,
              <code>seeLater</code>: <code>true</code> — да,
              <code>false</code> — нет.
            </dd>
            <dt>Личная оценка — <code>personalRate</code></dt>
            <dd>
              Целое число от 0 до 10. Значения 0 и <code>null</code> означают
              «без оценки». Версия 2 сохраняет исходное значение без изменения.
            </dd>
            <dt>Необязательные поля версии 1</dt>
            <dd>
              <code>year</code>, <code>isFavorite</code>,
              <code>seeLater</code> и <code>personalRate</code>.
            </dd>
          </dl>
          <p class="collection-import__note">
            В старом формате при статусе <code>COMPLETED</code> прогресс серий
            будет выставлен до конца по данным каталога. Версия 2 сохраняет
            прогресс и даты из файла без пересчёта. Существующие записи
            коллекции будут пропущены.
          </p>
        </section>
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
          :maxlength="MAX_BYTES"
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
          <ol
            class="collection-import__rows"
            tabindex="0"
            aria-label="Записи файла"
          >
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
              <div v-if="row.candidates && row.candidates.length > 1">
                <label :for="`collection-import-match-${row.row}`"
                  >Выберите запись</label
                >
                <ASelect
                  :id="`collection-import-match-${row.row}`"
                  :value="matches[row.row] || undefined"
                  :aria-label="`Запись для строки ${row.row}`"
                  class="collection-import__match"
                  placeholder="Не выбрано"
                  allow-clear
                  :disabled="!!busy"
                  :options="
                    row.candidates.map((candidate) => ({
                      value: candidate.id,
                      label: [
                        candidate.title,
                        candidate.year ?? 'Год не указан',
                        contentTypeLabel(candidate),
                      ].join(' · '),
                    }))
                  "
                  :get-popup-container="(trigger: HTMLElement) => trigger.parentElement ?? trigger"
                  @change="chooseMatch(row.row, $event)"
                >
                  <template #suffixIcon>
                    <BaseIcon name="ph:caret-down" :width="16" :height="16" />
                  </template>
                </ASelect>
              </div>
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
  padding-bottom: 20px;

  > [role="alert"],
  > [role="status"],
  > section[aria-label="Результат проверки"] {
    margin-top: 20px;
  }

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

  &__format,
  &__match {
    width: 100%;
  }

  details {
    margin: 16px 0;

    pre {
      margin: 12px 0 16px;
      border-radius: var(--fv-radius-sm);
    }
  }

  pre {
    max-width: 100%;
    overflow-x: auto;
    padding: 12px;
    background: var(--fv-color-bg-secondary);
    font-size: 12px;
  }

  &__hint {
    margin: 20px 0;
    font-size: 14px;
    line-height: 1.5;
    color: var(--fv-color-text-secondary);
    overflow-wrap: anywhere;

    dl {
      margin: 16px 0;
    }

    dt {
      margin-top: 12px;
      font-weight: 500;
      color: var(--fv-color-text-primary);
    }

    dd {
      margin: 4px 0 0;
    }

    ul {
      margin: 0;
      padding-left: 20px;
    }

    li + li {
      margin-top: 4px;
    }

    code {
      font-size: 0.9em;
    }
  }

  &__note {
    padding: 12px;
    margin: 16px 0 0;
    border-radius: var(--fv-radius-sm);
    background: var(--fv-color-bg-secondary);
  }

  &__content-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    margin: 20px 0 12px;

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
