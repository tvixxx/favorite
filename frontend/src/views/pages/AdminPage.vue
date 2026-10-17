<script setup lang="ts">
import { ConfigProvider } from "ant-design-vue";
import { useAdminQueryParam } from "@/composable/useAdminQueryParam";
import AdminOverview from "@/components/Admin/AdminOverview.vue";
import AdminUsers from "@/components/Admin/AdminUsers.vue";
import AdminCatalog from "@/components/Admin/AdminCatalog.vue";
import AdminModeration from "@/components/Admin/AdminModeration.vue";
const tab = useAdminQueryParam("tab", "users", undefined, [
  "users",
  "catalog",
  "moderation",
]);
const tabs = [
  { id: "users", label: "Обзор и пользователи" },
  { id: "catalog", label: "Каталог" },
  { id: "moderation", label: "Модерация" },
];
</script>
<template>
  <ConfigProvider
    :theme="{
      token: { controlHeight: 44, fontSize: 16 },
      components: { DatePicker: { controlHeightSM: 24 } },
    }"
  >
    <main class="admin-page">
      <header class="admin-hero">
        <h1>Панель администратора</h1>
        <p>Пользователи, каталог и качество общения</p>
      </header>
      <nav class="admin-tabs" aria-label="Разделы администрирования">
        <button
          v-for="item in tabs"
          :key="item.id"
          :class="{ 'is-selected': tab === item.id }"
          :aria-current="tab === item.id ? 'page' : undefined"
          @click="tab = item.id"
        >
          {{ item.label }}
        </button>
      </nav>
      <template v-if="tab === 'users'">
        <AdminOverview />
        <AdminUsers />
      </template>
      <AdminCatalog v-else-if="tab === 'catalog'" />
      <AdminModeration v-else />
    </main>
  </ConfigProvider>
</template>
<style lang="scss">
@use "../../styles/media" as *;
@use "../../styles/layout" as *;
@use "../../styles/card" as *;
@use "../../styles/scrollbar" as *;
.admin-page {
  @include pageContentContainer;
  width: 100%;
  padding-top: 32px;
  padding-bottom: 48px;
}
.admin-hero {
  width: 100%;
  margin-bottom: 24px;
  h1 {
    font-size: 32px;
    margin: 8px 0;
  }
  p {
    color: var(--fv-color-text-secondary);
    margin: 0;
  }
}
.admin-tabs {
  @include hideScrollbar;
  display: flex;
  gap: 8px;
  width: 100%;
  overflow-x: auto;
  padding: 4px 0 20px;
  button {
    flex-shrink: 0;
    border: 1px solid var(--fv-color-border);
    background: var(--fv-color-bg-primary);
    color: var(--fv-color-text-primary);
    border-radius: 24px;
    padding: 12px 20px;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
    &.is-selected {
      background: var(--fv-color-text-primary);
      color: var(--fv-color-bg-primary);
    }
  }
}
.admin-panel {
  @include elevatedPanel;
  width: 100%;
  min-width: 0;
  padding: 24px;
  margin-bottom: 24px;
  h2 {
    font-size: 22px;
    margin: 0;
  }
  h3 {
    font-size: 18px;
    margin: 0 0 12px;
  }
  .ant-pagination {
    margin-top: 24px;
  }
  .ant-table-cell {
    overflow-wrap: anywhere;
  }
}
.admin-toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}
.admin-muted {
  color: var(--fv-color-text-secondary);
  font-size: 14px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.admin-caption {
  margin-top: 16px;
}
.admin-search {
  width: 100%;
  max-width: 100%;
}
.admin-filters {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: end;
  gap: 16px;
  margin-bottom: 20px;

  > *,
  .ant-select,
  .ant-picker {
    width: 100%;
    min-width: 0;
  }
}
@include mediaMax($desktopXS - 0.02px) {
  .admin-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@include mediaMax($tablet) {
  // Нижний отступ приложения должен идти после длинной страницы, а не после первого экрана.
  #app:has(.admin-page) {
    height: auto;
    min-height: 100%;
  }

  .admin-page {
    padding-bottom: 24px;

    > .admin-panel:last-child {
      margin-bottom: 0;
    }
  }

  .admin-filters {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .admin-tabs {
    width: calc(100% + 2 * var(--fv-gutter-mobile));
    margin-inline: calc(-1 * var(--fv-gutter-mobile));
    padding-inline: var(--fv-gutter-mobile);
    scroll-padding-inline: var(--fv-gutter-mobile);
  }
}
.admin-row {
  padding: 20px 0;
  border-bottom: 1px solid var(--fv-color-border);
  p {
    margin: 8px 0 12px;
  }
}
.admin-excerpt {
  max-width: 440px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.admin-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  padding: 12px 0;
}
.admin-quality {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  button {
    font: inherit;
    color: var(--fv-color-text-primary);
    border: 1px solid var(--fv-color-border);
    border-radius: 16px;
    background: var(--fv-color-bg-secondary);
    text-align: left;
    padding: 20px;
    cursor: pointer;
    b {
      display: block;
      font-size: 28px;
      margin-top: 8px;
    }
    &.is-selected {
      border-color: var(--fv-color-accent);
      background: var(--fv-color-accent-soft);
    }
  }
}
.admin-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin: 24px 0;
  > div {
    background: var(--fv-color-bg-secondary);
    border-radius: 16px;
    padding: 20px;
  }
  b {
    display: block;
    font-size: 30px;
    margin: 8px 0;
  }
  small,
  span {
    color: var(--fv-color-text-secondary);
  }
}
.admin-overview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 32px;
}
.admin-feature {
  display: grid;
  grid-template-columns: minmax(100px, 1fr) 1fr 32px;
  align-items: center;
  gap: 12px;
  margin: 16px 0;
  font-size: 14px;
}
.admin-bar {
  height: 10px;
  background: var(--fv-color-bg-secondary);
  border-radius: 8px;
  overflow: hidden;
  span {
    display: block;
    height: 100%;
    background: var(--fv-color-accent);
    border-radius: 8px;
  }
}
.admin-registration-bars {
  @include customScrollbar;
  max-height: 300px;
  overflow-y: auto;
}
.admin-heat-section {
  margin-top: 28px;
}
.admin-heat-scroll {
  @include hideScrollbar;
  overflow-x: auto;
}
.admin-heat {
  display: grid;
  grid-template-columns: 28px repeat(24, minmax(22px, 1fr));
  min-width: 700px;
  gap: 4px;
  font-size: 12px;
  button {
    height: 24px;
    border: 0;
    border-radius: 4px;
    cursor: pointer;
    background: color-mix(
      in srgb,
      var(--fv-color-accent) var(--heat),
      var(--fv-color-bg-secondary)
    );
  }
}
.admin-mobile {
  display: none;
}
.admin-dialog {
  .modal__footer {
    flex-wrap: wrap;
  }
  .admin-label {
    display: block;
    font-weight: 700;
    margin: 16px 0 8px;
  }
  .admin-facts {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 12px;
    dt {
      color: var(--fv-color-text-secondary);
    }
    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
  }
  .admin-form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
}
@include mediaMax($tablet - 0.02px) {
  .admin-hero h1 {
    font-size: 24px;
  }
  .admin-panel {
    padding: 20px 16px;
    h2 {
      font-size: 20px;
    }
  }
  .admin-desktop {
    display: none;
  }
  .admin-mobile {
    display: block;
  }
  .admin-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    > div {
      padding: 16px;
    }
  }
  .admin-overview-grid {
    grid-template-columns: 1fr;
    gap: 20px;
  }
  .admin-quality {
    grid-template-columns: 1fr;
    gap: 8px;
    button {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      b {
        font-size: 24px;
        margin: 0;
      }
    }
  }
  .admin-search {
    width: 100%;
  }
  .admin-dialog .admin-facts {
    grid-template-columns: 1fr;
    gap: 4px;
    dd {
      margin-bottom: 12px;
    }
  }
}
</style>
