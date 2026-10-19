import { defineComponent } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { describe, expect, it } from "vitest";
import { useAdminQueryParam } from "./useAdminQueryParam";

describe("Фильтры админки в адресной строке", () => {
  it("сохраняет пустое значение, если по умолчанию выбран непустой фильтр", async () => {
    const component = defineComponent({
      setup() {
        return { scope: useAdminQueryParam("scope", "reported") };
      },
      template: '<input v-model="scope" />',
    });
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/admin", component }],
    });

    await router.push("/admin");

    const wrapper = mount(component, { global: { plugins: [router] } });

    await wrapper.get("input").setValue("");
    await flushPromises();
    expect(router.currentRoute.value.query.scope).toBe("");
    expect(wrapper.get("input").element.value).toBe("");
    wrapper.unmount();
  });

  it("восстанавливает фильтр, сохраняет соседние параметры и сбрасывает его страницу", async () => {
    const component = defineComponent({
      setup() {
        return {
          role: useAdminQueryParam("users_role", "", "users_page", [
            "",
            "USER",
            "ADMIN",
          ]),
        };
      },
      template: '<input v-model="role" aria-label="Роль" />',
    });
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/admin", component }],
    });

    await router.push("/admin?users_role=USER&users_page=3&movies_kind=serial");

    const wrapper = mount(component, { global: { plugins: [router] } });

    expect(wrapper.get("input").element.value).toBe("USER");
    await wrapper.get("input").setValue("ADMIN");
    await flushPromises();
    expect(router.currentRoute.value.query).toMatchObject({
      users_role: "ADMIN",
      movies_kind: "serial",
    });

    expect(router.currentRoute.value.query.users_page).toBeUndefined();
    await router.push("/admin?users_role=USER");
    await flushPromises();
    expect(wrapper.get("input").element.value).toBe("USER");
    wrapper.unmount();
  });
});
