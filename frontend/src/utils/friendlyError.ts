/**
 * Понятные пользователю тексты ошибок запросов вместо сырых axios-сообщений
 * («Request failed with status code 404»). Маппинг по HTTP-статусу + возможность
 * переопределить текст под конкретный сценарий (`byStatus`) и общий `fallback`.
 */

const STATUS_TEXT: Record<number, string> = {
  400: "Проверьте введённые данные и попробуйте снова.",
  401: "Нужно войти в аккаунт заново.",
  403: "Недостаточно прав для этого действия.",
  404: "Ничего не нашлось по запросу.",
  409: "Это действие уже выполнено.",
  422: "Проверьте введённые данные и попробуйте снова.",
  429: "Слишком много запросов подряд — подождите немного.",
  500: "Ошибка на сервере. Мы уже разбираемся — попробуйте позже.",
  502: "Сервер сейчас недоступен. Попробуйте позже.",
  503: "Сервис временно недоступен. Попробуйте позже.",
  504: "Сервер долго не отвечает. Попробуйте позже.",
};

const NETWORK_TEXT = "Нет соединения. Проверьте интернет и попробуйте снова.";
const DEFAULT_TEXT = "Что-то пошло не так. Попробуйте ещё раз.";

interface FriendlyErrorLike {
  response?: { status?: number };
  status?: number;
}

export function getRequestStatus(error: unknown): number | undefined {
  if (error && typeof error === "object") {
    const e = error as FriendlyErrorLike;

    return e.response?.status ?? e.status;
  }

  return undefined;
}

export interface FriendlyErrorOptions {
  /** Тексты под конкретные статусы (перекрывают общие) */
  byStatus?: Record<number, string>;
  /** Текст, если статус известен, но своего текста нет */
  fallback?: string;
}

export function friendlyRequestError(
  error: unknown,
  options: FriendlyErrorOptions = {},
): string {
  const status = getRequestStatus(error);

  // Нет статуса — ответа от сервера не было (обрыв сети / offline)
  if (status == null) {
    return NETWORK_TEXT;
  }

  return (
    options.byStatus?.[status] ??
    STATUS_TEXT[status] ??
    options.fallback ??
    DEFAULT_TEXT
  );
}
