import { computed, onScopeDispose, reactive, ref, watch, type Ref } from "vue";
import api from "@/services/api";
import { useNotificationsStore } from "@/stores/notifications/notificationsStore";
import { friendlyRequestError } from "@/utils/friendlyError";
import type {
  NotificationEvent,
  NotificationPage,
  NotificationSection,
  NotificationSender,
  NotificationSummary,
  NotificationView,
} from "./center.types";

export function useNotificationCenter(userId: Ref<string | undefined>) {
  const section = ref<NotificationSection>("people");
  const view = reactive<Record<NotificationSection, NotificationView>>({
    people: "list",
    system: "list",
  });
  const senderPage = ref(1);
  const senderQuery = ref("");
  const senderSearch = ref("");
  const selected = ref<NotificationSender | null>(null);
  const mobileDetail = ref(false);
  const peoplePages = reactive<Record<string, number>>({});
  const systemPage = ref(1);
  const queries = reactive({ people: "", system: "" });
  const appliedSearch = reactive({ people: "", system: "" });
  const unreadOnly = reactive({ people: false, system: false });
  const kind = ref("");
  const category = ref("");
  const summary = reactive<NotificationSummary>({
    people: 0,
    system: 0,
    asOf: new Date().toISOString(),
  });
  const senders = reactive({
    items: [] as NotificationSender[],
    total: 0,
    loading: false,
    error: "",
  });
  const events = reactive({
    items: [] as NotificationEvent[],
    total: 0,
    loading: false,
    ready: false,
    error: "",
  });
  const saving = ref(false);
  const mutationError = ref("");
  const notifications = useNotificationsStore();
  let directoryRequest: AbortController | undefined;
  let eventRequest: AbortController | undefined;
  let summaryRequest: AbortController | undefined;
  let generation = 0;
  let eventContext = "";
  const eventPage = computed({
    get: () =>
      section.value === "system"
        ? systemPage.value
        : peoplePages[selected.value?.id ?? ""] ?? 1,
    set: (page: number) => {
      if (section.value === "system") systemPage.value = page;
      else if (selected.value) peoplePages[selected.value.id] = page;
    },
  });
  const query = computed({
    get: () => queries[section.value],
    set: (value: string) => {
      queries[section.value] = value;
    },
  });
  const busy = computed(
    () =>
      saving.value ||
      events.loading ||
      !!events.error ||
      query.value.trim() !== appliedSearch[section.value]
  );
  const sendersBusy = computed(
    () =>
      saving.value ||
      senders.loading ||
      !!senders.error ||
      senderQuery.value.trim() !== senderSearch.value
  );
  const endpoint = computed(() =>
    userId.value ? `/users/${userId.value}/notification-center` : ""
  );

  async function loadSenders(): Promise<void> {
    directoryRequest?.abort();
    if (!endpoint.value) return;

    const current = (directoryRequest = new AbortController());

    senders.loading = true;
    senders.error = "";
    try {
      const { data } = await api.get<NotificationPage<NotificationSender>>(
        endpoint.value + "/senders",
        {
          params: {
            limit: 6,
            offset: (senderPage.value - 1) * 6,
            q: senderSearch.value || undefined,
            through: summary.asOf,
          },
          signal: current.signal,
        }
      );

      if (current.signal.aborted) return;
      senders.items = data.items;
      senders.total = data.total;
      if (!selected.value && data.items[0]) selected.value = data.items[0];
      if (!selected.value && section.value === "people") events.ready = true;
      if (selected.value) {
        const fresh = data.items.find((item) => item.id === selected.value!.id);

        if (fresh) selected.value = fresh;
      }

      const last = Math.max(1, Math.ceil(data.total / 6));

      if (senderPage.value > last) senderPage.value = last;
    } catch (error) {
      if (!current.signal.aborted)
        senders.error = friendlyRequestError(error, {
          fallback: "Не удалось загрузить отправителей.",
        });
    } finally {
      if (!current.signal.aborted) senders.loading = false;
    }
  }

  async function loadEvents(): Promise<void> {
    eventRequest?.abort();
    if (!endpoint.value || (section.value === "people" && !selected.value)) {
      events.items = [];
      events.total = 0;
      events.loading = false;
      events.ready = false;

      return;
    }

    const current = (eventRequest = new AbortController());
    const source = section.value;
    const context =
      userId.value +
      ":" +
      source +
      ":" +
      (source === "people" ? selected.value!.id : "");

    if (context !== eventContext) {
      events.items = [];
      events.total = 0;
      eventContext = context;
      events.ready = false;
      events.error = "";
    }

    events.loading = true;
    try {
      const path =
        source === "system" ? "/system" : `/people/${selected.value!.id}`;
      const { data } = await api.get<NotificationPage<NotificationEvent>>(
        endpoint.value + path,
        {
          params: {
            limit: 10,
            offset: (eventPage.value - 1) * 10,
            q: appliedSearch[source] || undefined,
            unreadOnly: unreadOnly[source] || undefined,
            kind: source === "people" ? kind.value || undefined : undefined,
            category:
              source === "system" ? category.value || undefined : undefined,
            through: summary.asOf,
          },
          signal: current.signal,
        }
      );

      if (current.signal.aborted) return;
      events.error = "";
      events.items = data.items.map((item) => ({ ...item, source }));
      events.total = data.total;
      if (source === "people" && selected.value && data.unread !== undefined)
        selected.value.unread = data.unread;

      const last = Math.max(1, Math.ceil(data.total / 10));

      if (eventPage.value > last) eventPage.value = last;
    } catch (error) {
      if (!current.signal.aborted)
        events.error = friendlyRequestError(error, {
          fallback: "Не удалось загрузить события.",
        });
    } finally {
      if (!current.signal.aborted) {
        events.loading = false;
        events.ready = true;
      }
    }
  }

  async function refresh(): Promise<void> {
    summaryRequest?.abort();
    if (!endpoint.value) return;

    const current = (summaryRequest = new AbortController());

    try {
      const { data } = await api.get<NotificationSummary>(
        endpoint.value + "/summary",
        { signal: current.signal }
      );

      if (current.signal.aborted) return;
      Object.assign(summary, data);
      await Promise.all([loadSenders(), loadEvents()]);
    } catch (error) {
      if (!current.signal.aborted)
        events.error = friendlyRequestError(error, {
          fallback: "Не удалось обновить уведомления.",
        });
    }
  }

  function choose(sender: NotificationSender): void {
    selected.value = sender;
    mobileDetail.value = true;
  }

  async function mutate(action: () => Promise<unknown>): Promise<boolean> {
    if (saving.value) return false;

    const version = generation;

    saving.value = true;
    mutationError.value = "";
    try {
      await action();
      if (version !== generation) return false;
      await notifications.hydrate(userId.value!);
      await refresh();

      return true;
    } catch (error) {
      if (version === generation)
        mutationError.value = friendlyRequestError(error, {
          fallback: "Не удалось сохранить прочтение.",
        });

      return false;
    } finally {
      if (version === generation) saving.value = false;
    }
  }

  async function read(item: NotificationEvent): Promise<boolean> {
    if (item.readAt || !userId.value) return true;

    const path =
      item.source === "system"
        ? endpoint.value + `/system/${item.id}/read`
        : `/users/${userId.value}/notifications/${item.id}/read`;

    return mutate(() => api.patch(path));
  }

  async function readScope(person = false): Promise<boolean> {
    if (!endpoint.value) return false;

    return mutate(() =>
      api.post(endpoint.value + "/read", {
        scope:
          section.value === "system" ? "system" : person ? "person" : "people",
        ...(person && selected.value ? { actorId: selected.value.id } : {}),
        through: summary.asOf,
      })
    );
  }

  watch(
    userId,
    () => {
      generation++;
      directoryRequest?.abort();
      eventRequest?.abort();
      summaryRequest?.abort();
      senders.items = [];
      senders.total = 0;
      senders.error = "";
      senders.loading = false;
      events.items = [];
      events.total = 0;
      events.error = "";
      events.loading = false;
      events.ready = false;
      selected.value = null;
      mobileDetail.value = false;
      senderPage.value = 1;
      systemPage.value = 1;
      senderQuery.value = "";
      senderSearch.value = "";
      queries.people = "";
      queries.system = "";
      appliedSearch.people = "";
      appliedSearch.system = "";
      for (const id of Object.keys(peoplePages)) delete peoplePages[id];
      saving.value = false;
      mutationError.value = "";
      summary.people = 0;
      summary.system = 0;
      void refresh();
    },
    { immediate: true }
  );

  watch(senderQuery, (value, _, cleanup) => {
    const timer = setTimeout(() => {
      senderPage.value = 1;
      senderSearch.value = value.trim();
    }, 300);

    cleanup(() => clearTimeout(timer));
  });

  for (const source of ["people", "system"] as const) {
    watch(
      () => queries[source],
      (value, _, cleanup) => {
        const timer = setTimeout(() => {
          if (source === "system") systemPage.value = 1;
          else for (const id of Object.keys(peoplePages)) peoplePages[id] = 1;
          appliedSearch[source] = value.trim();
        }, 300);

        cleanup(() => clearTimeout(timer));
      }
    );
  }

  watch([senderPage, senderSearch], () => void loadSenders());
  watch(
    [
      section,
      () => selected.value?.id,
      eventPage,
      () => appliedSearch[section.value],
      kind,
      category,
      () => unreadOnly[section.value],
    ],
    () => void loadEvents()
  );

  watch([kind, category, () => unreadOnly[section.value]], () => {
    eventPage.value = 1;
  });

  watch(
    () => notifications.changeVersion,
    () => void refresh()
  );

  onScopeDispose(() => {
    directoryRequest?.abort();
    eventRequest?.abort();
    summaryRequest?.abort();
  });

  return {
    section,
    view,
    senderPage,
    senderQuery,
    selected,
    mobileDetail,
    eventPage,
    query,
    unreadOnly,
    kind,
    category,
    summary,
    senders,
    events,
    saving,
    mutationError,
    busy,
    sendersBusy,
    loadSenders,
    loadEvents,
    refresh,
    choose,
    read,
    readScope,
  };
}
