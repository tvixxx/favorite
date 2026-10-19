import { mount, flushPromises } from "@vue/test-utils";
import { Form, Input, Button } from "ant-design-vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SigninForm from "./SigninForm.vue";
import RegisterForm from "./RegisterForm.vue";

const actions = vi.hoisted(() => ({ logIn: vi.fn(), register: vi.fn() }));

vi.mock("@/state/state", () => ({
  useMainStore: () => ({ ...actions, userData: null }),
}));

vi.mock("vue-router", () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/services/api", () => ({
  default: { get: vi.fn().mockResolvedValue({ data: { enabled: false } }) },
}));

describe("Пароль не обрезается при превышении допустимой длины", () => {
  beforeEach(() =>
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    ["вход", SigninForm],
    ["регистрация", RegisterForm],
  ] as const)(
    "%s: сохраняет исходный ввод и не отправляет запрос",
    async (_name, component) => {
      const wrapper = mount(component, {
        global: {
          components: {
            AForm: Form,
            AFormItem: Form.Item,
            AInput: Input,
            AInputPassword: Input.Password,
            AButton: Button,
          },
          stubs: { BaseIcon: true, PasswordRecoveryModal: true },
        },
      });
      const name = wrapper.find('input[placeholder="Ваше имя"]');

      if (name.exists()) await name.setValue("Тестовый пользователь");
      await wrapper
        .get('input[placeholder="Email"]')
        .setValue("qa@example.test");

      const password = "Aa1" + "x".repeat(126);

      await wrapper.get('input[type="password"]').setValue(password);
      await wrapper.get("form").trigger("submit");
      await flushPromises();
      expect(
        (wrapper.get('input[type="password"]').element as HTMLInputElement)
          .value
      ).toBe(password);

      await vi.waitFor(() => expect(wrapper.text()).toContain("128"));
      expect(actions.logIn).not.toHaveBeenCalled();
      expect(actions.register).not.toHaveBeenCalled();
      wrapper.unmount();
    }
  );
});
