import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import ReviewItem from "./ReviewItem.vue";

vi.mock("@/state/state", () => ({ useMainStore: () => ({ userData: null }) }));

const review = {
  id: "review-1",
  userId: "user-1",
  movieId: "movie-1",
  text: "В финале герой возвращается домой",
  rate: 8,
  isSpoiler: true,
};

describe("Спойлеры в отзывах", () => {
  it("скрывает текст до явного раскрытия и позволяет скрыть его снова", async () => {
    const wrapper = mount(ReviewItem, { props: { review } });

    expect(wrapper.text()).not.toContain(review.text);

    const button = wrapper.get('button[aria-expanded="false"]');

    expect(button.text()).toBe("Показать");
    expect(button.attributes("aria-label")).toBe("Показать спойлер");
    await button.trigger("click");
    expect(wrapper.text()).toContain(review.text);
    expect(button.text()).toBe("Скрыть");
    expect(button.attributes("aria-label")).toBe("Скрыть спойлер");
    await wrapper.get('button[aria-expanded="true"]').trigger("click");
    expect(wrapper.text()).not.toContain(review.text);
    wrapper.unmount();
  });

  it("не раскрывает новый текст вместо уже прочитанного спойлера", async () => {
    const wrapper = mount(ReviewItem, { props: { review } });

    await wrapper.get('button[aria-expanded="false"]').trigger("click");
    await wrapper.setProps({
      review: { ...review, text: "Совершенно другой финал истории" },
    });

    expect(wrapper.text()).not.toContain("Совершенно другой финал истории");
    wrapper.unmount();
  });

  it("показывает старый отзыв без отметки сразу", () => {
    const oldReview = {
      id: review.id,
      userId: review.userId,
      movieId: review.movieId,
      text: review.text,
      rate: review.rate,
    };
    const wrapper = mount(ReviewItem, { props: { review: oldReview } });

    expect(wrapper.text()).toContain(review.text);
    expect(wrapper.find("button[aria-expanded]").exists()).toBe(false);
    wrapper.unmount();
  });
});
