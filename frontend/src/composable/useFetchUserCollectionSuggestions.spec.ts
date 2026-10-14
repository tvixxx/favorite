import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchUserCollectionSuggestions } from './useFetchUserCollectionSuggestions';
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/composable', () => ({ useFetch: mocks.fetch, FETCH_METHOD: { get: 'GET' } }));

describe('Подсказки личной коллекции', () => {
  beforeEach(() => mocks.fetch.mockReset());
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
});
