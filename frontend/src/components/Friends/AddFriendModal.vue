<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import { Button, message } from "ant-design-vue";
import BaseModal from "@/components/BaseModal/BaseModal.vue";
import BaseRadio from "@/components/BaseRadio/BaseRadio.vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import UserSearchInput from "./UserSearchInput.vue";
import {
  FriendshipType,
  type FriendUser,
  useFriendsStore,
} from "@/stores/friends/friendsStore";
import { avatarGradient, avatarLetter } from "@/composable/useAvatarGradient";
import { friendlyRequestError } from "@/utils/friendlyError";

const visible = defineModel<boolean>({ required: true });
const props = defineProps<{ userId: string }>();
const store = useFriendsStore();
const selected = ref<Pick<FriendUser, "id" | "fullName" | "username"> | null>(
  null
);
const requestType = ref<FriendshipType>(FriendshipType.FRIEND_REQUEST);
const sending = ref(false);
const error = ref("");
const heading = ref<HTMLElement>();
const search = ref<InstanceType<typeof UserSearchInput>>();
let revision = 0;

watch(
  () => props.userId,
  () => {
    revision++;
    visible.value = false;
    selected.value = null;
    error.value = "";
  }
);

watch(visible, (value) => {
  if (!value) revision++;
});

watch(selected, async (value) => {
  error.value = "";
  if (value) {
    await nextTick();
    heading.value?.focus();
  }
});

onBeforeUnmount(() => {
  revision++;
});

async function changeRecipient() {
  if (sending.value) return;
  selected.value = null;
  await nextTick();
  search.value?.focus();
}

async function send() {
  if (!selected.value || sending.value || !props.userId) return;

  const current = revision;
  const type = requestType.value;
  const recipientId = selected.value.id;

  sending.value = true;
  error.value = "";
  try {
    await store.sendRequest(props.userId, recipientId, type);
    if (current !== revision) return;
    message.success(
      type === FriendshipType.FRIEND_REQUEST
        ? "Запрос в друзья отправлен"
        : "Вы подписались на пользователя"
    );

    visible.value = false;
  } catch (cause) {
    if (current !== revision) return;
    error.value = friendlyRequestError(cause, {
      byStatus: {
        404: "Пользователь больше недоступен. Выберите другого человека.",
        409: "Вы уже отправили запрос этому пользователю или уже добавили его.",
      },
      fallback: "Не удалось отправить запрос. Попробуйте ещё раз.",
    });
  } finally {
    if (current === revision) sending.value = false;
  }
}
</script>

<template>
  <BaseModal v-model="visible" layout="form">
    <template #title>Добавить пользователя</template>
    <template #body>
      <div class="friend-flow">
        <div class="friend-flow__navigation">
          <Button
            v-if="selected"
            class="friend-flow__change friend-flow__change--mobile"
            :disabled="sending"
            @click="changeRecipient"
          >
            <template #icon
              ><BaseIcon name="ph:arrow-left" :width="16" :height="16"
            /></template>
            Назад к поиску
          </Button>
          <p class="friend-flow__step">Шаг {{ selected ? "2" : "1" }} из 2</p>
        </div>
        <h3 ref="heading" tabindex="-1">
          {{ selected ? "Как вы хотите общаться?" : "Найдите своего человека" }}
        </h3>
        <UserSearchInput
          ref="search"
          v-show="!selected"
          v-model="selected"
          :disabled="sending || !!selected"
        />
        <div v-if="selected" class="fv-friend-enter">
          <div class="friend-flow__recipient">
            <span
              class="friend-flow__avatar"
              :style="{ background: avatarGradient(selected.id) }"
              aria-hidden="true"
              >{{ avatarLetter(selected.fullName) }}</span
            >
            <div>
              <strong>{{ selected.fullName }}</strong
              ><span>{{ selected.username || "Ник не указан" }}</span>
            </div>
            <Button
              class="friend-flow__change friend-flow__change--desktop"
              :disabled="sending"
              @click="changeRecipient"
            >
              <template #icon
                ><BaseIcon name="ph:arrow-left" :width="16" :height="16"
              /></template>
              Изменить выбор
            </Button>
          </div>
          <fieldset :disabled="sending">
            <legend>Выберите действие</legend>
            <BaseRadio
              v-model="requestType"
              :options="[
                {
                  value: FriendshipType.FRIEND_REQUEST,
                  label: 'В друзья',
                  hint: 'Отправим запрос. Человек должен его принять.',
                },
                {
                  value: FriendshipType.SUBSCRIPTION,
                  label: 'Подписаться',
                  hint: 'Без подтверждения и добавления в друзья.',
                },
              ]"
            />
          </fieldset>
          <p v-if="error" class="friend-flow__error" role="alert">
            {{ error }}
          </p>
        </div>
      </div>
    </template>
    <template #footer>
      <Button @click="visible = false">Отмена</Button>
      <Button
        v-if="selected"
        class="friend-flow__submit"
        type="primary"
        :loading="sending"
        @click="send"
        >{{
          requestType === FriendshipType.FRIEND_REQUEST
            ? "Отправить запрос"
            : "Подписаться"
        }}</Button
      >
    </template>
  </BaseModal>
</template>

<style scoped lang="scss">
@use "@/styles/media" as *;

.friend-flow {
  min-width: 0;
  padding-bottom: 16px;

  @include mediaTablet {
    padding-bottom: 24px;
  }
  &__navigation {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
  }
  &__step {
    margin: 0;
    white-space: nowrap;
    color: var(--fv-color-text-secondary);
    font-size: 13px;
  }
  h3 {
    margin: 0 0 24px;
    font-size: 18px;
    line-height: 1.4;
    font-weight: 500;
    color: var(--fv-color-text-primary);
    outline: none;
  }
  &__recipient {
    display: grid;
    grid-template-columns: 56px minmax(0, 1fr);
    align-items: center;
    gap: 8px 16px;
    padding: 16px;
    margin-bottom: 20px;

    @include mediaTablet {
      grid-template-columns: 56px minmax(0, 1fr) auto;
      padding: 20px;
    }
    border-radius: 18px;
    background: var(--fv-color-bg-secondary);
    overflow-wrap: anywhere;
    > div {
      min-width: 0;
      display: grid;
      gap: 5px;
    }
    strong {
      font-size: 16px;
      font-weight: 500;
    }
    div > span {
      color: var(--fv-color-text-secondary);
      font-size: 14px;
    }
  }
  &__avatar {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    font-size: 24px;
    color: white;
  }
  &__change {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 8px 12px;
    border: 1px solid var(--fv-color-border);
    border-radius: 12px;
    background: var(--fv-color-bg-primary);
    color: var(--fv-color-text-primary);
    font-size: 14px;

    &--mobile {
      position: relative;
      height: 36px;
      min-height: 36px;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 10px;
      font-size: 13px;

      &::after {
        content: "";
        position: absolute;
        inset: -4px 0;
      }

      @include mediaTablet {
        display: none;
      }
    }
    &--desktop {
      display: none;

      @include mediaTablet {
        display: inline-flex;
        grid-column: 3;
        grid-row: 1;
        justify-self: start;
      }
    }
  }
  fieldset {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    margin-bottom: 12px;
    font-size: 14px;
    line-height: 1.5;
    font-weight: 500;
  }
  :deep(.base-radio__hint) {
    display: block;
    margin-top: 4px;
    font-size: 13px;
    line-height: 1.5;
  }
  :deep(.base-radio--card .base-radio__item--active) {
    border-color: var(--fv-color-brand);
    background: color-mix(
      in srgb,
      var(--fv-color-brand) 7%,
      var(--fv-color-bg-primary)
    );
  }
  :deep(.base-radio__item--active .base-radio__dot) {
    border-color: var(--fv-color-brand);
    &::after {
      background: var(--fv-color-brand);
    }
  }
  &__error {
    margin: 16px 0 0;
    color: var(--fv-color-text-primary);
    padding: 12px;
    border: 1px solid var(--fv-color-brand);
    border-radius: 12px;
  }
}
</style>
