export const DEFAULT_MAIN_STATE = {
  user: {
    loggedIn: false,
    isAuthLoaded: false,
    data: null,
  },
  isFetchingUser: false,
};

export const MAIN_STORE_NAME = "mainStore";

// ERROR MESSAGES
export const DEFAULT_ERROR_MESSAGE_TEXT = "Произошла ошибка";
export const ERROR_UPDATE_USER_NAME_TEXT = "Не удалось изменить имя";
export const ERROR_REGISTRATION_TEXT =
  "Не удалось зарегистрировать пользователя";
export const ERROR_LOGIN_TEXT = "Не удалось войти в систему";
export const ERROR_FETCH_USER_TEXT =
  "Не удалось получить информацию пользователя";

export const ERROR_FETCH_MOVIES_TEXT =
  "Ошибка загрузки фильмов. Пожалуйста, попробуйте позже";

// SUCCESS MESSAGES
export const SUCCESS_LOGIN_TEXT = "Добро пожаловать";
export const SUCCESS_UPDATE_USER_NAME_TEXT = "Имя успешно обновлено";

// INFO MESSAGES
export const INFO_LOGOUT_TEXT = "Вы успешно вышли из системы";
