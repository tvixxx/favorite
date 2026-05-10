const STORAGE_KEY_PREFIX = "favorite-app-onboarding-done-v1-";

export function getOnboardingDone(userId: string): boolean {
  if (!userId?.trim()) {
    return true;
  }

  try {
    return localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`) === "1";
  } catch {
    return true;
  }
}

export function setOnboardingDone(userId: string): void {
  if (!userId?.trim()) {
    return;
  }

  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, "1");
  } catch {
    // ignore quota / private mode
  }
}
