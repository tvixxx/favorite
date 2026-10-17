import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchUserCollectionSuggestions, findUserMovieByQuotedTitle } from './useFetchUserCollectionSuggestions';
import { type UserMovieApiResponse, WatchStatus } from '@/stores/movies/types/movies.types';
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/composable', () => ({ useFetch: mocks.fetch, FETCH_METHOD: { get: 'GET' } }));

describe('Подсказки личной коллекции', () => {
  beforeEach(() => mocks.fetch.mockReset());
  it('не связывает цитату со случайным одноимённым произведением', async () => {
    mocks.fetch.mockResolvedValue({ status: 200, data: { items: ['one', 'two'].map(id => ({ id, movieId: id, movie: { id, title: 'Маяк', isSerial: false } })), total: 2 } });
    expect(await findUserMovieByQuotedTitle('owner', 'Маяк')).toBeNull();
  });
  it('запрашивает только ограниченную серверную страницу', async () => {
    mocks.fetch.mockResolvedValue({ status: 200, data: { items: [], total: 10000 } });
    expect(await fetchUserCollectionSuggestions('owner', '  Фильм ', 50)).toEqual([]);
    const url = new URL(mocks.fetch.mock.calls[0][0], 'http://example.test');
    expect(url.pathname).toBe('/users/owner/movies/page');
    expect(Object.fromEntries(url.searchParams)).toEqual({ q: 'Фильм', limit: '25', offset: '0' });
  });
  it('не запрашивает список без владельца или текста', async () => {
    expect(await fetchUserCollectionSuggestions('', 'Фильм')).toEqual([]);
    expect(await fetchUserCollectionSuggestions('owner', ' ')).toEqual([]);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('не пытается отобразить некорректную страницу', async () => {
    mocks.fetch.mockResolvedValue({ status: 200, data: { items: null } });
    expect(await fetchUserCollectionSuggestions('owner', 'Фильм')).toEqual([]);
  });
  it('возвращает найденный тайтл с личным прогрессом и постером для показа подсказки', async () => {
    const item: UserMovieApiResponse = {
      id: 'collection-item', userId: 'owner', movieId: 'movie-id',
      isFavorite: true, seeLater: false, personalRate: 8,
      watchStatus: WatchStatus.WATCHING, currentSeason: 2, currentEpisode: 3,
      addedAt: '2026-10-01T12:00:00Z', startedAt: '2026-10-02T12:00:00Z',
      completedAt: null, droppedAt: null, lastWatchedAt: null,
      createdAt: '2026-10-01T12:00:00Z', updatedAt: '2026-10-02T12:00:00Z',
      movie: {
        id: 'movie-id', title: 'Найденный сериал', description: 'Описание',
        isSerial: true, seasonCount: 3, episodeCount: 10,
        countryCodes: ['JP'], genres: [], publishDate: '2025-01-01',
        posterId: 'poster-id', poster: { url: 'https://images.example.test/poster.webp' },
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      },
    };
    mocks.fetch.mockResolvedValue({ status: 200, data: { items: [item], total: 1 } });

    expect(await fetchUserCollectionSuggestions('owner', 'Найденный')).toMatchObject([{
      id: 'collection-item', movieId: 'movie-id', isFavorite: true,
      personalRate: 8, watchStatus: WatchStatus.WATCHING,
      currentSeason: 2, currentEpisode: 3,
      movie: {
        title: 'Найденный сериал', isSerial: true,
        imageUrl: 'https://images.example.test/poster.webp', countryCodes: ['JP'],
      },
    }]);
  });
});
