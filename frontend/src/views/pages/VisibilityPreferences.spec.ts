import { flushPromises, shallowMount } from "@vue/test-utils";
import { nextTick, reactive, ref } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "./ProfilePage.vue";
import LibraryLayout from "./LibraryLayout.vue";
import NavigationLinks from "@/components/NavigationLinks/NavigationLinks.vue";
import { setTheme } from "@/composable";
import type { Badge } from "@/stores/badges";
import type { UserMoviesAnalyticsContinueWatchingItem } from "@/stores/movies/types/movies.types";

const mocks = vi.hoisted(() => ({
  main: null as unknown as ReturnType<typeof makeMain>,
  movies: null as unknown as ReturnType<typeof makeMovies>,
  badges: null as unknown as ReturnType<typeof makeBadges>,
}));

vi.mock("@/state/state", () => ({ useMainStore: () => mocks.main }));
vi.mock("@/composable", () => ({
  currentTheme: ref("light"),
  setTheme: vi.fn(),
  themes: ["light", "dark"],
}));

vi.mock("@/services/api", () => ({
  default: { get: vi.fn().mockResolvedValue({ data: { feedback: false } }) },
}));

vi.mock("@/stores", () => ({
  useUserMoviesStore: () => mocks.movies,
  useBadgesStore: () => mocks.badges,
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
    isAnalyticsLoading: false,
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
      continueWatching: [] as UserMoviesAnalyticsContinueWatchingItem[],
      statusBreakdown: { dropped: 0 },
      watchingSerialsCount: 0,
      seeLaterCount: 0,
    },
    fetchUserMoviesStats: vi.fn().mockResolvedValue(undefined),
    fetchUserMoviesAnalytics: vi.fn().mockResolvedValue(undefined),
  });
}

function makeBadges() {
  return reactive({
    fetchUserBadges: vi.fn().mockResolvedValue(undefined),
    unlockedBadges: [] as Badge[],
    lockedBadges: [] as Badge[],
  });
}

function badge(index: number, isUnlocked = true): Badge {
  return {
    id: String(index),
    title: `Достижение ${index}`,
    description: `Условие ${index}`,
    icon: "trophy",
    category: "movies",
    tier: "bronze",
    isUnlocked,
    requirement: 5,
    currentValue: isUnlocked ? 5 : 2,
  };
}

const mounted: Array<ReturnType<typeof shallowMount>> = [];

afterEach(() => mounted.splice(0).forEach((wrapper) => wrapper.unmount()));

async function setup(
  component: typeof ProfilePage | typeof LibraryLayout | typeof NavigationLinks
) {
  mocks.main = makeMain();
  mocks.movies = makeMovies();
  mocks.badges = makeBadges();

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/profile", component: { template: "<div/>" } },
      { path: "/detail/:id", component: { template: "<div/>" } },
      { path: "/library/collection", component: { template: "<div/>" } },
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
        ATooltip: true,
        BaseModal: {
          props: ["modelValue"],
          template:
            '<section v-if="modelValue" role="dialog"><slot name="title"/><slot name="body"/></section>',
        },
        ProfileSettings: false,
        ProfileWatching: false,
        ProfileAchievements: false,
        BadgesList: false,
        BadgeItem: false,
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

function getAction(wrapper: Awaited<ReturnType<typeof setup>>, label: string) {
  const action = wrapper
    .findAll("button, a-button-stub")
    .find(
      (button) => (button.attributes("aria-label") ?? button.text()) === label
    );

  if (!action) throw new Error(`Не найдена кнопка «${label}»`);

  return action;
}

describe("Видимость разделов по настройкам аккаунта", () => {
  it("показывает каркас просмотра при первой загрузке и сохраняет карточку при обновлении", async () => {
    const wrapper = await setup(ProfilePage);
    const analytics = mocks.movies.analytics;

    vi.useFakeTimers();
    try {
      Object.assign(mocks.movies, {
        analytics: null,
        isAnalyticsLoading: true,
      });

      await nextTick();
      expect(wrapper.get(".profile-watching").attributes("aria-busy")).toBe(
        "true"
      );

      expect(wrapper.find(".profile-watching__action").exists()).toBe(false);

      analytics.continueWatching = [
        {
          movieId: "serial",
          title: "Мой сериал",
          currentSeason: 1,
          currentEpisode: 2,
          seasonCount: 1,
          episodeCount: 8,
        },
      ];

      Object.assign(mocks.movies, { analytics, isAnalyticsLoading: false });
      await nextTick();
      await vi.advanceTimersByTimeAsync(400);
      expect(
        wrapper.get(".profile-watching").attributes("aria-busy")
      ).toBeUndefined();

      expect(wrapper.get(".profile-watching__action").text()).toBe(
        "Открыть карточку"
      );

      mocks.movies.isAnalyticsLoading = true;
      await nextTick();
      expect(wrapper.find(".profile-watching__action").exists()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

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

  it("открывает отдельную модалку цветовой темы из шапки профиля", async () => {
    const wrapper = await setup(ProfilePage);

    vi.mocked(setTheme).mockClear();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    await getAction(wrapper, "Цветовая тема").trigger("click");

    const dialog = wrapper.get('[role="dialog"]');

    expect(dialog.text()).toContain("Цветовая тема");
    expect(dialog.text()).toContain("Светлая");
    expect(dialog.find('[aria-label="Уникальный ник"]').exists()).toBe(false);
    await getAction(wrapper, "Тёмная").trigger("click");
    expect(setTheme).toHaveBeenCalledWith("dark");
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(mocks.main.updateProfile).not.toHaveBeenCalled();
  });

  it("открывает карточку текущего просмотра и учитывает настройку аналитики", async () => {
    const wrapper = await setup(ProfilePage);

    expect(wrapper.text()).toContain("Нет сериалов в процессе");
    expect(wrapper.text()).not.toContain("Открыть карточку");

    mocks.movies.analytics.continueWatching = [
      {
        movieId: "current-movie",
        title: "Дом у озера",
        currentSeason: 1,
        currentEpisode: 2,
        seasonCount: 2,
        episodeCount: 8,
      },
    ];

    await nextTick();

    expect(wrapper.text()).toContain("Дом у озера");
    await getAction(wrapper, "Открыть карточку").trigger("click");
    await flushPromises();
    expect(wrapper.vm.$router.currentRoute.value.path).toBe(
      "/detail/current-movie"
    );

    mocks.main.userData.showDetailedAnalytics = false;
    await nextTick();
    expect(wrapper.text()).not.toContain("Дом у озера");
    expect(wrapper.text()).not.toContain("Открыть карточку");
  });

  it.each([
    ["Сериалы в процессе (1)", { watchStatus: "WATCHING", isSerial: "true" }],
    ["Брошено (2)", { watchStatus: "DROPPED" }],
    ["Досмотреть позже (3)", { seeLater: "true" }],
  ])("передаёт фильтры коллекции из действия «%s»", async (label, query) => {
    const wrapper = await setup(ProfilePage);

    mocks.movies.analytics.watchingSerialsCount = 1;
    mocks.movies.analytics.statusBreakdown.dropped = 2;
    mocks.movies.analytics.seeLaterCount = 3;
    await nextTick();

    await getAction(wrapper, label).trigger("click");
    await flushPromises();

    expect(wrapper.vm.$router.currentRoute.value.path).toBe(
      "/library/collection"
    );

    expect(wrapper.vm.$router.currentRoute.value.query).toEqual(query);
  });

  it("показывает по три достижения и сбрасывает страницу при смене фильтра", async () => {
    const wrapper = await setup(ProfilePage);

    mocks.badges.unlockedBadges = Array.from({ length: 8 }, (_, i) =>
      badge(i + 1)
    );

    mocks.badges.lockedBadges = [badge(9, false), badge(10, false)];
    await nextTick();

    const cards = () =>
      wrapper
        .findAll(".badges-card .badge-item__title")
        .map((item) => item.text());

    expect(cards()).toEqual(["Достижение 1", "Достижение 2", "Достижение 3"]);
    await getAction(wrapper, "Следующая страница достижений").trigger("click");
    expect(cards()).toEqual(["Достижение 4", "Достижение 5", "Достижение 6"]);
    await getAction(wrapper, "Закрытые").trigger("click");
    expect(cards()).toEqual(["Достижение 9", "Достижение 10"]);
    await getAction(wrapper, "Открытые").trigger("click");
    expect(cards()).toEqual(["Достижение 1", "Достижение 2", "Достижение 3"]);

    await getAction(wrapper, "Следующая страница достижений").trigger("click");
    mocks.badges.unlockedBadges = [badge(1), badge(2)];
    await nextTick();

    expect(cards()).toEqual(["Достижение 1", "Достижение 2"]);
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
