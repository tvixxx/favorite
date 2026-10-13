import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminModeration from "./AdminModeration.vue";

const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));
vi.mock("@/services/api", () => ({ default: api }));

const entry = {
  id: "feedback-id",
  type: "BUG",
  status: "NEW",
  user: null,
  message:
    "[QA feedback] <script>это только текст</script>\n" +
    "Описание ошибки. ".repeat(50),
  email: "qa@example.test",
  pageUrl: "/feedback",
  viewport: "320x900",
  userAgent: "QA browser",
  createdAt: "2026-10-13T15:00:00Z",
};

async function render() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/admin", component: AdminModeration }],
  });

  await router.push("/admin?moderation=feedback");
  const wrapper = mount(AdminModeration, {
    global: {
      plugins: [router],
      stubs: {
        BaseModal: {
          props: ["modelValue"],
          template:
            '<section v-if="modelValue" role="dialog"><slot name="title"/><slot name="body"/><slot name="footer"/></section>',
        },
        AButton: {
          props: ["disabled", "loading"],
          template: '<button :disabled="disabled || loading"><slot/></button>',
        },
        ASelect: {
          props: ["value", "options"],
          emits: ["update:value"],
          template:
            '<select :value="value" @change="$emit(\'update:value\', $event.target.value)"><option v-for="item in options" :key="item.value" :value="item.value">{{item.label}}</option></select>',
        },
        AInput: true,
        ATable: true,
        ATag: true,
        AEmpty: true,
        AAlert: true,
        ARadioGroup: true,
        APagination: true,
        ATextarea: true,
        ASpin: { template: "<div><slot/></div>" },
        AdminDateFilters: true,
      },
    },
  });

  await flushPromises();
  await wrapper
    .findAll("button")
    .find((button) => button.text() === "Открыть обращение")!
    .trigger("click");

  return wrapper;
}

beforeEach(() => {
  api.get.mockReset().mockResolvedValue({ data: { items: [entry], total: 1 } });
  api.patch.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe("Работа с обращением в админке", () => {
  it("показывает полный текст и удалённого автора без выполнения разметки", async () => {
    const wrapper = await render();
    const dialog = wrapper.get('[role="dialog"]');

    expect(dialog.text()).toContain("Пользователь удалён");
    expect(dialog.get(".admin-text").text()).toBe(entry.message.trim());
    expect(dialog.find("script").exists()).toBe(false);
    wrapper.unmount();
  });

  it("сохраняет открытое обращение и выбранный статус при ошибке, позволяет повторить", async () => {
    api.patch
      .mockRejectedValueOnce({ response: { status: 503 } })
      .mockResolvedValueOnce({ data: { ...entry, status: "DONE" } });
    const wrapper = await render();

    await wrapper.get("#feedback-status").setValue("DONE");
    const save = wrapper
      .findAll("button")
      .find((button) => button.text() === "Сохранить статус")!;
    await save.trigger("click");
    await flushPromises();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect(
      wrapper.get<HTMLSelectElement>("#feedback-status").element.value
    ).toBe("DONE");
    expect(wrapper.get('[role="dialog"]').text()).toContain(
      entry.message.trim()
    );
    await save.trigger("click");
    await flushPromises();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    wrapper.unmount();
  });
});
