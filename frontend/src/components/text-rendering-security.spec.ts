import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import MovieCard from "./MovieCard/MovieCard.vue";
import ReviewText from "./Reviews/ReviewText.vue";
import ChatMessageContent from "./ChatMessageContent/ChatMessageContent.vue";

const attacks = [
  "<img src=x onerror=alert(1)>",
  "<script>alert(1)</script>",
  "<svg onload=alert(1)>",
  "javascript:alert(1)",
  "data:text/html,<script>alert(1)</script>",
];

describe("Безопасное отображение пользовательского текста", () => {
  it.each(attacks)(
    "отображает строку как текст без исполняемой разметки: %s",
    (text) => {
      const wrappers = [
        mount(MovieCard, {
          props: { title: text, posterSrc: "" },
          global: { stubs: { MoviePoster: true, BaseIcon: true } },
        }),
        mount(ReviewText, { props: { text, reviewId: "review" } }),
        mount(ChatMessageContent, { props: { content: text } }),
      ];

      for (const wrapper of wrappers) {
        expect(wrapper.text()).toContain(text);
        expect(
          wrapper
            .find(
              'script, img, svg, iframe, [onerror], [onload], a[href^="javascript:"], a[href^="data:"]'
            )
            .exists()
        ).toBe(false);

        wrapper.unmount();
      }
    }
  );
});
