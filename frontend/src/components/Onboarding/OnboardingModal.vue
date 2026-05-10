<script setup lang="ts">
import { useRouter } from "vue-router";
import { setOnboardingDone } from "@/composable/useOnboarding";
import { createOnboardingDriver } from "@/onboarding/createOnboardingDriver";

const openModel = defineModel<boolean>("open", { required: true });

const props = defineProps<{
  userId: string;
}>();

const router = useRouter();

const finishAndSkip = () => {
  if (props.userId) {
    setOnboardingDone(props.userId);
  }

  openModel.value = false;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const startInteractiveTour = async () => {
  openModel.value = false;
  await sleep(280);

  const tourDriver = createOnboardingDriver(router, {
    onCompleted: () => {
      if (props.userId) {
        setOnboardingDone(props.userId);
      }
    },
  });

  tourDriver.drive();
};
</script>

<template>
  <a-modal
    :open="openModel"
    title="Добро пожаловать в Favorite"
    :footer="null"
    :closable="true"
    :mask-closable="false"
    destroy-on-close
    width="min(520px, calc(100vw - 24px))"
    class="onboarding-modal"
    @cancel="finishAndSkip"
  >
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
        Тур можно закрыть в любой момент — мы сохраним отметку «обучение пройдено»
        так же, как при «Пропустить».
      </p>
    </div>

    <div class="onboarding-modal__footer">
      <a-button type="link" class="onboarding-modal__skip" @click="finishAndSkip">
        Пропустить
      </a-button>

      <div class="onboarding-modal__nav">
        <a-button type="primary" size="large" @click="startInteractiveTour">
          Запустить интерактивный тур
        </a-button>
      </div>
    </div>
  </a-modal>
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
  color: var(--text-secondary);

  li {
    margin-bottom: 0.35rem;
  }
}

.onboarding-modal__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 1.5rem;
  flex-wrap: wrap;
}

.onboarding-modal__skip {
  padding-left: 0;
}

.onboarding-modal__nav {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-left: auto;
}
</style>
