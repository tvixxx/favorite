<script lang="ts" setup>
import { useRouter } from "vue-router";
import { reactive } from "vue";
import { useMainStore } from "@/state/state";
import { Icon } from "@iconify/vue";
import { message } from "ant-design-vue";
import { EMAIL_REGEX } from "@/constants";

const store = useMainStore();
const router = useRouter();

interface FormState {
  email: string;
  password: string;
}

const formState = reactive<FormState>({
  email: "",
  password: "",
});

const onFinish = (values: FormState) => {
  login(values);
};

const login = async ({ email, password }: FormState) => {
  const trimmedEmail = email?.trim();
  const trimmedPassword = password?.trim();

  if (!trimmedEmail) {
    message.error("Email пропущен!");
    return;
  }

  if (!trimmedPassword) {
    message.error("Пароль пропущен!");
    return;
  }

  if (!EMAIL_REGEX.test(trimmedEmail)) {
    message.error("Введите корректный email");
    return;
  }

  try {
    await store.logIn({ email, password });
    router.push("/profile");
  } catch (err: any) {
    if (err.status === 401) {
      message.error(`Не удалось войти!`);
    } else {
      message.error(`Произошла ошибка, пожалуйста повторите!`);
    }
  }
};
</script>

<template>
  <div class="signin">
    <div class="signin__container">
      <div class="signin__header">
        <h1 class="signin__title">
          <Icon icon="stash:signin" class="signin__title-icon" />
          Вход
        </h1>
      </div>

      <a-form
        class="signin__form"
        :model="formState"
        name="login-form"
        autocomplete="off"
        @finish="onFinish"
      >
        <a-form-item name="email" class="signin__field">
          <template #label>
            <Icon icon="mdi:email-outline" class="signin__field-icon" />
            Email
          </template>
          <a-input
            v-model:value="formState.email"
            placeholder="Введите email"
            size="large"
          />
        </a-form-item>

        <a-form-item name="password" class="signin__field">
          <template #label>
            <Icon icon="mdi:lock-outline" class="signin__field-icon" />
            Пароль
          </template>
          <a-input-password
            v-model:value="formState.password"
            placeholder="Введите пароль"
            size="large"
          />
        </a-form-item>

        <a-form-item class="signin__submit">
          <a-button type="primary" html-type="submit" size="large" block>
            Войти
          </a-button>
        </a-form-item>
      </a-form>
    </div>
  </div>
</template>

<style lang="scss">
@use "../styles/screen-sizes" as *;
@use "../styles/media" as *;

.signin {
  min-height: 450px;
  height: 100%;
  background: linear-gradient(
    135deg,
    var(--bg-primary) 0%,
    var(--bg-secondary) 100%
  );
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  border-radius: 12px;
  box-shadow: 0px 5px 6px -1px rgba(0, 0, 0, 0.1),
    0px -1px 40px rgba(0, 0, 0, 0.1);

  &__container {
    max-width: 420px;
    width: 100%;
    margin: 0 auto;
  }

  &__header {
    text-align: center;
    margin-bottom: 2.5rem;
  }

  &__title {
    font-size: clamp(2rem, 5vw, 2.75rem);
    font-weight: 800;
    margin: 0;
    background: linear-gradient(
      135deg,
      var(--ant-color-primary),
      var(--text-primary)
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;

    .signin__title-icon {
      color: var(--ant-color-primary);
      width: 32px;
      height: 32px;
    }
  }

  // Ant Form стилизация
  :deep(.ant-form) {
    background: var(--bg-primary);
    padding: 2.5rem 2rem;
    border-radius: 24px;
    box-shadow: var(--shadow), 0 20px 40px rgba(0, 0, 0, 0.1);
    border: 1px solid var(--border-color);

    .ant-form-item {
      margin-bottom: 1.5rem;

      &.signin__field {
        .ant-form-item-label {
          > label {
            font-weight: 600;
            color: var(--text-primary);
            font-size: 0.95rem;
          }
        }

        .ant-form-item-control-input-content {
          .ant-input {
            border-radius: 12px;
            border: 2px solid var(--border-color);
            height: 52px;
            padding: 0 1rem;
            font-size: 1rem;
            transition: all 0.3s ease;
            background: var(--bg-secondary);

            &:focus,
            &:hover {
              border-color: var(--ant-color-primary);
              box-shadow: 0 0 0 3px
                color-mix(in srgb, var(--ant-color-primary), transparent 90%);
              background: var(--bg-primary);
            }

            &::placeholder {
              color: var(--text-secondary);
            }
          }

          .ant-input-password {
            .ant-input {
              @extend .ant-input;
            }

            .ant-input-password-icon {
              color: var(--text-secondary);
            }
          }
        }
      }
    }
  }

  // Submit Button
  &__submit {
    margin-bottom: 0 !important;

    :deep(.ant-btn-primary) {
      height: 52px;
      border-radius: 12px;
      border: none;
      background: linear-gradient(
        135deg,
        var(--ant-color-primary),
        color-mix(in srgb, var(--ant-color-primary), #000 15%)
      );
      font-weight: 600;
      font-size: 1rem;
      box-shadow: 0 4px 12px rgba(24, 144, 255, 0.3);

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 8px 20px rgba(24, 144, 255, 0.4);
      }

      &:active {
        transform: translateY(0);
      }
    }
  }

  // Field Icons
  &__field-icon {
    color: var(--ant-color-primary);
    width: 20px;
    height: 20px;
    margin-right: 0.5rem;
  }

  // Tablet+
  @include mediaTablet {
    padding: 3rem 2rem;

    &__container {
      max-width: 480px;
    }

    :deep(.ant-form) {
      padding: 3rem 2.5rem;
    }
  }

  // Desktop+
  @include mediaDesktopXS {
    padding: 4rem 3rem;

    &__container {
      max-width: 500px;
    }
  }
}
</style>
