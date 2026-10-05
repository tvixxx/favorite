export function parseCorsOrigins(raw?: string): string[] {
  const source = raw?.trim() || 'http://localhost:8080';

  return source.split(',').map((item) => {
    let url: URL;

    try {
      url = new URL(item.trim());
    } catch {
      throw new Error('CORS_ORIGINS должен содержать HTTP(S) origin');
    }

    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    ) {
      throw new Error('CORS_ORIGINS должен содержать HTTP(S) origin без пути');
    }

    return url.origin;
  });
}

export function isAllowedOrigin(origin?: string, raw?: string): boolean {
  return !origin || parseCorsOrigins(raw).includes(origin);
}
