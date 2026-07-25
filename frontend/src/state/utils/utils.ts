import { isErrorStatus } from "@/utils";
import { DEFAULT_ERROR_MESSAGE_TEXT } from "@/state/constants";
import { message } from "ant-design-vue";

type ReqErrorLike = {
  response?: { status?: number; data?: { message?: string | string[] } };
  status?: number;
  message?: string;
};

function getErrorReqMsg(error: unknown): string {
  const e = error as ReqErrorLike;
  const status = e?.response?.status ?? e?.status;
  const data = e?.response?.data;

  if (data?.message != null && typeof status === "number" && status >= 400) {
    const msg = data.message;

    return Array.isArray(msg) ? String(msg[0]) : String(msg);
  }

  if (data && typeof status === "number" && isErrorStatus(status)) {
    const msg = data.message;

    return typeof msg === "string" ? msg : DEFAULT_ERROR_MESSAGE_TEXT;
  }

  return e?.message ?? DEFAULT_ERROR_MESSAGE_TEXT;
}

export function showErrorRequest(error: unknown): void {
  const errorMsg = getErrorReqMsg(error);
  message.error(errorMsg);
}
