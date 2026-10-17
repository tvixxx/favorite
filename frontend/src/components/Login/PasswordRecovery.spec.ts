import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import { Form, FormItem, Input, InputPassword, Button } from "ant-design-vue";
import PasswordRecoveryModal from "./PasswordRecoveryModal.vue";
import ResetPasswordForm from "./ResetPasswordForm.vue";
import SigninForm from "./SigninForm.vue";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
  logOut: vi.fn(),
  replace: vi.fn(),
}));
const route = reactive({ hash: `#token=${"a".repeat(64)}`, query: {} as Record<string, string> });
vi.mock("@/services/api", () => ({ default: { post: mocks.post, get: mocks.get } }));
vi.mock("@/state/state", () => ({
  useMainStore: () => ({ logOut: mocks.logOut }),
}));
vi.mock("vue-router", () => ({
  useRoute: () => route,
  useRouter: () => ({ replace: mocks.replace }),
}));
const global = {
  components: { AForm: Form, AFormItem: FormItem, AInput: Input, AInputPassword: InputPassword, AButton: Button },
  stubs: {
    BaseIcon: true,
    RouterLink: { template: '<a><slot/></a>' },
    BaseModal: {
      template:
        '<section><slot name="title"/><slot name="body"/><slot name="footer"/></section>',
    },
  },
};
beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
  vi.clearAllMocks();
  mocks.post.mockReset();
  mocks.get.mockReset().mockResolvedValue({ data: { passwordRecovery: true } });
  route.query = {};
  route.hash = `#token=${"a".repeat(64)}`;
  mocks.logOut.mockResolvedValue(undefined);
  mocks.replace.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllGlobals());

describe("Восстановление пароля", () => {
  it("проверяет email до запроса, показывает одинаковое подтверждение и не отправляет повтор во время ожидания", async () => {
    let finish!: (value: unknown) => void;
    mocks.post.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const wrapper = mount(PasswordRecoveryModal, {
      props: { email: "", modelValue: true },
      global,
    });
    await wrapper.get("input").setValue("wrong");
    await wrapper.get("form").trigger("submit");
    expect(mocks.post).not.toHaveBeenCalled();
    await wrapper.get("input").setValue("user@example.test");
    await wrapper.get("form").trigger("submit");
    await wrapper.get("form").trigger("submit");
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.post).toHaveBeenCalledWith(
      "/auth/password/request",
      { email: "user@example.test" },
      expect.objectContaining({ timeout: 15000 })
    );
    finish({ data: {} });
    await flushPromises();
    expect(wrapper.text()).toContain("Если такой аккаунт существует");
    wrapper.unmount();
  });
  it("не отправляет неверную ссылку или несовпадающий пароль, после успеха очищает поля, ссылку и прежнюю сессию", async () => {
    route.hash = "#token=wrong";
    const invalid = mount(ResetPasswordForm);
    await flushPromises();
    expect(invalid.text()).toContain("Ссылка недействительна");
    expect(invalid.find("form").exists()).toBe(false);
    invalid.unmount();
    route.hash = `#token=${"a".repeat(64)}`;
    const wrapper = mount(ResetPasswordForm);
    await flushPromises();
    const inputs = wrapper.findAll('input[type="password"]');
    await inputs[0].setValue("new-password-123");
    await inputs[1].setValue("different");
    await wrapper.get("form").trigger("submit");
    expect(mocks.post).not.toHaveBeenCalled();
    mocks.post.mockResolvedValue({ data: {} });
    await inputs[1].setValue("new-password-123");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(mocks.post).toHaveBeenCalledWith(
      "/auth/password/reset",
      { token: "a".repeat(64), password: "new-password-123" },
      expect.objectContaining({ timeout: 15000 })
    );
    expect(mocks.logOut).toHaveBeenCalledOnce();
    expect(mocks.replace).toHaveBeenCalledWith({ hash: "" });
    expect(wrapper.find("form").exists()).toBe(false);
    expect(wrapper.text()).toContain("Пароль изменён");
    wrapper.unmount();
  });
  it("показывает ошибку сервера, сохраняет форму и позволяет повторить запрос", async () => {
    const wrapper = mount(ResetPasswordForm);
    await flushPromises();
    for (const input of wrapper.findAll('input[type="password"]'))
      await input.setValue("new-password-123");
    mocks.post.mockRejectedValueOnce({ response: { status: 400 } });
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.text()).toContain("Ссылка недействительна или истекла");
    expect(mocks.logOut).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
    mocks.post.mockResolvedValue({ data: {} });
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.text()).toContain("Пароль изменён");
    wrapper.unmount();
  });

  it.each([false, undefined, "true"])("скрывает вход и не открывает восстановление по recover=1 при доступности %s", async (available) => {
    route.query = { recover: "1" };
    mocks.get.mockResolvedValue({ data: { passwordRecovery: available } });
    const wrapper = mount(SigninForm, { global });
    await flushPromises();
    expect(wrapper.text()).not.toContain("Забыли пароль?");
    expect(wrapper.text()).not.toContain("Восстановление пароля");
    expect(mocks.post).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("показывает вход в восстановление только после подтверждения сервера", async () => {
    let finish!: (value: unknown) => void;
    mocks.get.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const wrapper = mount(SigninForm, { global });
    expect(wrapper.text()).not.toContain("Забыли пароль?");
    finish({ data: { passwordRecovery: true } });
    await flushPromises();
    await wrapper.findAll("button").find(button => button.text() === "Забыли пароль?")!.trigger("click");
    expect(wrapper.text()).toContain("Восстановление пароля");
    expect(wrapper.find('#recovery-email').exists()).toBe(true);
    expect(mocks.get).toHaveBeenCalledWith("/auth/password/capabilities", expect.any(Object));
    wrapper.unmount();
  });

  it("не предлагает сменить пароль по прямой старой ссылке при выключенной функции", async () => {
    mocks.get.mockResolvedValue({ data: { passwordRecovery: false } });
    const wrapper = mount(ResetPasswordForm, { global });
    await flushPromises();
    expect(wrapper.text()).toContain("Восстановление пароля сейчас недоступно");
    expect(wrapper.find("form").exists()).toBe(false);
    expect(wrapper.find('input[type="password"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Запросить новую ссылку");
    expect(mocks.post).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("оставляет восстановление закрытым при ошибке доступности и позволяет повторить проверку", async () => {
    mocks.get.mockRejectedValueOnce(new Error("Network Error"));
    const wrapper = mount(ResetPasswordForm, { global });
    await flushPromises();
    expect(wrapper.find("form").exists()).toBe(false);
    mocks.get.mockResolvedValue({ data: { passwordRecovery: true } });
    await wrapper.findAll("button").find(button => button.text() === "Повторить проверку")!.trigger("click");
    await flushPromises();
    expect(wrapper.find("form").exists()).toBe(true);
    expect(mocks.post).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
