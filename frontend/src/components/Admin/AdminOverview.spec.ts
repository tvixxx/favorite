import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import AdminOverview from "./AdminOverview.vue";
import { createPinia } from "pinia";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/services/api", () => ({ default: { get: mocks.get } }));

describe("Регистрации в обзоре администратора", () => {
  it("открывает общий BaseModal с датами, точными значениями и итогом", async () => {
    mocks.get.mockResolvedValue({
      data: {
        users: 5,
        movies: 23,
        serials: 2,
        reviews: 0,
        newFeedback: 0,
        active: 0,
        returning: null,
        inactive: null,
        startedAt: "2026-10-01T00:00:00Z",
        since: "2026-10-01T00:00:00Z",
        until: "2026-10-13T12:00:00Z",
        timezone: "UTC+4",
        registrations: [
          { day: "2026-10-12", count: 2 },
          { day: "2026-10-13", count: 3 },
        ],
        features: [],
        heatmap: [{ day: 1, hour: 1, users: 1 }],
      },
    });

    const wrapper = mount(AdminOverview, {
      global: {
        plugins: [createPinia()],
        stubs: {
          BaseModal: {
            props: ["modelValue"],
            template:
              '<div v-if="modelValue" role="dialog"><slot name="title" /><slot name="body" /></div>',
          },
          ASpin: { template: "<div><slot /></div>" },
          AButton: { template: "<button><slot /></button>" },
        },
      },
    });

    await flushPromises();
    expect(wrapper.text()).toContain("21 фильм и 2 сериала");
    expect(wrapper.get(".admin-heat button").attributes("title")).toBe(
      "0 пользователей"
    );

    await wrapper.get('[data-testid="registration-details"]').trigger("click");

    const dialog = wrapper.get('[role="dialog"]');

    expect(dialog.text()).toContain("Новые регистрации");
    expect(dialog.text()).toContain("12.10.2026");
    expect(dialog.text()).toContain("13.10.2026");
    expect(dialog.text()).toContain("Всего за период: 5");
    expect(dialog.findAll("time")).toHaveLength(2);
    wrapper.unmount();
  });
});
