import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { FETCH_METHOD, useFetch } from '@/composable';
import { isSuccessStatus } from '@/utils';
import { createRequestGuard } from '@/utils/requestGuard';

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'movies' | 'favorites' | 'completed' | 'serials' | 'ratings' | 'time';
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  isUnlocked: boolean;
  progress?: number;
  requirement: number;
  currentValue: number;
}

export const useBadgesStore = defineStore('badges', () => {
  const badges = ref<Badge[]>([]);
  const isLoading = ref(false);
  const isError = ref<string | null>(null);
  const requests = createRequestGuard();

  const fetchUserBadges = async (userId: string) => {
    if (!userId?.trim()) {
      return;
    }

    const isCurrent = requests.begin();
    isLoading.value = true;
    isError.value = null;

    try {
      const response = await useFetch<Badge[]>(
        `/users/${userId}/badges`,
        { method: FETCH_METHOD.get }
      );
      if (!isCurrent()) return;

      if (isSuccessStatus(response.status)) {
        badges.value = response.data;
      } else {
        isError.value = 'Failed to load badges';
      }
    } catch (error) {
      if (!isCurrent()) return;
      isError.value = error instanceof Error ? error.message : 'Failed to load badges';
    } finally {
      if (isCurrent()) isLoading.value = false;
    }
  };

  const unlockedBadges = computed(() =>
    badges.value.filter(b => b.isUnlocked)
  );

  const lockedBadges = computed(() =>
    badges.value.filter(b => !b.isUnlocked)
  );
  const resetSession = () => {
    requests.invalidate();
    badges.value = [];
    isLoading.value = false;
    isError.value = null;
  };

  return {
    badges,
    isLoading,
    isError,
    unlockedBadges,
    lockedBadges,
    fetchUserBadges,
    resetSession,
  };
});
