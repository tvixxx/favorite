<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Button } from "ant-design-vue";
import { useMainStore } from "@/state/state";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import BaseModal from "@/components/BaseModal/BaseModal.vue";
import NotificationSenders from "./NotificationSenders.vue";
import NotificationToolbar from "./NotificationToolbar.vue";
import NotificationEvents from "./NotificationEvents.vue";
import NotificationPager from "./NotificationPager.vue";
import { useNotificationCenter } from "./useNotificationCenter";
import {
  safeNotificationActions,
  requestAppUpdate,
} from "./notification-actions";
import { avatarGradient, avatarLetter } from "@/composable/useAvatarGradient";
import type { NotificationEvent, NotificationSender } from "./center.types";

const main = useMainStore();
const userId = computed(() => main.userData?.id);
const state = reactive(useNotificationCenter(userId));
const route = useRoute();
const router = useRouter();
const shell = ref<HTMLElement | null>(null);
const full = ref<NotificationEvent | null>(null);
const fullOpen = computed({
  get: () => !!full.value,
  set: (value: boolean) => {
    if (!value) full.value = null;
  },
});
const fullActions = computed(() =>
  safeNotificationActions(full.value?.actions)
);

watch(
  () => route.query.section,
  (value) => {
    if (value === "system" || value === "people") state.section = value;
  },
  { immediate: true }
);

watch(
  () => state.section,
  (section) => {
    void router.replace({ query: { ...route.query, section } });
  }
);

watch(
  userId,
  (id) => {
    full.value = null;
    try {
      const saved = JSON.parse(
        localStorage.getItem("fv-notification-view:" + id) ?? "{}"
      );

      for (const source of ["people", "system"] as const)
        state.view[source] = ["list", "compact", "grid"].includes(saved[source])
          ? saved[source]
          : "list";
    } catch {
      state.view.people = "list";
      state.view.system = "list";
    }
  },
  { immediate: true }
);

watch(state.view, (value) => {
  if (userId.value)
    try {
      localStorage.setItem(
        "fv-notification-view:" + userId.value,
        JSON.stringify(value)
      );
    } catch {
      /* Отображение работает и без локального хранилища. */
    }
});

async function choose(sender: NotificationSender): Promise<void> {
  state.choose(sender);
  await nextTick();
  if (matchMedia("(max-width: 767px)").matches)
    shell.value?.scrollIntoView({ block: "start" });
}

async function back(): Promise<void> {
  state.mobileDetail = false;
  await nextTick();
  shell.value?.scrollIntoView({ block: "start" });
  if (state.selected)
    shell.value
      ?.querySelector<HTMLButtonElement>(
        '[data-sender="' + state.selected.id + '"]'
      )
      ?.focus({ preventScroll: true });
}

async function showFull(item: NotificationEvent): Promise<void> {
  full.value = item;
  await state.read(item);
}

async function checkUpdate(item: NotificationEvent): Promise<void> {
  if (await state.read(item)) requestAppUpdate();
}

async function navigate(item: NotificationEvent, path: string): Promise<void> {
  if (!safeNotificationActions([{ label: "Открыть", path }]).length) return;
  if (await state.read(item)) {
    full.value = null;
    await router.push(path);
  }
}
</script>
<template>
  <section
    class="notification-center"
    aria-labelledby="notification-center-title"
  >
    <header class="notification-center__heading">
      <div>
        <h1 id="notification-center-title">Центр уведомлений</h1>
        <p>Сообщения от пользователей и новости приложения.</p>
      </div>
      <div class="notification-center__heading-actions">
        <Button
          :disabled="state.saving"
          aria-label="Обновить уведомления"
          @click="state.refresh"
          ><BaseIcon name="ph:arrow-clockwise" :width="18" /></Button
        ><Button
          :disabled="state.saving || !state.summary[state.section]"
          @click="state.readScope(false)"
          ><span class="notification-center__action-content"
            ><BaseIcon name="ph:checks" :width="18" :height="18" /><span
              >Отметить всё прочитанным</span
            ></span
          ></Button
        >
      </div>
    </header>
    <div
      class="notification-center__sections"
      role="tablist"
      aria-label="Источник уведомлений"
    >
      <button
        v-for="source in [{ id: 'people' as const, label: 'От пользователей', icon: 'ph:users' }, { id: 'system' as const, label: 'Системные', icon: 'ph:shield-check' }]"
        :key="source.id"
        type="button"
        role="tab"
        :aria-selected="state.section === source.id"
        :disabled="state.saving"
        @click="state.section = source.id"
      >
        <BaseIcon :name="source.icon" :width="19" /><span>{{
          source.label
        }}</span
        ><span class="notification-center__badge">{{
          state.summary[source.id]
        }}</span>
      </button>
    </div>
    <p
      v-if="state.mutationError"
      class="notification-center__error"
      role="alert"
    >
      {{ state.mutationError }}
    </p>
    <div
      ref="shell"
      class="notification-center__shell"
      :class="[state.section, { 'is-detail': state.mobileDetail }]"
    >
      <NotificationSenders
        v-if="state.section === 'people'"
        :items="state.senders.items"
        :total="state.senders.total"
        :current="state.senderPage"
        v-model:query="state.senderQuery"
        :selected-id="state.selected?.id"
        :loading="state.senders.loading"
        :error="state.senders.error"
        :disabled="state.sendersBusy"
        @choose="choose"
        @page="state.senderPage = $event"
        @retry="state.loadSenders"
      />
      <aside v-else class="notification-center__system-categories">
        <h2>Системные события</h2>
        <p>Новости и работа приложения</p>
        <button
          v-for="option in [
            { id: '', label: 'Все события' },
            { id: 'NEWS', label: 'Новости' },
            { id: 'SERVICE', label: 'Работа сервиса' },
            { id: 'RELEASE', label: 'Обновления' },
          ]"
          :key="option.id"
          type="button"
          :aria-pressed="state.category === option.id"
          @click="state.category = option.id"
        >
          {{ option.label }}
        </button>
      </aside>
      <section
        class="notification-center__detail"
        aria-label="События выбранного источника"
      >
        <button
          v-if="state.section === 'people'"
          type="button"
          class="notification-center__back"
          @click="back"
        >
          <BaseIcon name="ph:arrow-left" :width="16" />К отправителям · страница
          {{ state.senderPage }}
        </button>
        <header class="notification-center__selected">
          <span
            class="notification-center__avatar"
            :style="{
              background:
                state.section === 'people'
                  ? avatarGradient(state.selected?.id ?? '')
                  : 'var(--fv-color-accent-soft)',
            }"
            ><template v-if="state.section === 'people'">{{
              avatarLetter(state.selected?.name ?? "")
            }}</template
            ><BaseIcon v-else name="ph:shield-check" :width="22"
          /></span>
          <div>
            <h2>
              {{
                state.section === "system"
                  ? "Системные события"
                  : state.selected?.name ?? "Выберите отправителя"
              }}
            </h2>
            <p>
              {{
                state.section === "system"
                  ? "Новости, обновления и работа приложения"
                  : state.selected?.username || "Сообщения и события дружбы"
              }}
            </p>
          </div>
          <Button
            v-if="state.section === 'people'"
            :disabled="state.busy || !state.selected?.unread"
            @click="state.readScope(true)"
            >Прочитать все</Button
          >
        </header>
        <NotificationToolbar
          :section="state.section"
          v-model:query="state.query"
          v-model:view="state.view[state.section]"
          v-model:kind="state.kind"
          v-model:category="state.category"
          v-model:unread-only="state.unreadOnly[state.section]"
          :disabled="state.saving"
        />
        <NotificationEvents
          :items="state.events.items"
          :view="state.view[state.section]"
          :loading="state.events.loading"
          :ready="state.events.ready"
          :error="state.events.error"
          :disabled="state.busy"
          @retry="state.refresh"
          @read="state.read"
          @update="checkUpdate"
          @full="showFull"
          @navigate="navigate"
        />
        <NotificationPager
          :current="state.eventPage"
          :total="state.events.total"
          :page-size="10"
          label="событий"
          :disabled="state.busy"
          @change="state.eventPage = $event"
        />
      </section>
    </div>
    <BaseModal v-model="fullOpen">
      <template #title>{{ full?.title ?? "Полный текст" }}</template>
      <template #body
        ><p class="notification-center__full">{{ full?.body }}</p>
        <p v-if="state.mutationError" role="alert">
          {{ state.mutationError }}
        </p></template
      >
      <template #footer
        ><Button @click="full = null">Закрыть</Button
        ><Button
          v-for="action in fullActions"
          :key="action.path"
          :disabled="state.saving"
          @click="full && navigate(full, action.path)"
          >{{ action.label }}</Button
        ><Button
          v-if="full?.category === 'RELEASE'"
          @click="full && checkUpdate(full)"
          >Проверить обновление</Button
        ></template
      >
    </BaseModal>
  </section>
</template>
<style scoped lang="scss">
@use "@/styles/media" as *;

.notification-center {
  width: 100%;
  min-width: 0;
  max-width: 1200px;
  padding: 28px 32px 40px;
  margin: 0 auto;
  &__heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 24px;
  }
  &__heading h1 {
    font-size: 30px;
    line-height: 1.2;
    margin: 0 0 8px;
  }
  &__heading p {
    color: var(--fv-color-text-secondary);
    font-size: 14px;
    margin: 0;
  }
  &__heading-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }
  &__heading-actions :deep(.ant-btn) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-height: 40px;
    font-size: 12px;
  }
  &__action-content {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
  }
  &__action-content :deep(svg) {
    display: block;
    flex-shrink: 0;
  }
  &__sections {
    display: flex;
    border-bottom: 1px solid var(--fv-color-border);
    margin-bottom: 22px;
  }
  &__sections button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-width: 0;
    min-height: 48px;
    border: 0;
    border-bottom: 3px solid transparent;
    padding: 10px 16px;
    background: transparent;
    color: var(--fv-color-text-secondary);
    font: inherit;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
  }
  &__sections button[aria-selected="true"] {
    color: var(--fv-color-text-primary);
    border-bottom-color: var(--fv-color-brand);
  }
  &__badge {
    background: color-mix(
      in srgb,
      var(--fv-color-brand) 8%,
      var(--fv-color-bg-primary)
    );
    color: var(--fv-color-brand);
    font-size: 12px;
    padding: 1px 6px;
    border-radius: 6px;
  }
  &__shell {
    display: grid;
    grid-template-columns: 290px minmax(0, 1fr);
    align-items: stretch;
    min-width: 0;
    border: 1px solid var(--fv-color-border);
    border-radius: 18px;
    background: var(--fv-color-bg-primary);
    box-shadow: var(--fv-shadow-low);
    overflow: clip;
  }
  &__detail {
    min-width: 0;
  }
  &__selected {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 20px 22px;
    border-bottom: 1px solid var(--fv-color-border);
  }
  &__selected > div {
    flex: 1;
    min-width: 0;
  }
  &__selected h2 {
    font-family: var(--fv-font-ui);
    font-size: 17px;
    font-weight: 700;
    margin: 0 0 4px;
    overflow-wrap: anywhere;
  }
  &__selected p {
    color: var(--fv-color-text-secondary);
    font-size: 12px;
    margin: 0;
  }
  &__selected :deep(.ant-btn) {
    font-size: 12px;
  }
  &__avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    color: white;
    font-weight: 700;
  }
  .system &__avatar {
    color: var(--fv-color-accent);
    border-radius: 12px;
  }
  &__back {
    display: none;
  }
  &__system-categories {
    padding: 20px 16px;
    border-right: 1px solid var(--fv-color-border);
    background: var(--fv-color-bg-secondary);
  }
  &__system-categories h2 {
    font-size: 17px;
    margin: 0 0 8px;
  }
  &__system-categories p {
    font-size: 12px;
    color: var(--fv-color-text-secondary);
    margin: 0 0 16px;
  }
  &__system-categories button {
    display: block;
    width: 100%;
    min-height: 44px;
    text-align: left;
    padding: 10px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: var(--fv-color-text-secondary);
    cursor: pointer;
  }
  &__system-categories button[aria-pressed="true"] {
    background: var(--fv-color-bg-primary);
    color: var(--fv-color-text-primary);
    border-color: var(--fv-color-border);
  }
  &__error {
    color: var(--fv-color-negative);
    font-size: 13px;
  }
  &__full {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-size: 14px;
    line-height: 1.6;
  }
}
@include mediaMin(768px) {
  .notification-center__shell.system :deep(.notification-toolbar__filters) {
    display: none;
  }
}
@include mediaMax(1000px) {
  .notification-center__shell {
    grid-template-columns: 255px minmax(0, 1fr);
  }
}
@include mediaMax(767px) {
  .notification-center {
    padding: 24px var(--fv-gutter-mobile);
    &__heading {
      align-items: flex-start;
      flex-direction: column;
      gap: 14px;
    }
    &__heading h1 {
      font-size: 25px;
    }
    &__heading p {
      font-size: 13px;
    }
    &__heading-actions {
      width: 100%;
      justify-content: flex-end;
    }
    &__sections button {
      padding: 10px 8px;
      font-size: 13px;
      flex: 1 1 auto;
      gap: 6px;
    }
    &__shell {
      display: block;
    }
    &__shell.people:not(.is-detail) &__detail {
      display: none;
    }
    &__shell.people.is-detail :deep(.notification-senders) {
      display: none;
    }
    &__back {
      display: flex;
      align-items: center;
      gap: 7px;
      width: 100%;
      min-height: 40px;
      padding: 8px 14px;
      background: transparent;
      color: var(--fv-color-text-secondary);
      border: 0;
      border-bottom: 1px solid var(--fv-color-border);
      font-size: 12px;
      cursor: pointer;
    }
    &__selected {
      padding: 16px 14px;
      flex-wrap: wrap;
      gap: 10px;
    }
    &__selected h2 {
      font-size: 16px;
    }
    &__selected :deep(.ant-btn) {
      margin-left: auto;
    }
    &__system-categories {
      display: none;
    }
  }
}
@include mediaMax(380px) {
  .notification-center__sections :deep(svg) {
    display: none;
  }
}
</style>
