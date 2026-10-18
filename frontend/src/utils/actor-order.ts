const collator = new Intl.Collator("ru", {
  sensitivity: "base",
  numeric: true,
});

export function compareActorNames(
  left: { name: string; id: string },
  right: { name: string; id: string }
): number {
  const group = (name: string): number =>
    /[А-Яа-яЁё]/.test(name.match(/\p{L}/u)?.[0] ?? "") ? 0 : 1;

  return (
    group(left.name) - group(right.name) ||
    collator.compare(left.name, right.name) ||
    left.id.localeCompare(right.id)
  );
}
