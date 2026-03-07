import { isErrorStatus } from "@/utils";
import { DEFAULT_ERROR_MESSAGE_TEXT } from "@/state/constants";
import { message } from "ant-design-vue";

function getErrorReqMsg(error: any): string {
  const hasErrorResData = error?.response?.data;
  const errorStatus = isErrorStatus(error.status);

  if (hasErrorResData && errorStatus) {
    return error.response?.data?.message ?? DEFAULT_ERROR_MESSAGE_TEXT;
  }

  return error.message ?? DEFAULT_ERROR_MESSAGE_TEXT;
}

export function showErrorRequest(error: any) {
  const errorMsg = getErrorReqMsg(error);
  message.error(errorMsg);
}
