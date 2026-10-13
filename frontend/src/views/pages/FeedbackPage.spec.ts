import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FeedbackPage from "./FeedbackPage.vue";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/composable", () => ({
  useFetch: mocks.fetch,
  FETCH_METHOD: { post: "POST" },
}));
vi.mock("@/state/state", () => ({
  useMainStore: () => ({ userData: { email: "qa@example.test" } }),
}));
vi.mock("@/composable/useNavigateBack", () => ({
  useNavigateBack: () => ({ navigateBack: vi.fn() }),
}));

async function render() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/feedback", component: FeedbackPage }],
  });

  await router.push("/feedback");
  const wrapper = mount(FeedbackPage, {
    global: {
      plugins: [router],
      stubs: {
        BaseIcon: true,
        AButton: {
          props: ["disabled", "loading"],
          template: '<button :disabled="disabled || loading"><slot/></button>',
        },
        ATextarea: {
          props: ["value"],
          emits: ["update:value"],
          template:
            '<textarea :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
        },
        AInput: {
          props: ["value"],
          emits: ["update:value"],
          template:
            '<input :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
        },
        StateBlock: {
          props: ["description", "actions"],
          template:
            '<section role="alert">{{description}}<button @click="actions[0].onClick">Повторить</button></section>',
        },
      },
    },
  });

  await flushPromises();

  return wrapper;
}

beforeEach(() => mocks.fetch.mockReset());

describe("Отправка обратной связи", () => {
  it("не отправляет короткий текст и очищает сообщение только после успешной отправки", async () => {
    mocks.fetch.mockResolvedValue({ status: 201, data: { id: "feedback-id" } });
    const wrapper = await render();
    const send = wrapper
      .findAll("button")
      .find((button) => button.text() === "Отправить")!;

    await wrapper.get("textarea").setValue("   коротко   ");
    expect(send.attributes("disabled")).toBeDefined();
    expect(mocks.fetch).not.toHaveBeenCalled();
    await wrapper.get("textarea").setValue("  Сообщение об ошибке  ");
    await send.trigger("click");
    await flushPromises();
    expect(mocks.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        data: expect.objectContaining({
          message: "Сообщение об ошибке",
          email: "qa@example.test",
        }),
      })
    );
    expect(wrapper.get<HTMLTextAreaElement>("textarea").element.value).toBe("");
    wrapper.unmount();
  });

  it("сохраняет текст при ограничении запросов и позволяет повторить отправку", async () => {
    mocks.fetch
      .mockRejectedValueOnce({ response: { status: 429 } })
      .mockResolvedValueOnce({ status: 201, data: { id: "feedback-id" } });
    const wrapper = await render();

    await wrapper.get("textarea").setValue("Подробное описание проблемы");
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Отправить")!
      .trigger("click");
    await flushPromises();
    expect(wrapper.get<HTMLTextAreaElement>("textarea").element.value).toBe(
      "Подробное описание проблемы"
    );
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "Слишком много обращений"
    );
    await wrapper.get('[role="alert"] button').trigger("click");
    await flushPromises();
    expect(wrapper.get<HTMLTextAreaElement>("textarea").element.value).toBe("");
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    wrapper.unmount();
  });
});
