<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from "vue";
import {
  Alert as AAlert,
  Spin as ASpin,
  RadioGroup as ARadioGroup,
  RadioButton as ARadioButton,
} from "ant-design-vue";
import api from "@/services/api";
import BaseModal from "@/components/BaseModal/BaseModal.vue";

interface Overview {
  users: number;
  movies: number;
  serials: number;
  reviews: number;
  newFeedback: number;
  active: number;
  returning: number | null;
  inactive: number | null;
  startedAt: string | null;
  since: string;
  until: string;
  timezone: string;
  registrations: { day: string; count: number }[];
  features: { feature: string; users: number; actions: number }[];
  heatmap: { day: number; hour: number; users: number }[];
}
const days = ref(30);
const data = ref<Overview | null>(null);
const loading = ref(false);
const error = ref("");
const cellDetail = ref("");
const registrationsOpen = ref(false);
let revision = 0;
const labels: Record<string, string> = {
  SEARCH: "Поиск",
  MOVIE_VIEW: "Просмотр карточки",
  COLLECTION_ADD: "Добавление в коллекцию",
  RATING: "Оценки",
  REVIEW: "Отзывы",
  LIST: "Списки",
  FEEDBACK: "Обратная связь",
};
const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const maxRegistrations = computed(() =>
  Math.max(1, ...(data.value?.registrations.map((item) => item.count) ?? []))
);
const registrationTotal = computed(
  () =>
    data.value?.registrations.reduce((sum, item) => sum + item.count, 0) ?? 0
);
const registrationDate = (day: string): string =>
  new Date(day).toLocaleDateString("ru-RU", { timeZone: "UTC" });
const maxUsers = computed(() =>
  Math.max(1, ...(data.value?.features.map((item) => item.users) ?? []))
);
const maxHeat = computed(() =>
  Math.max(1, ...(data.value?.heatmap.map((item) => item.users) ?? []))
);
const heatValues = computed(
  () =>
    new Map(
      data.value?.heatmap.map((cell) => [
        cell.day * 24 + cell.hour,
        cell.users,
      ]) ?? []
    )
);
const heatValue = (day: number, hour: number): number =>
  heatValues.value.get(day * 24 + hour) ?? 0;

async function load(): Promise<void> {
  const request = ++revision;

  loading.value = true;
  error.value = "";

  try {
    const response = await api.get<Overview>("/admin/overview", {
      params: { days: days.value },
    });

    if (request === revision) {
      data.value = response.data;
    }
  } catch {
    if (request === revision) {
      error.value = "Не удалось загрузить обзор";
    }
  } finally {
    if (request === revision) {
      loading.value = false;
    }
  }
}

onMounted(() => void load());
onScopeDispose(() => {
  revision += 1;
});
watch(days, () => void load());
</script>
<template>
  <section class="admin-panel">
    <div class="admin-toolbar">
      <h2>Как развивается Favorite</h2>
      <a-radio-group v-model:value="days">
        <a-radio-button :value="7">7 дней</a-radio-button>
        <a-radio-button :value="30">30 дней</a-radio-button>
        <a-radio-button :value="90">90 дней</a-radio-button>
      </a-radio-group>
    </div>
    <a-alert v-if="error" :message="error" type="error">
      <template #action>
        <a-button @click="load">Повторить</a-button>
      </template>
    </a-alert>
    <a-spin :spinning="loading">
      <template v-if="data">
        <div class="admin-metrics">
          <div>
            <span>Пользователи</span>
            <b>{{ data.users }}</b>
          </div>
          <div>
            <span>Новые за {{ days }} дней</span>
            <b>{{
              data.registrations.reduce((sum, item) => sum + item.count, 0)
            }}</b>
            <small>По дате регистрации</small>
          </div>
          <div>
            <span>Активны за {{ days }} дней</span>
            <b>{{ data.active }}</b>
            <small>По учтённым действиям</small>
          </div>
          <div>
            <span>Новые обращения</span>
            <b>{{ data.newFeedback }}</b>
          </div>
        </div>
        <p class="admin-muted">
          В каталоге {{ data.movies - data.serials }} фильмов и
          {{ data.serials }} сериалов. Опубликованных отзывов:
          {{ data.reviews }}.
        </p>
        <p class="admin-muted">
          Вернулись после 28 дней без активности:
          {{ data.returning ?? "история накапливается" }}. Неактивны 28 дней:
          {{ data.inactive ?? "история накапливается" }}. Расчёт по доступной
          истории за последние 90 дней, это не число удалённых аккаунтов.
        </p>
        <div class="admin-overview-grid">
          <section>
            <div class="admin-toolbar">
              <h3>Новые регистрации</h3>
              <a-button
                data-testid="registration-details"
                @click="registrationsOpen = true"
                >Подробнее</a-button
              >
            </div>
            <p class="admin-muted">
              За {{ days }} дней · сохранившиеся аккаунты · UTC+4
            </p>
            <div
              v-if="data.registrations.length"
              class="admin-registration-bars"
            >
              <div
                v-for="day in data.registrations"
                :key="day.day"
                class="admin-feature"
              >
                <span>{{
                  new Date(day.day).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "short",
                    timeZone: "UTC",
                  })
                }}</span>
                <div class="admin-bar">
                  <span
                    :style="{
                      width: `${(day.count / maxRegistrations) * 100}%`,
                    }"
                  >
                  </span>
                </div>
                <b>{{ day.count }}</b>
              </div>
            </div>
            <p v-else class="admin-muted">
              За этот период новых регистраций нет.
            </p>
            <p class="admin-muted">
              Человек за день. Дни без регистраций не перечислены.
            </p>
          </section>
          <section>
            <h3>Чем пользуются</h3>
            <p class="admin-muted">
              Уникальные пользователи за {{ days }} дней
            </p>
            <div
              v-for="feature in data.features"
              :key="feature.feature"
              class="admin-feature"
            >
              <span>{{ labels[feature.feature] ?? feature.feature }}</span>
              <div class="admin-bar">
                <span
                  :style="{ width: `${(feature.users / maxUsers) * 100}%` }"
                >
                </span>
              </div>
              <b :title="`${feature.actions} действий`">{{ feature.users }}</b>
            </div>
            <p v-if="!data.features.length" class="admin-muted">
              Пока нет учтённых действий. Данные начнут появляться после
              использования функций сайта.
            </p>
            <p class="admin-muted">
              Один человек может использовать несколько функций. Клиентские
              события могут быть неполными.
            </p>
          </section>
        </div>
        <section v-if="data.startedAt" class="admin-heat-section">
          <h3>Активность по времени</h3>
          <p class="admin-muted">
            Уникальные пользователи · день недели × час · UTC+4
          </p>
          <div
            class="admin-heat-scroll"
            tabindex="0"
            role="region"
            aria-label="Активность по часам, горизонтальная прокрутка"
          >
            <div class="admin-heat">
              <span> </span>
              <span v-for="hour in 24" :key="hour" class="admin-muted">{{
                hour - 1
              }}</span>
              <template v-for="(day, index) in weekdays" :key="day">
                <span>{{ day }}</span>
                <button
                  v-for="hour in 24"
                  :key="hour"
                  :aria-label="`${day}, ${hour - 1}:00, ${heatValue(
                    index + 1,
                    hour - 1
                  )} пользователей`"
                  :title="`${heatValue(index + 1, hour - 1)} пользователей`"
                  :style="{
                    '--heat': `${
                      (heatValue(index + 1, hour - 1) / maxHeat) * 85 + 5
                    }%`,
                  }"
                  @click="
                    cellDetail = `${day}, ${
                      hour - 1
                    }:00–${hour}:00: ${heatValue(
                      index + 1,
                      hour - 1
                    )} пользователей за ${days} дней`
                  "
                ></button>
              </template>
            </div>
          </div>
          <p aria-live="polite" class="admin-muted admin-caption">
            {{
              cellDetail ||
              "Нажмите на ячейку для точного значения. Чем насыщеннее цвет, тем больше пользователей."
            }}
          </p>
          <p class="admin-muted">
            История доступна с
            {{ new Date(data.startedAt).toLocaleDateString("ru-RU") }}. До этой
            даты данных нет.
          </p>
        </section>
      </template>
    </a-spin>
  </section>
  <BaseModal
    v-model="registrationsOpen"
    layout="detail"
    class="admin-dialog admin-registrations-dialog"
  >
    <template #title>Новые регистрации</template>
    <template #body>
      <a-radio-group
        v-model:value="days"
        :disabled="loading"
        aria-label="Период регистраций"
      >
        <a-radio-button :value="7">7 дней</a-radio-button>
        <a-radio-button :value="30">30 дней</a-radio-button>
        <a-radio-button :value="90">90 дней</a-radio-button>
      </a-radio-group>
      <a-alert v-if="error" :message="error" type="error" />
      <a-spin :spinning="loading">
        <template v-if="data">
          <p class="admin-registration-total">
            Всего за период: <b>{{ registrationTotal }}</b>
          </p>
          <p class="admin-muted">
            Сохранившиеся аккаунты · UTC+4. Текущий день ещё не завершён.
          </p>
          <div
            class="admin-registration-list"
            tabindex="0"
            role="region"
            aria-label="Регистрации по датам"
          >
            <div
              v-for="day in data.registrations"
              :key="day.day"
              class="admin-registration-row"
            >
              <time :datetime="day.day">{{ registrationDate(day.day) }}</time>
              <div class="admin-bar" aria-hidden="true">
                <span
                  :style="{ width: `${(day.count / maxRegistrations) * 100}%` }"
                ></span>
              </div>
              <b :aria-label="`${day.count} регистраций`">{{ day.count }}</b>
            </div>
            <p v-if="!data.registrations.length" class="admin-muted">
              За этот период новых регистраций нет.
            </p>
          </div>
          <p class="admin-muted">
            Человек за день. Дни без регистраций не перечислены.
          </p>
        </template>
      </a-spin>
    </template>
    <template #footer>
      <a-button @click="registrationsOpen = false">Закрыть</a-button>
    </template>
  </BaseModal>
</template>

<style scoped lang="scss">
@use "../../styles/scrollbar" as *;

.admin-registrations-dialog {
  &.modal:not(.modal--sheet) {
    max-width: min(94vw, 640px);
  }
}
.admin-registration-total {
  margin: 24px 0 8px;
  font-size: 18px;
}
.admin-registration-list {
  @include customScrollbar;
  max-height: 360px;
  overflow-y: auto;
  padding-right: 8px;
}
.admin-registration-row {
  display: grid;
  grid-template-columns: 90px minmax(32px, 1fr) minmax(28px, max-content);
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid var(--fv-color-border);
  font-size: 14px;
  font-variant-numeric: tabular-nums;

  b {
    text-align: right;
  }
}
</style>
