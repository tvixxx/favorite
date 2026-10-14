import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import PasswordRecoveryModal from "./PasswordRecoveryModal.vue";
import ResetPasswordForm from "./ResetPasswordForm.vue";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  logOut: vi.fn(),
  replace: vi.fn(),
}));
const route = reactive({ hash: `#token=${"a".repeat(64)}`, query: {} });
vi.mock("@/services/api", () => ({ default: { post: mocks.post } }));
vi.mock("@/state/state", () => ({
  useMainStore: () => ({ logOut: mocks.logOut }),
}));
vi.mock("vue-router", () => ({
  useRoute: () => route,
  useRouter: () => ({ replace: mocks.replace }),
}));
const global = {
  stubs: {
    BaseModal: {
      template:
        '<section><slot name="title"/><slot name="body"/><slot name="footer"/></section>',
    },
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  route.hash = `#token=${"a".repeat(64)}`;
  mocks.logOut.mockResolvedValue(undefined);
  mocks.replace.mockResolvedValue(undefined);
});

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
    expect(invalid.text()).toContain("Ссылка недействительна");
    expect(invalid.find("form").exists()).toBe(false);
    invalid.unmount();
    route.hash = `#token=${"a".repeat(64)}`;
    const wrapper = mount(ResetPasswordForm);
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
});
