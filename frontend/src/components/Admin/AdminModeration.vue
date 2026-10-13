<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import {
  Alert as AAlert,
  Empty as AEmpty,
  Table as ATable,
  Tag as ATag,
  Spin as ASpin,
  RadioGroup as ARadioGroup,
  RadioButton as ARadioButton,
  message,
} from "ant-design-vue";
import BaseModal from "@/components/BaseModal/BaseModal.vue";
import api from "@/services/api";
import { friendlyRequestError } from "@/utils/friendlyError";
import { useAdminPage } from "@/composable/useAdminPage";
import { useAdminQueryParam } from "@/composable/useAdminQueryParam";
import AdminDateFilters from "./AdminDateFilters.vue";
import { type AdminReview, type AdminFeedback, dateLabel } from "./admin.types";

const tab = useAdminQueryParam("moderation", "reviews", undefined, [
  "reviews",
  "feedback",
]);
const scope = useAdminQueryParam("reviews_scope", "reported", "reviews_page", [
  "",
  "reported",
  "hidden",
]);
const q = useAdminQueryParam("reviews_q", "", "reviews_page");
const status = useAdminQueryParam("feedback_status", "", "feedback_page", [
  "",
  "NEW",
  "IN_PROGRESS",
  "DONE",
]);
const feedbackType = useAdminQueryParam("feedback_type", "", "feedback_page", [
  "",
  "BUG",
  "IDEA",
  "OTHER",
]);
const feedbackQuery = useAdminQueryParam("feedback_q", "", "feedback_page");
const from = useAdminQueryParam("feedback_from", "", "feedback_page");
const to = useAdminQueryParam("feedback_to", "", "feedback_page");
const sort = useAdminQueryParam("feedback_sort", "", "feedback_page", [
  "",
  "oldest",
]);
const reviews = useAdminPage<AdminReview>(
  "/admin/reviews",
  () => ({
    scope: scope.value,
    q: q.value,
  }),
  "reviews_page"
);
const feedback = useAdminPage<AdminFeedback>(
  "/feedback",
  () => ({
    status: status.value,
    type: feedbackType.value,
    q: feedbackQuery.value,
    from: from.value,
    to: to.value,
    sort: sort.value,
  }),
  "feedback_page"
);
const selectedReview = ref<AdminReview | null>(null);
const selectedFeedback = ref<AdminFeedback | null>(null);
const reviewOpen = ref(false);
const feedbackOpen = ref(false);
const reason = ref("");
const nextStatus = ref("NEW");
const saving = ref(false);
const reviewDialogOpen = computed({
  get: () => reviewOpen.value,
  set: (value: boolean) => {
    if (!saving.value) {
      reviewOpen.value = value;
    }
  },
});
const feedbackDialogOpen = computed({
  get: () => feedbackOpen.value,
  set: (value: boolean) => {
    if (!saving.value) {
      feedbackOpen.value = value;
    }
  },
});
const statusOptions = [
  { value: "NEW", label: "Новое" },
  { value: "IN_PROGRESS", label: "В работе" },
  { value: "DONE", label: "Решено" },
];
const reasons: Record<string, string> = {
  SPAM: "Спам / реклама",
  ABUSE: "Оскорбления",
  SPOILER: "Спойлер",
  OTHER: "Другое",
};
const columns = [
  { title: "Тип", key: "type" },
  { title: "Обращение", key: "message" },
  { title: "Отправитель", key: "author" },
  { title: "Статус", key: "status" },
  { title: "Дата", key: "date" },
  { title: "", key: "actions" },
];

onMounted(() => {
  void (tab.value === "reviews" ? reviews.load() : feedback.load());
});
watch(
  tab,
  () => void (tab.value === "reviews" ? reviews.load() : feedback.load())
);

function showReview(review: AdminReview): void {
  selectedReview.value = review;
  reason.value = "";
  reviewOpen.value = true;
}

function showFeedback(id: string): void {
  const item = feedback.items.value.find((entry) => entry.id === id);

  if (!item) {
    return;
  }

  selectedFeedback.value = item;
  nextStatus.value = item.status;
  feedbackOpen.value = true;
}

async function moderate(dismiss = false): Promise<void> {
  if (!selectedReview.value || saving.value || reason.value.trim().length < 3) {
    return;
  }

  saving.value = true;
  const review = selectedReview.value;

  try {
    if (dismiss) {
      await api.post(`/admin/reviews/${review.id}/dismiss-reports`, {
        reason: reason.value.trim(),
      });
    } else {
      await api.patch(`/admin/reviews/${review.id}`, {
        hidden: !review.hiddenAt,
        reason: reason.value.trim(),
        updatedAt: review.updatedAt,
      });
    }

    reviewOpen.value = false;
    message.success("Решение сохранено");
    await reviews.load();
  } catch (err) {
    message.error(
      friendlyRequestError(err, { fallback: "Не удалось сохранить решение" })
    );
  } finally {
    saving.value = false;
  }
}

async function saveStatus(): Promise<void> {
  if (!selectedFeedback.value || saving.value) {
    return;
  }

  saving.value = true;

  try {
    await api.patch(`/feedback/${selectedFeedback.value.id}/status`, {
      status: nextStatus.value,
    });
    feedbackOpen.value = false;
    message.success("Статус обращения обновлён");
    await feedback.load();
  } catch (err) {
    message.error(
      friendlyRequestError(err, { fallback: "Не удалось обновить обращение" })
    );
  } finally {
    saving.value = false;
  }
}
</script>
<template>
  <section class="admin-panel">
    <div class="admin-toolbar">
      <h2>Модерация и обращения</h2>
      <a-radio-group v-model:value="tab">
        <a-radio-button value="reviews">Отзывы</a-radio-button>
        <a-radio-button value="feedback">Обратная связь</a-radio-button>
      </a-radio-group>
    </div>
    <template v-if="tab === 'reviews'">
      <p class="admin-muted">
        Отзывы публикуются сразу. Жалоба не скрывает отзыв автоматически.
      </p>
      <div class="admin-filters">
        <a-select
          v-model:value="scope"
          aria-label="Статус отзывов"
          :options="[
            { value: 'reported', label: 'С жалобами' },
            { value: '', label: 'Все отзывы' },
            { value: 'hidden', label: 'Скрытые' },
          ]"
        />
        <a-input
          v-model:value="q"
          placeholder="Название тайтла"
          aria-label="Поиск отзывов по фильму"
          class="admin-search"
          allow-clear
        />
      </div>
      <a-alert
        v-if="reviews.error.value"
        type="error"
        :message="reviews.error.value"
      >
        <template #action>
          <a-button @click="reviews.load()">Повторить</a-button>
        </template>
      </a-alert>
      <a-spin :spinning="reviews.loading.value">
        <article
          v-for="review in reviews.items.value"
          :key="review.id"
          class="admin-row"
        >
          <div class="admin-toolbar">
            <h3>{{ review.movie.title }}</h3>
            <a-tag :color="review.hiddenAt ? 'orange' : 'blue'">{{
              review.hiddenAt ? "Скрыт" : "Опубликован"
            }}</a-tag>
          </div>
          <p class="admin-muted">
            {{ review.user?.fullName }} · {{ review.rate }}/10 · Жалоб:
            {{ review._count.reports }}
          </p>
          <p class="admin-excerpt">{{ review.text }}</p>
          <a-button @click="showReview(review)">Проверить отзыв</a-button>
        </article>
        <a-empty
          v-if="!reviews.items.value.length && !reviews.loading.value"
          description="В этой категории отзывов нет"
        />
      </a-spin>
      <a-pagination
        v-if="reviews.total.value > 20"
        :current="reviews.page.value"
        :total="reviews.total.value"
        :page-size="20"
        :show-size-changer="false"
        @change="reviews.load"
      />
    </template>
    <template v-else>
      <div class="admin-filters">
        <a-input
          v-model:value="feedbackQuery"
          aria-label="Поиск обращений"
          placeholder="Текст, имя или email"
          allow-clear
          class="admin-search"
        />
        <a-select
          v-model:value="feedbackType"
          aria-label="Тип обращения"
          :options="[
            { value: '', label: 'Все типы' },
            { value: 'BUG', label: 'Ошибки' },
            { value: 'IDEA', label: 'Идеи' },
            { value: 'OTHER', label: 'Другое' },
          ]"
        />
        <a-select
          v-model:value="status"
          aria-label="Статус обращения"
          :options="[{ value: '', label: 'Все статусы' }, ...statusOptions]"
        />
      </div>
      <AdminDateFilters
        v-model:from="from"
        v-model:to="to"
        v-model:sort="sort"
      />
      <div class="admin-toolbar">
        <p class="admin-muted">
          Обращения из формы сайта · {{ feedback.total.value }}
        </p>
      </div>
      <a-alert
        v-if="feedback.error.value"
        type="error"
        :message="feedback.error.value"
      >
        <template #action>
          <a-button @click="feedback.load()">Повторить</a-button>
        </template>
      </a-alert>
      <a-table
        class="admin-desktop"
        :columns="columns"
        :data-source="feedback.items.value"
        row-key="id"
        :pagination="false"
        :loading="feedback.loading.value"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'type'">{{
            record.type === "BUG"
              ? "Ошибка"
              : record.type === "IDEA"
              ? "Идея"
              : "Другое"
          }}</template>
          <template v-else-if="column.key === 'message'">
            <p class="admin-excerpt">{{ record.message }}</p>
          </template>
          <template v-else-if="column.key === 'author'">{{
            record.user?.fullName ?? "Пользователь удалён"
          }}</template>
          <template v-else-if="column.key === 'status'">{{
            statusOptions.find((option) => option.value === record.status)
              ?.label
          }}</template>
          <template v-else-if="column.key === 'date'">{{
            dateLabel(record.createdAt)
          }}</template>
          <template v-else-if="column.key === 'actions'">
            <a-button @click="showFeedback(record.id)">Открыть</a-button>
          </template>
        </template>
      </a-table>
      <div class="admin-mobile">
        <article
          v-for="item in feedback.items.value"
          :key="item.id"
          class="admin-row"
        >
          <a-tag>{{
            statusOptions.find((option) => option.value === item.status)?.label
          }}</a-tag>
          <p class="admin-excerpt">{{ item.message }}</p>
          <p class="admin-muted">
            {{ item.user?.fullName ?? "Пользователь удалён" }} ·
            {{ dateLabel(item.createdAt) }}
          </p>
          <a-button @click="showFeedback(item.id)">Открыть обращение</a-button>
        </article>
        <a-empty
          v-if="!feedback.items.value.length && !feedback.loading.value"
          description="Обращений пока нет"
        />
      </div>
      <a-pagination
        v-if="feedback.total.value > 20"
        :current="feedback.page.value"
        :total="feedback.total.value"
        :page-size="20"
        :show-size-changer="false"
        @change="feedback.load"
      />
    </template>
  </section>
  <BaseModal v-model="reviewDialogOpen" layout="form" class="admin-dialog">
    <template #title>Проверка отзыва</template>
    <template #body>
      <template v-if="selectedReview">
        <h3>{{ selectedReview.movie.title }}</h3>
        <p class="admin-muted">
          {{ selectedReview.user?.fullName }} · {{ selectedReview.rate }}/10
        </p>
        <p class="admin-text">{{ selectedReview.text }}</p>
        <h3>Жалобы · {{ selectedReview._count.reports }}</h3>
        <p v-if="!selectedReview.reports.length" class="admin-muted">
          Жалоб нет. Можно проверить отзыв по своей инициативе.
        </p>
        <div
          v-for="report in selectedReview.reports"
          :key="report.id"
          class="admin-row"
        >
          <b>{{ reasons[report.reason] ?? report.reason }}</b>
          <p class="admin-text">{{ report.comment }}</p>
        </div>
        <label class="admin-label" for="moderation-reason"
          >Причина решения</label
        >
        <a-textarea
          id="moderation-reason"
          v-model:value="reason"
          :rows="3"
          :maxlength="500"
          :disabled="saving"
        />
        <p class="admin-muted">
          Скрытый отзыв исключается из публичного среднего. Личная оценка автора
          сохраняется.
        </p>
      </template>
    </template>
    <template #footer>
      <a-button :disabled="saving" @click="reviewOpen = false"
        >Закрыть</a-button
      >
      <a-button
        v-if="selectedReview?._count.reports"
        :disabled="saving || reason.trim().length < 3"
        @click="moderate(true)"
        >Отклонить жалобы</a-button
      >
      <a-button
        type="primary"
        :loading="saving"
        :disabled="reason.trim().length < 3"
        @click="moderate()"
        >{{
          selectedReview?.hiddenAt ? "Восстановить отзыв" : "Скрыть отзыв"
        }}</a-button
      >
    </template>
  </BaseModal>
  <BaseModal v-model="feedbackDialogOpen" layout="form" class="admin-dialog">
    <template #title>Обратная связь</template>
    <template #body>
      <template v-if="selectedFeedback">
        <p class="admin-muted">
          {{ selectedFeedback.user?.fullName ?? "Пользователь удалён" }} ·
          {{ dateLabel(selectedFeedback.createdAt) }}
        </p>
        <p class="admin-text">{{ selectedFeedback.message }}</p>
        <dl class="admin-facts">
          <dt>Email для ответа</dt>
          <dd>{{ selectedFeedback.email ?? "Не указан" }}</dd>
          <dt>Страница</dt>
          <dd>{{ selectedFeedback.pageUrl ?? "Не указана" }}</dd>
          <dt>Экран</dt>
          <dd>{{ selectedFeedback.viewport ?? "Не указан" }}</dd>
          <dt>Браузер</dt>
          <dd>{{ selectedFeedback.userAgent ?? "Не указан" }}</dd>
        </dl>
        <label class="admin-label" for="feedback-status">Статус</label>
        <a-select
          id="feedback-status"
          v-model:value="nextStatus"
          :options="statusOptions"
          :disabled="saving"
          style="width: 100%"
        />
        <p class="admin-muted">
          Смена статуса не отправляет письмо пользователю.
        </p>
      </template>
    </template>
    <template #footer>
      <a-button :disabled="saving" @click="feedbackOpen = false"
        >Закрыть</a-button
      >
      <a-button type="primary" :loading="saving" @click="saveStatus"
        >Сохранить статус</a-button
      >
      <a-button
        v-if="selectedFeedback?.email"
        :href="`mailto:${encodeURIComponent(
          selectedFeedback.email
        )}?subject=${encodeURIComponent('Favorite: ответ на обращение')}`"
        >Ответить по email</a-button
      >
    </template>
  </BaseModal>
</template>
