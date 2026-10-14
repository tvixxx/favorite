import dayjs, { type Dayjs } from "dayjs";
/** Дата выхода — календарная дата, границы API всегда представлены в UTC. */
export function releaseMonthBound(value: Dayjs, side: "from" | "to"): string {
  const day = (
    side === "from" ? value.startOf("month") : value.endOf("month")
  ).format("YYYY-MM-DD");

  return day + (side === "from" ? "T00:00:00.000Z" : "T23:59:59.999Z");
}

export function releaseDateInput(value: string): Dayjs {
  return dayjs(value.slice(0, 10));
}
