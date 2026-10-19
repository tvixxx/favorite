import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import DiaryList from "./DiaryList.vue";
import type { DiaryEntry } from "@/services/watch-diary";

describe("Безопасное отображение личной истории", () => {
  it.each([
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    '<a href="javascript:alert(1)">ссылка</a>',
  ])("показывает заметку как текст: %s", (note) => {
    const entry: DiaryEntry = {
      id: "entry",
      viewedOn: "2026-10-17",
      scope: "TITLE",
      season: null,
      isRewatch: false,
      rating: null,
      note,
      revision: 1,
      createdAt: "",
      updatedAt: "",
      inCollection: false,
      movie: {
        id: "film",
        title: "Интерстеллар",
        titleEn: null,
        contentKind: "GENERAL",
        isSerial: false,
        seasonCount: null,
        publishDate: null,
        imageUrl: null,
      },
    };
    const wrapper = mount(DiaryList, {
      props: { items: [entry] },
      global: { stubs: { BaseIcon: true, MoviePoster: true } },
    });

    expect(wrapper.get(".diary-entry__note").text()).toBe(note);
    expect(
      wrapper.get(".diary-entry__note").find("script, img, a").exists()
    ).toBe(false);

    expect(wrapper.text()).toContain("Вне коллекции");
    wrapper.unmount();
  });
});
