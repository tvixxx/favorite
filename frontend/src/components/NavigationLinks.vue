<script setup lang="ts">
import { computed } from "vue";
import { useMainStore } from "@/state/state";
import { useRoute, useRouter } from "vue-router";

const router = useRouter();
const route = useRoute();
const store = useMainStore();

const isLoggedIn = computed<boolean>(() => store.isLoggedIn ?? false);
const selectedKeys = computed(() => {
  const path = route.path;
  if (path.startsWith("/profile")) {
    return ["profile"];
  }

  if (path.startsWith("/create")) {
    return ["create"];
  }

  if (path.startsWith("/list")) {
    return ["list"];
  }

  if (path.startsWith("/favorites")) {
    return ["favorites"];
  }

  return [];
});

const signOut = async (): Promise<void> => {
  await store.logOut();
  router.push("/login");
};
</script>

<template>
  <a-layout-header class="navigation">
    <a-menu
      v-if="isLoggedIn"
      theme="dark"
      mode="horizontal"
      :selected-keys="selectedKeys"
      :style="{ lineHeight: '64px' }"
    >
      <a-menu-item key="profile" @click="router.push('/profile')">
        Профиль
      </a-menu-item>

      <a-menu-item key="create" @click="router.push('/create')">
        Добавить
      </a-menu-item>

      <a-menu-item key="list" @click="router.push('/list')">
        Список
      </a-menu-item>

      <a-menu-item key="favorites" @click="router.push('/favorites')">
        Избранное
      </a-menu-item>

      <a-menu-item class="navigation__sign-out" key="signout">
        <a-button type="primary" @click.prevent="signOut" aria-label="Sign out">
          Выход
        </a-button>
      </a-menu-item>
    </a-menu>

    <a-menu
      v-else
      theme="dark"
      mode="horizontal"
      :selected-keys="selectedKeys"
      :style="{ lineHeight: '64px' }"
    >
      <a-menu-item key="login" @click="router.push('/login')">
        Login
      </a-menu-item>
    </a-menu>
  </a-layout-header>
</template>

<style lang="scss">
.navigation {
  box-sizing: border-box;
  width: 100%;

  .ant-menu-overflow-item.ant-menu-item {
    border-radius: 0;
  }

  &__sign-out {
    margin-left: auto !important;
  }
}
</style>
