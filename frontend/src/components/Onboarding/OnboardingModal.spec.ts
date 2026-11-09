import { flushPromises, shallowMount } from "@vue/test-utils";
import { expect, it, vi } from "vitest";
import OnboardingModal from "./OnboardingModal.vue";

const mocks = vi.hoisted(() => ({
  settleLayout: vi.fn(),
  createDriver: vi.fn(),
  markDone: vi.fn(),
}));

vi.mock("vue-router", () => ({ useRouter: () => ({}) }));
vi.mock("@/composable/useOnboarding", () => ({
  setOnboardingDone: mocks.markDone,
}));

vi.mock("@/onboarding/createOnboardingDriver", () => ({
  settleLayout: mocks.settleLayout,
  createOnboardingDriver: mocks.createDriver,
}));

it("не запускает тур после ухода со страницы во время ожидания раскладки", async () => {
  let resolveLayout!: () => void;

  mocks.settleLayout.mockReturnValue(
    new Promise<void>((resolve) => {
      resolveLayout = resolve;
    })
  );

  const wrapper = shallowMount(OnboardingModal, {
    props: { open: true, userId: "owner" },
    global: { renderStubDefaultSlot: true, stubs: {
      BaseModal: { template: '<div><slot name="footer" /></div>' },
      "a-button": { template: "<button><slot /></button>" },
    } },
  });

  await wrapper.get(".onboarding-modal__start").trigger("click");
  expect(wrapper.emitted("update:open")).toEqual([[false]]);
  wrapper.unmount();
  resolveLayout();
  await flushPromises();
  expect(mocks.createDriver).not.toHaveBeenCalled();
  expect(mocks.markDone).not.toHaveBeenCalled();
});
