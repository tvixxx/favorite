import { ERROR_SERVER_STATUS } from "@/constants";

export const isSuccessStatus = (status = ERROR_SERVER_STATUS): boolean =>
  status >= 200 && status < 300;

export const isErrorStatus = (status = ERROR_SERVER_STATUS): boolean =>
  status >= 400 && status < 600;
