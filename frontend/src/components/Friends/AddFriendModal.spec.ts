import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AddFriendModal from "./AddFriendModal.vue";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  send: vi.fn(),
  success: vi.fn(),
}));

vi.mock("@/services/api", () => ({ default: { get: mocks.get } }));
vi.mock("@/stores/friends/friendsStore", () => ({
  FriendshipType: {
    FRIEND_REQUEST: "FRIEND_REQUEST",
    SUBSCRIPTION: "SUBSCRIPTION",
  },
  useFriendsStore: () => ({ sendRequest: mocks.send }),
}));

vi.mock("ant-design-vue", async (original) => ({
  ...(await original<typeof import("ant-design-vue")>()),
  message: { success: mocks.success },
}));

const person = {
  id: "recipient",
  fullName: "Анна Волкова",
  username: "anna_movies",
  ignored: "not-for-request",
};
let wrapper: ReturnType<typeof mount>;
const render = () => {
  wrapper = mount(AddFriendModal, {
    props: { modelValue: true, userId: "owner" },
    attachTo: document.body,
    global: {
      stubs: {
        BaseModal: {
          props: ["modelValue"],
          template:
            '<section v-if="modelValue" role="dialog"><slot name="title"/><slot name="body"/><slot name="footer"/></section>',
        },
        BaseIcon: true,
        SkeletonBar: true,
      },
    },
  });

  return wrapper;
};
const choose = async () => {
  await wrapper.get("input").setValue("Анна");
  await vi.advanceTimersByTimeAsync(300);
  await flushPromises();
  await wrapper.get(".user-search__result").trigger("click");
  await flushPromises();
};

beforeEach(() => {
  vi.useFakeTimers();
  mocks.get.mockReset().mockResolvedValue({ data: [person] });
  mocks.send.mockReset().mockResolvedValue({ id: "relation" });
  mocks.success.mockReset();
});

afterEach(() => {
  wrapper?.unmount();
  vi.useRealTimers();
});

describe("Два шага добавления друга", () => {
  it.each([
    ["mobile", ".friend-flow__navigation", "Назад к поиску"],
    ["desktop", ".friend-flow__recipient", "Изменить выбор"],
  ])(
    "сохраняет поиск при возврате через кнопку %s",
    async (placement, parent, label) => {
      render();
      expect(wrapper.text()).toContain("1 из 2");

      const heading = wrapper.get(".friend-flow h3").element;

      expect(heading.closest(".fv-friend-enter")).toBeNull();
      expect(wrapper.find(".friend-flow__submit").exists()).toBe(false);
      await choose();
      expect(wrapper.text()).toContain("2 из 2");
      expect(wrapper.get(".friend-flow h3").element).toBe(heading);
      expect(heading.closest(".fv-friend-enter")).toBeNull();
      expect(
        wrapper
          .get(".friend-flow__recipient")
          .element.closest(".fv-friend-enter")
      ).not.toBeNull();

      expect(wrapper.get(".friend-flow__recipient").text()).toContain(
        "Анна Волкова"
      );

      expect(wrapper.get(".friend-flow__recipient").text()).toContain(
        "anna_movies"
      );

      const back = wrapper.get(`.friend-flow__change--${placement}`);

      expect(back.text()).toBe(label);
      expect(back.element.closest(parent)).not.toBeNull();

      await back.trigger("click");
      expect(wrapper.text()).toContain("1 из 2");
      expect(wrapper.get(".friend-flow h3").element).toBe(heading);
      expect((wrapper.get("input").element as HTMLInputElement).value).toBe(
        "Анна"
      );

      expect(mocks.get).toHaveBeenCalledTimes(1);
      expect(mocks.send).not.toHaveBeenCalled();
    }
  );

  it("отправляет только получателя и выбранный тип, блокирует повторный запрос", async () => {
    render();
    await choose();
    await wrapper.findAll('[role="radio"]')[1].trigger("click");

    let finish!: (value: unknown) => void;

    mocks.send.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );

    await wrapper.get(".friend-flow__submit").trigger("click");
    await wrapper.get(".friend-flow__submit").trigger("click");
    expect(mocks.send.mock.calls).toEqual([
      ["owner", "recipient", "SUBSCRIPTION"],
    ]);

    expect(wrapper.get("fieldset").attributes("disabled")).toBeDefined();
    expect(wrapper.findAll(".friend-flow__change")).toHaveLength(2);
    expect(
      wrapper
        .findAll(".friend-flow__change")
        .every((button) => button.attributes("disabled") !== undefined)
    ).toBe(true);

    finish({ id: "relation" });
    await flushPromises();
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([false]);
    expect(mocks.success).toHaveBeenCalledWith(
      "Вы подписались на пользователя"
    );
  });

  it("оставляет получателя и введённые данные при ошибке, разрешает повтор", async () => {
    mocks.send.mockRejectedValueOnce(new Error("offline"));
    render();
    await choose();
    await wrapper.get(".friend-flow__submit").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("Не удалось отправить");
    expect(wrapper.get(".friend-flow__recipient").text()).toContain(
      "Анна Волкова"
    );

    await wrapper.get(".friend-flow__submit").trigger("click");
    await flushPromises();
    expect(mocks.send).toHaveBeenCalledTimes(2);
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([false]);
  });

  it("не показывает поздний результат отправки после закрытия или смены аккаунта", async () => {
    let fail!: (error: Error) => void;

    mocks.send.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        fail = reject;
      })
    );

    render();
    await choose();
    await wrapper.get(".friend-flow__submit").trigger("click");
    await wrapper.setProps({ userId: "other-owner" });
    fail(new Error("late"));
    await flushPromises();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(wrapper.text()).not.toContain("Не удалось отправить");
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([false]);
  });
});
