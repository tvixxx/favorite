import { isErrorStatus } from "@/utils";
import { DEFAULT_ERROR_MESSAGE_TEXT } from "@/state/constants";
import { message } from "ant-design-vue";

function getErrorReqMsg(error: any): string {
  const status = error?.response?.status ?? error?.status;
  const data = error?.response?.data;

  if (data?.message != null && typeof status === "number" && status >= 400) {
    const msg = data.message;
    return Array.isArray(msg) ? String(msg[0]) : String(msg);
  }

  if (data && isErrorStatus(status)) {
    return data?.message ?? DEFAULT_ERROR_MESSAGE_TEXT;
  }

  return error.message ?? DEFAULT_ERROR_MESSAGE_TEXT;
}

export function showErrorRequest(error: any) {
  const errorMsg = getErrorReqMsg(error);
  message.error(errorMsg);
}
