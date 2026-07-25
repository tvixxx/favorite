/**
 * Стабильный градиент аватара по id пользователя + буква из имени.
 * Один и тот же пользователь получает один и тот же цвет в чате и в друзьях.
 */
const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #f0729a, #b81b5a)",
  "linear-gradient(135deg, #3a6ff0, #1b2a6b)",
  "linear-gradient(135deg, #8b5cf6, #4c1d95)",
  "linear-gradient(135deg, #38b48a, #176e50)",
  "linear-gradient(135deg, #f5a623, #b9770a)",
  "linear-gradient(135deg, #f95721, #b23a0e)",
];

export function avatarGradient(id: string): string {
  let hash = 0;

  for (let i = 0; i < id.length; i += 1) {
    hash = (hash + id.charCodeAt(i)) % AVATAR_GRADIENTS.length;
  }

  return AVATAR_GRADIENTS[hash];
}

export function avatarLetter(name?: string): string {
  return (name?.trim()[0] ?? "?").toUpperCase();
}
