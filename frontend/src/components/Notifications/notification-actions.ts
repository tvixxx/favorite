import type { NotificationAction } from "./center.types";

const uuid =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const route = new RegExp(
  "^/(?:notifications(?:\\?section=(?:people|system))?|friends(?:\\?tab=(?:friends|requests|subscribers|subscriptions))?|library(?:/(?:collection|catalog|actors|lists|diary))?|favorites|profile|leaderboard(?:/(?:users|movies))?|detail/" +
    uuid +
    "|chat(?:/" +
    uuid +
    ")?)?$"
);

export function safeNotificationActions(
  actions: unknown
): NotificationAction[] {
  if (!Array.isArray(actions)) return [];

  return actions
    .filter(
      (action): action is NotificationAction =>
        !!action &&
        typeof action.label === "string" &&
        action.label.length > 0 &&
        action.label.length <= 40 &&
        typeof action.path === "string" &&
        route.test(action.path)
    )
    .slice(0, 2);
}

export function requestAppUpdate(): void {
  window.dispatchEvent(new Event("fv:request-app-update"));
}
