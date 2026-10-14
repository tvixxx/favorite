<script setup lang="ts">
import { computed } from "vue";
import type { AdminEngagementData } from "./admin.types";
const props = withDefaults(defineProps<{ data: AdminEngagementData; days: number; timezone?:string }>(),{timezone:'UTC'});
const activities = computed(() => [
  {
    label: "За сутки",
    value: props.data.activity.dau,
    complete: props.data.activity.complete.day,
  },
  {
    label: "За 7 дней",
    value: props.data.activity.wau,
    complete: props.data.activity.complete.week,
  },
  {
    label: "За 30 дней",
    value: props.data.activity.mau,
    complete: props.data.activity.complete.month,
  },
]);
const conversion = (value: number, previous: number) =>
  previous
    ? `${Math.round((value / previous) * 1000) / 10}% от предыдущего шага`
    : "Нет данных для конверсии";
const stages = computed(() => [
  {
    label: "1. Зарегистрировались",
    value: props.data.funnel.registered,
    detail: `За ${props.days} дней`,
  },
  {
    label: "2. Добавили в коллекцию",
    value: props.data.funnel.collected,
    detail: conversion(
      props.data.funnel.collected,
      props.data.funnel.registered
    ),
  },
  {
    label: "3. Оценили или написали отзыв",
    value: props.data.funnel.rated,
    detail: conversion(props.data.funnel.rated, props.data.funnel.collected),
  },
]);
const retentionLabel = {
  empty: "Регистраций нет",
  collecting: "Следующая неделя ещё идёт",
  insufficient: "Недостаточно истории",
  complete: "",
};
const weekLabel = (week: string) =>
  new Date(week + "T00:00:00Z").toLocaleDateString("ru-RU", {
    timeZone: "UTC",
  });
</script>
<template>
  <div class="admin-engagement">
    <section aria-label="Активные пользователи">
      <h3>Активные пользователи</h3>
      <p class="admin-muted">
        Уникальные пользователи по учтённым действиям за последние 24 часа, 7 и
        30 суток. Окна не зависят от выбранного периода обзора. События браузера
        могут быть неполными.
      </p>
      <div class="admin-metrics">
        <div v-for="item in activities" :key="item.label">
          <span>{{ item.label }}</span
          ><b>{{ item.value }}</b
          ><small v-if="!item.complete">Частичная история</small>
        </div>
      </div>
    </section>
    <section aria-label="Воронка новых аккаунтов">
      <h3>Воронка новых аккаунтов</h3>
      <p class="admin-muted">
        Текущее состояние сохранившихся аккаунтов, зарегистрированных за
        {{ days }} дней. Учитываются сохранённые записи в коллекции и связанные
        оценки или отзывы. Удалённые записи не учитываются.
      </p>
      <div class="admin-metrics admin-engagement__funnel">
        <div v-for="stage in stages" :key="stage.label">
          <span>{{ stage.label }}</span
          ><b>{{ stage.value }}</b
          ><small>{{ stage.detail }}</small>
          <div class="admin-bar" aria-hidden="true">
            <span
              :style="{
                width: `${
                  (stage.value / Math.max(1, data.funnel.registered)) * 100
                }%`,
              }"
            ></span>
          </div>
        </div>
      </div>
    </section>
    <section aria-label="Недельное удержание">
      <h3>Недельное удержание</h3>
      <p class="admin-muted">
        Последние 8 полных недель регистрации, {{timezone}}. Вернувшимся считается
        пользователь с хотя бы одним учтённым действием на следующей календарной
        неделе. Процент появится после завершения всей недели наблюдения при
        достаточной истории.
      </p>
      <div role="list">
        <article
          v-for="row in data.retention"
          :key="row.week"
          role="listitem"
          class="admin-engagement__cohort"
          :data-week="row.week"
        >
          <strong>С {{ weekLabel(row.week) }}</strong>
          <div>
            <span>Регистрации</span><b>{{ row.registered }}</b>
          </div>
          <template v-if="row.state === 'complete'"
            ><div>
              <span>Вернулись</span><b>{{ row.returned }}</b>
            </div>
            <div>
              <span>Удержание</span><b>{{ row.percent }}%</b>
            </div></template
          >
          <p v-else class="admin-muted admin-engagement__state">
            {{ retentionLabel[row.state] }}
          </p>
        </article>
      </div>
    </section>
  </div>
</template>
<style scoped lang="scss">
@use '../../styles/media' as *;
.admin-engagement {
  display: grid;
  gap: 28px;
  margin: 28px 0;
  h3 {
    margin: 0 0 12px;
  }
  &__funnel .admin-bar {
    margin-top: 12px;
  }
  &__cohort {
    display: grid;
    grid-template-columns: minmax(120px, 1.2fr) repeat(3, minmax(0, 1fr));
    align-items: center;
    gap: 12px;
    padding: 16px 0;
    border-bottom: 1px solid var(--fv-color-border);
    font-variant-numeric: tabular-nums;
    span {
      display: block;
      font-size: 12px;
      color: var(--fv-color-text-secondary);
      margin-bottom: 6px;
    }
    b {
      font-size: 18px;
    }
  }
  &__state {
    grid-column: span 2;
  }
  @include mediaMax(640px) {
    &__funnel { grid-template-columns: minmax(0,1fr); }
    &__cohort {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      strong {
        grid-column: 1/-1;
      }
    }
    &__state {
      grid-column: auto;
    }
  }
}
</style>
