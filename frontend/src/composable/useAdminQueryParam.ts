import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

export function useAdminQueryParam(
  key: string,
  fallback = "",
  pageKey?: string,
  allowed?: readonly string[]
) {
  const route = useRoute();
  const router = useRouter();

  return computed({
    get: (): string => {
      const value = route.query[key];

      return typeof value === "string" && (!allowed || allowed.includes(value))
        ? value
        : fallback;
    },
    set: (value: string | null): void => {
      const query = {
        ...route.query,
        [key]: value !== null && value !== fallback ? value : undefined,
      };

      if (pageKey) {
        query[pageKey] = undefined;
      }

      void router.replace({ query });
    },
  });
}
