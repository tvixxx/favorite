<script setup lang="ts">
import { computed } from "vue";
import { useMainStore } from "@/state/state";
import { useRouter } from "vue-router";

const router = useRouter();
const store = useMainStore();

const isLoggedIn = computed<boolean>(() => store.isLoggedIn ?? false);

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
      :style="{ lineHeight: '64px' }"
    >
      <router-link exact-active-class="ant-menu-item-selected" to="/profile">
        <a-menu-item key="profile"> Профиль </a-menu-item>
      </router-link>

      <router-link exact-active-class="ant-menu-item-selected" to="/create">
        <a-menu-item key="create"> Добавить </a-menu-item>
      </router-link>

      <router-link exact-active-class="ant-menu-item-selected" to="/list">
        <a-menu-item key="list"> Список </a-menu-item>
      </router-link>

      <router-link exact-active-class="ant-menu-item-selected" to="/favorites">
        <a-menu-item key="favorites"> Избранное </a-menu-item>
      </router-link>

      <a-menu-item class="navigation__sign-out" key="signout">
        <a-button type="primary" @click.prevent="signOut" aria-label="Sign out"
          >Выход</a-button
        >
      </a-menu-item>
    </a-menu>

    <a-menu
      v-else
      theme="dark"
      mode="horizontal"
      :style="{ lineHeight: '64px' }"
    >
      <router-link exact-active-class="ant-menu-item-selected" to="/login">
        <a-menu-item key="login"> Login </a-menu-item>
      </router-link>
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
