export const SUCCESS_STATUSES = [200, 201] as const;
export const ERROR_STATUSES = [
  400, 401, 402, 403, 404, 500, 501, 502, 503,
] as const;
export const ERROR_SERVER_STATUS = 500;
export const ERROR_SERVER_STATUS_NOT_FOUND = 404;
