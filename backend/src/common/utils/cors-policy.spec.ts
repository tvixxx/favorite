import { isAllowedOrigin, parseCorsOrigins } from './cors-policy';

describe('Разрешённые адреса фронтенда', () => {
  it('нормализует список HTTP(S) origin', () => {
    expect(
      parseCorsOrigins(' https://example.test/, https://app.example.test '),
    ).toEqual(['https://example.test', 'https://app.example.test']);
  });
  it('не разрешает посторонний сайт и wildcard', () => {
    expect(isAllowedOrigin('https://other.test', 'https://example.test')).toBe(
      false,
    );
    expect(() => parseCorsOrigins('*')).toThrow();
  });
  it('сохраняет поддержку локального запуска и клиентов без origin', () => {
    expect(isAllowedOrigin('http://localhost:8080')).toBe(true);
    expect(isAllowedOrigin(undefined)).toBe(true);
  });
});
