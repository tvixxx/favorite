import {
  ERROR_SERVER_STATUS,
  ERROR_STATUSES,
  SUCCESS_STATUSES,
} from "@/constants";

export const isSuccessStatus = (status = ERROR_SERVER_STATUS): boolean =>
  SUCCESS_STATUSES.some((successStatus) => successStatus === status);

export const isErrorStatus = (status = ERROR_SERVER_STATUS): boolean =>
  ERROR_STATUSES.some((errorStatus) => errorStatus === status);
