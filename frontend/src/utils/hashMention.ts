/** Активное упоминание: от последнего `#` до каретки (без переноса строки). */
export function findHashMention(
  text: string,
  caret: number,
): { hashIndex: number; query: string } | null {
  if (caret <= 0) {
    return null;
  }

  let i = caret - 1;

  while (i >= 0) {
    const ch = text[i];

    if (ch === "\n") {
      return null;
    }

    if (ch === "#") {
      return { hashIndex: i, query: text.slice(i + 1, caret) };
    }

    i--;
  }

  return null;
}
