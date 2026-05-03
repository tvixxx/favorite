import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";
import { useMainStore } from "@/state/state";
import {
  LEADERBOARD_HERO_MOVIES,
  LEADERBOARD_HERO_USERS,
} from "@/router/leaderboardHeroMeta";

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
    name: "my-collection",
    component: () => import("@/views/pages/MovieList.vue"),
    meta: {
      requiresAuth: true,
    },
  },
  {
    path: "/list",
    redirect: "/my-collection",
  },
  {
    path: "/catalog",
    name: "catalog",
    component: () => import("@/views/pages/CatalogPage.vue"),
    meta: {
      requiresAuth: true,
    },
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
    redirect: "/my-collection",
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
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
