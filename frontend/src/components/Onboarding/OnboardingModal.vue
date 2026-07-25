<script setup lang="ts">
import { watch } from "vue";
import { useRouter } from "vue-router";
import { setOnboardingDone } from "@/composable/useOnboarding";
import { createOnboardingDriver } from "@/onboarding/createOnboardingDriver";
import BaseModal from "@/components/BaseModal/BaseModal.vue";

const openModel = defineModel<boolean>("open", { required: true });

const props = defineProps<{
  userId: string;
}>();

const router = useRouter();

let startingTour = false;

const markDone = (): void => {
  if (props.userId) {
    setOnboardingDone(props.userId);
  }
};

// Любое закрытие (крестик / клик по фону / Esc / «Пропустить») отмечает обучение
// пройденным — кроме запуска тура (там отметка ставится по его завершении).
watch(openModel, (open) => {
  if (open) {
    startingTour = false;

    return;
  }

  if (!startingTour) {
    markDone();
  }
});

const finishAndSkip = (): void => {
  openModel.value = false;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const startInteractiveTour = async (): Promise<void> => {
  startingTour = true;
  openModel.value = false;
  await sleep(280);

  const tourDriver = createOnboardingDriver(router, {
    onCompleted: markDone,
  });

  tourDriver.drive();
};
</script>

<template>
  <BaseModal v-model="openModel" class="onboarding-modal">
    <template #title>Добро пожаловать в Favorite</template>

    <template #body>
      <div class="onboarding-modal__body">
        <p class="onboarding-modal__text">
          Это приложение для <strong>личной медиатеки</strong>: коллекция, оценки,
          статусы просмотра и свои списки.
        </p>

        <p class="onboarding-modal__text">
          Рекомендуем пройти <strong>интерактивный тур</strong>, как в продуктах
          Notion или Linear: мы подсветим меню «Медиатека», быстрый ввод и фильтры
          коллекции, каталог, друзей по email и колокольчик уведомлений.
        </p>

        <ul class="onboarding-modal__bullets">
          <li>несколько шагов на странице коллекции;</li>
          <li>переход в каталог с подсветкой фильтров;</li>
          <li>раздел «Друзья» и уведомления в шапке.</li>
        </ul>

        <p class="onboarding-modal__text muted">
          Тур можно закрыть в любой момент — мы сохраним отметку «обучение
          пройдено» так же, как при «Пропустить».
        </p>
      </div>
    </template>

    <template #footer>
      <div class="onboarding-modal__footer">
        <a-button
          type="link"
          class="onboarding-modal__skip"
          @click="finishAndSkip"
        >
          Пропустить
        </a-button>

        <a-button type="primary" @click="startInteractiveTour">
          Запустить интерактивный тур
        </a-button>
      </div>
    </template>
  </BaseModal>
</template>

<style scoped lang="scss">
.onboarding-modal__body {
  text-align: left;
}

.onboarding-modal__text {
  margin: 0 0 0.75rem;
  line-height: 1.55;
  font-size: 15px;

  &.muted {
    margin-top: 1rem;
    opacity: 0.85;
    font-size: 13px;
    line-height: 1.45;
  }

  &:last-child {
    margin-bottom: 0;
  }
}

.onboarding-modal__bullets {
  margin: 0.75rem 0 0;
  padding-left: 1.25rem;
  line-height: 1.55;
  font-size: 14px;
  color: var(--fv-color-text-secondary);

  li {
    margin-bottom: 0.35rem;
  }
}

.onboarding-modal__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  flex-wrap: wrap;
}

.onboarding-modal__skip {
  padding-left: 0;
}
</style>
