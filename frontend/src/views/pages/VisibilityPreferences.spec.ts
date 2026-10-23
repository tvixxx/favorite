import { flushPromises, shallowMount } from "@vue/test-utils";
import { nextTick, reactive, ref } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "./ProfilePage.vue";
import LibraryLayout from "./LibraryLayout.vue";
import NavigationLinks from "@/components/NavigationLinks/NavigationLinks.vue";

const mocks = vi.hoisted(() => ({
  main: null as unknown as ReturnType<typeof makeMain>,
  movies: null as unknown as ReturnType<typeof makeMovies>,
}));

vi.mock("@/state/state", () => ({ useMainStore: () => mocks.main }));
vi.mock("@/composable", () => ({
  currentTheme: ref("light"),
  setTheme: vi.fn(),
  themes: ["light"],
}));

vi.mock("@/services/api", () => ({
  default: { get: vi.fn().mockResolvedValue({ data: { feedback: false } }) },
}));

vi.mock("@/stores", () => ({
  useUserMoviesStore: () => mocks.movies,
  useBadgesStore: () => ({
    fetchUserBadges: vi.fn().mockResolvedValue(undefined),
    unlockedBadges: [],
    lockedBadges: [],
  }),
  useActorsStore: () => ({ clearDetailActor: vi.fn(), detailActor: null }),
  useFriendsStore: () => ({
    fetchStats: vi.fn().mockResolvedValue(undefined),
    stats: { friendsCount: 0, subscribersCount: 0, subscriptionsCount: 0 },
  }),
}));

vi.mock("@/stores/notifications/notificationsStore", () => ({
  useNotificationsStore: () => ({ items: [], unreadCount: 0 }),
}));

vi.mock("@/stores/chat/chatStore", () => ({
  useChatStore: () => ({ totalUnreadCount: 0 }),
}));

function makeMain() {
  return reactive({
    isLoggedIn: true,
    updateProfile: vi.fn(),
    userData: {
      id: "owner",
      fullName: "Владелец",
      showAchievements: true,
      showDetailedAnalytics: true,
      showCommunityTops: true,
      showActorsSection: true,
    },
  });
}

function makeMovies() {
  return reactive({
    totalCount: 0,
    stats: {
      totalMovies: 48,
      totalSerials: 14,
      totalCompleted: 32,
      totalWatching: 4,
      totalSeeLater: 12,
    },
    analytics: {
      addedLast7Days: 3,
      addedLast30Days: 12,
      totalMovies: 34,
      totalSerials: 14,
      completionRate: 67,
      topGenres: [],
      continueWatching: [],
      statusBreakdown: { dropped: 0 },
      watchingSerialsCount: 0,
      seeLaterCount: 0,
    },
    fetchUserMoviesStats: vi.fn().mockResolvedValue(undefined),
    fetchUserMoviesAnalytics: vi.fn().mockResolvedValue(undefined),
  });
}

const mounted: Array<ReturnType<typeof shallowMount>> = [];

afterEach(() => mounted.splice(0).forEach((wrapper) => wrapper.unmount()));

async function setup(
  component: typeof ProfilePage | typeof LibraryLayout | typeof NavigationLinks
) {
  mocks.main = makeMain();
  mocks.movies = makeMovies();

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/profile", component: { template: "<div/>" } },
      {
        path: "/profile/settings",
        name: "profile-settings",
        component: { template: "<div/>" },
      },
    ],
  });

  await router.push("/profile");

  const wrapper = shallowMount(component, {
    global: {
      plugins: [router],
      renderStubDefaultSlot: true,
      stubs: {
        AButton: true,
        AInput: true,
        AAvatar: true,
        BaseModal: {
          props: ["modelValue"],
          template: '<section v-if="modelValue"><slot name="body"/></section>',
        },
        ProfileSettings: false,
        SettingBlock: false,
        StatsBlock: false,
        ADrawer: { template: "<div><slot/></div>" },
        ADropdown: { template: "<div><slot/><slot name='overlay'/></div>" },
      },
    },
  });

  mounted.push(wrapper);
  await flushPromises();

  return wrapper;
}

describe("Видимость разделов по настройкам аккаунта", () => {
  it("оставляет в модалке данные профиля и переводит к дополнительным настройкам без сохранения формы", async () => {
    const wrapper = await setup(ProfilePage);

    await wrapper.get('[data-tour="profile-settings"]').trigger("click");
    expect(wrapper.find("personal-settings-stub").exists()).toBe(false);
    expect(wrapper.find('[aria-label="Уникальный ник"]').exists()).toBe(true);
    await wrapper.get(".settings-modal__additional").trigger("click");
    await flushPromises();
    expect(wrapper.vm.$router.currentRoute.value.path).toBe(
      "/profile/settings"
    );

    expect(mocks.main.updateProfile).not.toHaveBeenCalled();
  });

  it("скрывает достижения и подробную аналитику, сохраняя реальные основные счётчики", async () => {
    const wrapper = await setup(ProfilePage);

    expect(wrapper.find(".badges-card").exists()).toBe(true);
    expect(wrapper.find(".analytics-card").exists()).toBe(true);
    mocks.main.userData.showAchievements = false;
    mocks.main.userData.showDetailedAnalytics = false;
    await nextTick();
    expect(wrapper.find(".badges-card").exists()).toBe(false);
    expect(wrapper.find(".analytics-card").exists()).toBe(false);
    expect(wrapper.get(".stats").text()).toContain("48");
    expect(wrapper.get(".stats").text()).toContain("32");
    mocks.main.userData.showAchievements = true;
    mocks.main.userData.showDetailedAnalytics = true;
    await nextTick();
    expect(wrapper.find(".badges-card").exists()).toBe(true);
    expect(wrapper.find(".analytics-card").exists()).toBe(true);
  });

  it("убирает Топ из обоих меню и возвращает после включения", async () => {
    const wrapper = await setup(NavigationLinks);
    const topButtons = () =>
      wrapper
        .findAll(".topbar__nav-link, .drawer-nav__link")
        .filter((button) => button.text() === "Топ");

    expect(topButtons()).toHaveLength(2);
    mocks.main.userData.showCommunityTops = false;
    await nextTick();
    expect(topButtons()).toHaveLength(0);
    expect(wrapper.text()).toContain("Медиатека");
    mocks.main.userData.showCommunityTops = true;
    await nextTick();
    expect(topButtons()).toHaveLength(2);
  });

  it("скрывает только отдельную вкладку актёров, сохраняя остальные разделы медиатеки", async () => {
    const wrapper = await setup(LibraryLayout);

    expect(wrapper.text()).toContain("Актёры");
    mocks.main.userData.showActorsSection = false;
    await nextTick();
    expect(wrapper.text()).not.toContain("Актёры");
    for (const title of ["Моя коллекция", "Каталог", "Мои списки", "Дневник"])
      expect(wrapper.text()).toContain(title);
    mocks.main.userData.showActorsSection = true;
    await nextTick();
    expect(wrapper.text()).toContain("Актёры");
  });
});
