import { isErrorStatus } from "@/utils";
import {
  DEFAULT_ERROR_MESSAGE_TEXT,
  ERROR_FETCH_USER_TEXT,
  ERROR_LOGIN_TEXT,
  ERROR_REGISTRATION_TEXT,
  ERROR_UPDATE_USER_NAME_TEXT,
  INFO_LOGOUT_TEXT,
  SUCCESS_LOGIN_TEXT,
  SUCCESS_UPDATE_USER_NAME_TEXT,
} from "@/state/constants";
import { message } from "ant-design-vue";

function getErrorReqMsg(error: any): string {
  const hasErrorResData = error?.response?.data;
  const errorStatus = isErrorStatus(error.status);

  if (hasErrorResData && errorStatus) {
    return error.response?.data?.message ?? DEFAULT_ERROR_MESSAGE_TEXT;
  }

  return error.message;
}

export function showErrorRequest(error: any) {
  const errorMsg = getErrorReqMsg(error);
  message.error(errorMsg);
}

export function showUpdateUserNameError() {
  message.error(ERROR_UPDATE_USER_NAME_TEXT);
}

export function showRegistrationRequestError() {
  message.error(ERROR_REGISTRATION_TEXT);
}

export function showLoginRequestError() {
  message.error(ERROR_LOGIN_TEXT);
}

export function showFetchRequestError() {
  message.error(ERROR_FETCH_USER_TEXT);
}

export function showSuccessLoginText(userName: string) {
  if (!userName) {
    message.success(`${SUCCESS_LOGIN_TEXT}`);

    return;
  }

  message.success(`${SUCCESS_LOGIN_TEXT} ${userName}`);
}

export function showInfoLogoutMessage() {
  message.info(INFO_LOGOUT_TEXT);
}

export function showSuccessUpdateUserName() {
  message.success(SUCCESS_UPDATE_USER_NAME_TEXT);
}
