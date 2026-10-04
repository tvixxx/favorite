/** После нового запроса или сброса старый ответ не должен менять состояние. */
export function createRequestGuard() {
  let revision = 0;

  return {
    begin() {
      const current = ++revision;

      return () => current === revision;
    },
    invalidate() {
      revision++;
    },
  };
}
