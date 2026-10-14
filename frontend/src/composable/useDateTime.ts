import { computed } from "vue";
import { useMainStore } from "@/state/state";
import { calendarDateKey, formatDate, formatInstant } from "@/utils/date.utils";

export function useDateTime() {
  const store = useMainStore();
  const timezone = computed(() => store.userData?.timezone ?? "UTC");

  return {
    timezone,
    formatDate: (date: Date | string | null) =>
      formatDate(date, timezone.value),
    dateLabel: (date: Date | string | null) =>
      formatInstant(date, timezone.value, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    formatInstant: (
      date: Date | string | null,
      options?: Intl.DateTimeFormatOptions
    ) => formatInstant(date, timezone.value, options),
    dateKey: (date: Date | string | null) =>
      calendarDateKey(date, timezone.value),
  };
}
