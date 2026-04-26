import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { FETCH_METHOD, useFetch } from '@/composable';
import { isSuccessStatus } from '@/utils';

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

  const fetchUserBadges = async (userId: string) => {
    if (!userId?.trim()) {
      return;
    }

    isLoading.value = true;
    isError.value = null;

    try {
      const response = await useFetch<Badge[]>(
        `/users/${userId}/badges`,
        FETCH_METHOD.GET
      );

      if (isSuccessStatus(response.status)) {
        badges.value = response.data;
      } else {
        isError.value = 'Failed to load badges';
      }
    } catch (error) {
      isError.value = error.message || 'Failed to load badges';
    } finally {
      isLoading.value = false;
    }
  };

  const unlockedBadges = computed(() =>
    badges.value.filter(b => b.isUnlocked)
  );

  const lockedBadges = computed(() =>
    badges.value.filter(b => !b.isUnlocked)
  );

  return {
    badges,
    isLoading,
    isError,
    unlockedBadges,
    lockedBadges,
    fetchUserBadges,
  };
});
