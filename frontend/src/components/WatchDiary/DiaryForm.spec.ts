import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import DiaryForm from "./DiaryForm.vue";
import type { DiaryMovie } from "@/services/watch-diary";

const movie: DiaryMovie = {
  id: "film",
  title: "Интерстеллар",
  titleEn: "Interstellar",
  isSerial: false,
  seasonCount: null,
  publishDate: null,
  contentKind: "GENERAL",
  imageUrl: null,
};
const render = (extra = {}) =>
  mount(DiaryForm, {
    props: {
      modelValue: true,
      movie,
      movies: [],
      today: "2026-10-17",
      busy: false,
      ...extra,
    },
    global: {
      stubs: {
        BaseModal: {
          props: ["modelValue"],
          template:
            '<div v-if="modelValue"><slot name="title"/><slot name="body"/><slot name="footer"/></div>',
        },
        MoviePoster: true,
        BaseIcon: true,
        ADatePicker: {
          props: ["value", "size"],
          emits: ["update:value"],
          template:
            '<input aria-label="Дата просмотра" :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
        },
      },
    },
  });

describe("Форма записи дневника", () => {
  it("отправляет приватную запись без синхронизации коллекции и повторяет тот же ключ при повторной попытке", async () => {
    const wrapper = render();

    await wrapper.get("form").trigger("submit");

    const first = wrapper.emitted("confirm")?.[0]?.[0] as {
      requestId: string;
      values: object;
    };

    expect(first.values).toMatchObject({
      viewedOn: "2026-10-17",
      scope: "TITLE",
      rating: null,
      syncRating: false,
      syncStatus: false,
    });

    expect(first.requestId).toMatch(/^[0-9a-f-]{36}$/);
    await wrapper.get("form").trigger("submit");
    expect(
      (wrapper.emitted("confirm")?.[1]?.[0] as typeof first).requestId
    ).toBe(first.requestId);

    wrapper.unmount();
  });

  it("сохраняет ошибочный ввод даты и не отправляет его", async () => {
    const wrapper = render();

    await wrapper
      .get('input[aria-label="Дата просмотра"]')
      .setValue("2026-10-18");

    await wrapper.get("form").trigger("submit");
    expect(wrapper.emitted("confirm")).toBeUndefined();
    expect(wrapper.text()).toContain("будущем");
    expect(
      (
        wrapper.get('input[aria-label="Дата просмотра"]')
          .element as HTMLInputElement
      ).value
    ).toBe("2026-10-18");

    wrapper.unmount();
  });

  it("показывает совпавшую запись и предлагает намеренно сохранить отдельный просмотр", async () => {
    const wrapper = render({
      duplicate: { id: "existing", viewedOn: "2026-10-17", movie },
    });

    expect(wrapper.text()).toContain("уже есть запись");
    await wrapper.get("[data-allow-duplicate]").trigger("click");
    expect(
      (wrapper.emitted("confirm")?.[0]?.[0] as { allowDuplicate: boolean })
        .allowDuplicate
    ).toBe(true);

    wrapper.unmount();
  });

  it("блокирует повторное сохранение во время запроса", async () => {
    const wrapper = render({ busy: true });

    await wrapper.get("form").trigger("submit");
    expect(wrapper.emitted("confirm")).toBeUndefined();
    wrapper.unmount();
  });
});
