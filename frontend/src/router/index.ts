import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";
import { useMainStore } from "@/state/state";

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
    path: "/list",
    name: "list",
    component: () => import("@/views/pages/MovieList.vue"),
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
    path: "/profile",
    name: "profile",
    component: () => import("@/views/pages/ProfilePage.vue"),
    meta: {
      requiresAuth: true,
    },
  },
  {
    path: "/:pathMatch(.*)*",
    name: "not-found",
    redirect: "/list",
  },
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
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
