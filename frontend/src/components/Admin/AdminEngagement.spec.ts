import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import AdminEngagement from "./AdminEngagement.vue";
import type { AdminEngagementData } from "./admin.types";
const data: AdminEngagementData = {
  activity: {
    dau: 2,
    wau: 3,
    mau: 4,
    complete: { day: true, week: true, month: false },
  },
  funnel: { registered: 4, collected: 2, rated: 1 },
  retention: [
    {
      week: "2026-09-28",
      registered: 4,
      returned: 2,
      percent: 50,
      state: "complete",
    },
    {
      week: "2026-10-05",
      registered: 1,
      returned: null,
      percent: null,
      state: "collecting",
    },
    {
      week: "2026-09-21",
      registered: 1,
      returned: null,
      percent: null,
      state: "insufficient",
    },
  ],
};
describe("Активность, воронка и удержание", () => {
  it("показывает значения и конверсии, отличает частичную историю от нулевых показателей", () => {
    const wrapper = mount(AdminEngagement, { props: { data, days: 30 } });
    expect(wrapper.text()).toContain("За сутки");
    expect(wrapper.text()).toContain("Частичная история");
    expect(wrapper.text()).toContain("50% от предыдущего шага");
    expect(wrapper.text()).toContain("Следующая неделя ещё идёт");
    expect(wrapper.text()).toContain("Недостаточно истории");
    expect(wrapper.get('[data-week="2026-09-28"]').text()).toContain("50%");
    expect(wrapper.get('[data-week="2026-10-05"]').text()).not.toContain("0%");
    wrapper.unmount();
  });
  it("не показывает NaN/Infinity при пустой воронке", () => {
    const wrapper = mount(AdminEngagement, {
      props: {
        data: { ...data, funnel: { registered: 0, collected: 0, rated: 0 } },
        days: 7,
      },
    });
    expect(wrapper.text()).not.toMatch(/NaN|Infinity/);
    expect(wrapper.text()).toContain("Нет данных для конверсии");
    wrapper.unmount();
  });
});
