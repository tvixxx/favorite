import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from "vue-router";
import { useMainStore } from "@/state/state";
import {
  LEADERBOARD_HERO_MOVIES,
  LEADERBOARD_HERO_USERS,
} from "@/router/leaderboardHeroMeta";
import {
  LIBRARY_HERO_ACTORS,
  LIBRARY_HERO_CATALOG,
  LIBRARY_HERO_COLLECTION,
} from "@/router/libraryHeroMeta";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/",
    redirect: "/profile",
  },
  {
    path: "/login",
    name: "login",
    component: () => import("@/views/pages/LoginUser.vue"),
    meta: {
      guest: true,
    },
  },
  {
    path: "/create",
    name: "create",
    component: () => import("@/views/pages/CreateMovie.vue"),
    meta: {
      requiresAuth: true,
    },
  },
  {
    path: "/my-collection",
    redirect: { name: "library-collection" },
  },
  {
    path: "/list",
    redirect: "/library/collection",
  },
  {
    path: "/catalog",
    redirect: { name: "library-catalog" },
  },
  {
    path: "/library",
    name: "library",
    component: () => import("@/views/pages/LibraryLayout.vue"),
    meta: {
      requiresAuth: true,
    },
    redirect: "/library/collection",
    children: [
      {
        path: "collection",
        name: "library-collection",
        component: () => import("@/views/pages/MovieList.vue"),
        meta: {
          libraryHero: LIBRARY_HERO_COLLECTION,
        },
      },
      {
        path: "catalog",
        name: "library-catalog",
        component: () => import("@/views/pages/CatalogPage.vue"),
        meta: {
          libraryHero: LIBRARY_HERO_CATALOG,
        },
      },
      {
        path: "actors",
        name: "library-actors",
        component: () => import("@/views/pages/ActorsPage.vue"),
        meta: {
          libraryHero: LIBRARY_HERO_ACTORS,
        },
      },
      {
        path: "actors/:actorId",
        name: "library-actor",
        component: () => import("@/views/pages/CatalogPage.vue"),
        props: true,
      },
    ],
  },
  {
    path: "/detail/:id",
    name: "detail",
    component: () => import("@/views/pages/MovieDetail.vue"),
    meta: {
      requiresAuth: true,
    },
  },
  {
    path: "/favorites",
    name: "favorites",
    component: () => import("@/views/pages/FavoritesPage.vue"),
    meta: {
      requiresAuth: true,
    },
  },
  {
    path: "/leaderboard",
    name: "leaderboard",
    component: () => import("@/views/pages/LeaderboardLayout.vue"),
    meta: {
      requiresAuth: true,
    },
    redirect: { name: "leaderboard-users" },
    children: [
      {
        path: "users",
        name: "leaderboard-users",
        component: () => import("@/views/pages/LeaderboardUsersPage.vue"),
        meta: {
          leaderboardHero: LEADERBOARD_HERO_USERS,
        },
      },
      {
        path: "movies",
        name: "leaderboard-movies",
        component: () => import("@/views/pages/LeaderboardMoviesPage.vue"),
        meta: {
          leaderboardHero: LEADERBOARD_HERO_MOVIES,
        },
      },
    ],
  },
  {
    path: "/profile",
    name: "profile",
    component: () => import("@/views/pages/ProfilePage.vue"),
    meta: {
      requiresAuth: true,
    },
  },
  {
    path: "/friends",
    name: "friends",
    component: () => import("@/views/pages/FriendsPage.vue"),
    meta: {
      requiresAuth: true,
    },
  },
  {
    path: "/chat/:userId?",
    name: "chat",
    component: () => import("@/views/pages/ChatPage.vue"),
    meta: {
      requiresAuth: true,
    },
  },
  {
    path: "/:pathMatch(.*)*",
    name: "not-found",
    redirect: "/library/collection",
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    }
    if (to.hash) {
      return { el: to.hash, behavior: "smooth" };
    }
    return { top: 0, left: 0 };
  },
});

router.beforeEach(async (to, _, next) => {
  const store = useMainStore();

  if (!store.user.isAuthLoaded) {
    try {
      await store.fetchUser();
      //eslint-disable-next-line
    } catch {}
  }

  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth);
  const guestOnly = to.matched.some((record) => record.meta.guest);

  if (requiresAuth && !store.isLoggedIn) {
    next("/login");
    return;
  }

  if (guestOnly && store.isLoggedIn) {
    next("/profile");
    return;
  }

  next();
});

export default router;
