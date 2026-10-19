export const parseListLabels = (raw: string): string[] => {
  const unique = new Set<string>();

  for (const chunk of raw.split(",")) {
    const normalized = chunk.trim();

    if (normalized) {
      unique.add(normalized);
    }
  }

  return Array.from(unique);
};
