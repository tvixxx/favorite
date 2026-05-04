<script lang="ts" setup>
import { useRouter } from "vue-router";
import { reactive } from "vue";
import { useMainStore } from "@/state/state";
import { Icon } from "@iconify/vue";
import { message } from "ant-design-vue";
import { EMAIL_REGEX } from "@/constants";
import { ERROR_LOGIN_TEXT, SUCCESS_LOGIN_TEXT } from "@/state/constants";

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
    message.success(
      `${SUCCESS_LOGIN_TEXT}, ${store.userData?.fullName || ""}!`
    );
    router.push("/profile");
  } catch {
    message.error(ERROR_LOGIN_TEXT);
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
@use "../../styles/media" as *;
@use "@/styles/auth" as *;

.signin {
  @include authShell;

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
    @include authTitle("signin");
  }

  @include authAntForm("signin");

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

  &__field-icon {
    color: var(--ant-color-primary);
    width: 20px;
    height: 20px;
    margin-right: 0.5rem;
  }

  @include mediaTablet {
    padding: 3rem 2rem;

    &__container {
      max-width: 480px;
    }
  }

  @include mediaDesktopXS {
    padding: 4rem 3rem;

    &__container {
      max-width: 500px;
    }
  }
}
</style>
