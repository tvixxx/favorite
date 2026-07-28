<script setup lang="ts">
import { watch } from "vue";
import { useRouter } from "vue-router";
import { setOnboardingDone } from "@/composable/useOnboarding";
import { createOnboardingDriver } from "@/onboarding/createOnboardingDriver";
import BaseModal from "@/components/BaseModal/BaseModal.vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";

// Список того, что покажет тур — иконки синие, как в эталоне
const TOUR_STEPS_PREVIEW: { icon: string; text: string }[] = [
  { icon: "ph:squares-four", text: "Несколько шагов на странице коллекции" },
  { icon: "ph:magnifying-glass", text: "Каталог с подсветкой фильтров" },
  { icon: "ph:users-three", text: "Раздел «Друзья» и уведомления в шапке" },
];

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
          Это приложение для <strong>личной медиатеки</strong>: коллекция,
          оценки, статусы просмотра и свои списки.
        </p>

        <p class="onboarding-modal__text">
          Рекомендуем пройти <strong>интерактивный тур</strong> — подсветим меню
          «Медиатека», быстрый ввод и фильтры, каталог, друзей и колокольчик
          уведомлений.
        </p>

        <div class="onboarding-modal__steps">
          <p
            v-for="step in TOUR_STEPS_PREVIEW"
            :key="step.icon"
            class="onboarding-modal__step"
          >
            <BaseIcon :name="step.icon" :width="19" :height="19" />
            {{ step.text }}
          </p>
        </div>
      </div>
    </template>

    <template #footer>
      <a-button
        type="link"
        class="onboarding-modal__skip"
        @click="finishAndSkip"
      >
        Пропустить
      </a-button>

      <a-button
        type="primary"
        class="onboarding-modal__start"
        @click="startInteractiveTour"
      >
        <BaseIcon name="ph:play" :width="17" :height="17" />
        Запустить тур
      </a-button>
    </template>
  </BaseModal>
</template>

<style scoped lang="scss">
.onboarding-modal__body {
  text-align: left;
}

.onboarding-modal__text {
  margin: 0 0 16px;
  font-size: var(--fv-text-p3-size);
  line-height: var(--fv-text-p3-lh);
  color: var(--fv-color-text-secondary);

  strong {
    font-weight: 500;
    color: var(--fv-color-text-primary);
  }
}

/* Серый блок-список того, что покажет тур (эталон) */
.onboarding-modal__steps {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 18px;
  margin-bottom: 6px;
  border-radius: var(--fv-radius-md);
  background: var(--fv-color-bg-secondary);
}

.onboarding-modal__step {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: var(--fv-text-p4-size);
  line-height: var(--fv-text-p4-lh);
  color: var(--fv-color-text-secondary);

  svg {
    flex-shrink: 0;
    color: var(--fv-color-accent);
  }
}

.onboarding-modal__skip {
  margin-right: auto;
  padding-left: 0;
  color: var(--fv-color-link);
}
</style>
