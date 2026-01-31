import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";
import MovieListPage from "@/views/pages/MovieList.vue";
import CreateMoviePage from "@/views/pages/CreateMovie.vue";
import LoginUser from "@/views/pages/LoginUser.vue";
import ProfilePage from "@/views/pages/ProfilePage.vue";
import MovieDetailPage from "@/views/pages/MovieDetail.vue";
import FavoritesPage from "@/views/pages/FavoritesPage.vue";
import { useMainStore } from "@/state/state";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/",
    redirect: "/profile",
    meta: {
      requiresAuth: true,
    },
  },
  {
    path: "/login",
    name: "login",
    component: LoginUser,
    meta: {
      guest: true,
    },
  },
  {
    path: "/create",
    name: "create",
    component: CreateMoviePage,
    meta: {
      requiresAuth: true,
    },
  },
  {
    path: "/list",
    name: "list",
    component: MovieListPage,
    meta: {
      requiresAuth: true,
    },
  },
  {
    path: "/detail/:id",
    name: "detail",
    component: MovieDetailPage,
    meta: {
      requiresAuth: true,
    },
  },
  {
    path: "/favorites",
    name: "favorites",
    component: FavoritesPage,
    meta: {
      requiresAuth: true,
    },
  },
  {
    path: "/profile",
    name: "profile",
    component: ProfilePage,
    meta: {
      requiresAuth: true,
    },
  },
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
});

// Новый вариант
router.beforeEach(async (to, _, next) => {
  const store = useMainStore();

  if (!store?.user?.isAuthLoaded) {
    await store.fetchUser();
  }

  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth);
  const guestOnly = to.matched.some((record) => record.meta.guest);

  if (requiresAuth && !store.isLoggedIn) {
    return next("/login");
  }
  if (guestOnly && store.isLoggedIn) {
    return next("/profile");
  }

  next();
});

export default router;
