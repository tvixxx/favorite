export const USER_PREFERENCES_DEFAULTS = {
  quickAddEnabled: true,
  watchTonightEnabled: false,
  collectionFilesEnabled: false,
  notifyNewMessages: true,
  notifyFriendRequests: true,
  notifyRecommendations: false,
};

export type UserPreferenceKey = keyof typeof USER_PREFERENCES_DEFAULTS;
export type UserPreferences = Record<UserPreferenceKey, boolean>;

export function getUserPreference(
  user: Partial<UserPreferences> | null | undefined,
  key: UserPreferenceKey
): boolean {
  return typeof user?.[key] === "boolean"
    ? user[key]
    : USER_PREFERENCES_DEFAULTS[key];
}

export function getUserPreferences(
  user: Partial<UserPreferences>
): UserPreferences {
  return {
    quickAddEnabled: getUserPreference(user, "quickAddEnabled"),
    watchTonightEnabled: getUserPreference(user, "watchTonightEnabled"),
    collectionFilesEnabled: getUserPreference(user, "collectionFilesEnabled"),
    notifyNewMessages: getUserPreference(user, "notifyNewMessages"),
    notifyFriendRequests: getUserPreference(user, "notifyFriendRequests"),
    notifyRecommendations: getUserPreference(user, "notifyRecommendations"),
  };
}
