import { onBeforeUnmount, ref, watch, type Ref } from "vue";

export function useDebouncedSearch(
  source: () => string,
  search: (query: string) => void | Promise<void>
): {
  searchValue: Ref<string>;
  onSearchInput: () => void;
  onSearchEnter: () => void;
} {
  const searchValue = ref(source());
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = (): void => clearTimeout(timer);
  const onSearchEnter = (): void => {
    cancel();
    void Promise.resolve(search(searchValue.value.trim())).catch(() => {});
  };
  const onSearchInput = (): void => {
    cancel();
    timer = setTimeout(onSearchEnter, 350);
  };

  watch(source, (query) => {
    cancel();
    searchValue.value = query;
  });

  onBeforeUnmount(cancel);

  return { searchValue, onSearchInput, onSearchEnter };
}
