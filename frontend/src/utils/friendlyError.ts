/**
 * Понятные пользователю тексты ошибок запросов вместо сырых axios-сообщений
 * («Request failed with status code 404»). Маппинг по HTTP-статусу + возможность
 * переопределить текст под конкретный сценарий (`byStatus`) и общий `fallback`.
 */

import { isAxiosError } from "axios";

const STATUS_TEXT: Record<number, string> = {
  400: "Проверьте введённые данные и попробуйте снова.",
  401: "Нужно войти в аккаунт заново.",
  403: "Недостаточно прав для этого действия.",
  404: "Ничего не нашлось по запросу.",
  409: "Это действие уже выполнено.",
  422: "Проверьте введённые данные и попробуйте снова.",
  429: "Слишком много запросов подряд — подождите немного.",
  500: "На сервере произошла ошибка. Попробуйте позже.",
  502: "Сервер сейчас недоступен. Попробуйте позже.",
  503: "Сервис временно недоступен. Попробуйте позже.",
  504: "Сервер долго не отвечает. Попробуйте позже.",
};

const NETWORK_TEXT = "Нет соединения. Проверьте интернет и попробуйте снова.";
const DEFAULT_TEXT = "Что-то пошло не так. Попробуйте ещё раз.";

interface FriendlyErrorLike {
  response?: { status?: number };
  status?: number;
  cause?: unknown;
}

function errorChain(error: unknown): FriendlyErrorLike[] {
  const chain: FriendlyErrorLike[] = [];
  const seen = new Set<object>();
  while (error && typeof error === "object" && !seen.has(error)) {
    seen.add(error);
    const current = error as FriendlyErrorLike;
    chain.push(current);
    error = current.cause;
  }

  return chain;
}

export function getRequestStatus(error: unknown): number | undefined {
  for (const current of errorChain(error)) {
    const status = current.response?.status ?? current.status;
    if (typeof status === "number") return status;
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

  if (status == null) {
    const networkFailure = errorChain(error).some((current) => isAxiosError(current) && !current.response && current.code !== "ERR_CANCELED");

    return networkFailure ? NETWORK_TEXT : options.fallback ?? DEFAULT_TEXT;
  }

  return (
    options.byStatus?.[status] ??
    STATUS_TEXT[status] ??
    options.fallback ??
    DEFAULT_TEXT
  );
}
