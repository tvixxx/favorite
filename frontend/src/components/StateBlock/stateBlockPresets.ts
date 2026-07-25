/**
 * Пресеты состояний «пусто/ошибка» — копирайт и иконки 1:1 из эталона
 * (`Пустые состояния.dc.html` / `Ошибочные состояния.dc.html`).
 * Действия (кнопки) добавляются на месте использования — им нужны обработчики.
 */
export interface StatePreset {
  variant: "empty" | "error";
  icon: string;
  title: string;
  description?: string;
  code?: string;
}

export const STATE_PRESETS = {
  // ── Пустые ─────────────────────────────────────────────────────────────
  collectionEmpty: {
    variant: "empty",
    icon: "ph:film-reel",
    title: "В коллекции пока пусто",
    description:
      "Добавьте первый фильм или сериал — и начните вести свою медиатеку.",
  },
  catalogSearchEmpty: {
    variant: "empty",
    icon: "ph:magnifying-glass",
    title: "Ничего не найдено",
    description: "Проверьте написание или измените фильтры.",
  },
  catalogEmpty: {
    variant: "empty",
    icon: "ph:film-slate",
    title: "В каталоге пока нет фильмов",
    description: "Загляните позже — библиотека пополняется.",
  },
  favoritesEmpty: {
    variant: "empty",
    icon: "ph:heart",
    title: "В избранном пусто",
    description:
      "Отмечайте фильмы сердечком — они соберутся здесь для быстрого доступа.",
  },
  actorsEmpty: {
    variant: "empty",
    icon: "ph:user-focus",
    title: "Актёры ещё не добавлены",
    description: "Добавьте любимых актёров, чтобы следить за их новыми работами.",
  },
  listsEmpty: {
    variant: "empty",
    icon: "ph:list-plus",
    title: "У вас пока нет списков",
    description:
      "Создайте список — например «Посмотреть на выходных» или «Лучшее за год».",
  },
  listInsideEmpty: {
    variant: "empty",
    icon: "ph:stack",
    title: "В списке пока пусто",
    description: "Добавьте фильмы из каталога или своей коллекции.",
  },
  leaderboardEmpty: {
    variant: "empty",
    icon: "ph:trophy",
    title: "Рейтинг пока формируется",
    description: "Оцените фильмы — и они появятся в общем топе сообщества.",
  },
  chatListEmpty: {
    variant: "empty",
    icon: "ph:chats-circle",
    title: "Нет активных диалогов",
    description:
      "Начните обсуждение с друзьями и делитесь ссылками на кино прямо в чате.",
  },
  chatThreadEmpty: {
    variant: "empty",
    icon: "ph:chat-teardrop-dots",
    title: "Здесь пока нет сообщений",
    description: "Напишите первым — обсудите фильм или поделитесь ссылкой.",
  },
  friendsEmpty: {
    variant: "empty",
    icon: "ph:users",
    title: "У вас пока нет друзей",
    description: "Найдите друзей по имени или e-mail, чтобы обсуждать кино вместе.",
  },
  friendsRequestsEmpty: {
    variant: "empty",
    icon: "ph:user-plus",
    title: "Новых запросов нет",
    description: "Заявки в друзья и приглашения будут появляться здесь.",
  },
  notificationsEmpty: {
    variant: "empty",
    icon: "ph:bell",
    title: "Уведомлений нет",
    description: "Здесь появятся ответы на комментарии, оценки и заявки в друзья.",
  },

  // ── Ошибки ─────────────────────────────────────────────────────────────
  collectionError: {
    variant: "error",
    icon: "ph:warning-circle",
    title: "Не удалось загрузить коллекцию",
    description: "Проверьте соединение и попробуйте снова.",
  },
  catalogError: {
    variant: "error",
    icon: "ph:warning-circle",
    title: "Ошибка поиска",
    description: "Не получилось выполнить запрос. Попробуйте ещё раз.",
  },
  favoritesError: {
    variant: "error",
    icon: "ph:warning-circle",
    title: "Избранное не загрузилось",
    description: "Список временно недоступен. Попробуйте обновить.",
  },
  actorsError: {
    variant: "error",
    icon: "ph:warning-circle",
    title: "Не удалось загрузить актёров",
    description: "Данные не пришли. Проверьте соединение и повторите.",
  },
  listsError: {
    variant: "error",
    icon: "ph:warning-circle",
    title: "Списки не загрузились",
    description: "Что-то помешало получить ваши списки. Попробуйте ещё раз.",
  },
  leaderboardError: {
    variant: "error",
    icon: "ph:warning-circle",
    title: "Рейтинг не загрузился",
    description: "Не удалось получить топ сообщества. Попробуйте обновить.",
  },
  detailError: {
    variant: "error",
    icon: "ph:warning-circle",
    title: "Не удалось открыть фильм",
    description: "Карточка не загрузилась. Вернитесь назад или попробуйте снова.",
  },
  chatThreadError: {
    variant: "error",
    icon: "ph:warning-circle",
    title: "Сообщения не загрузились",
    description: "Не удалось получить переписку. Попробуйте обновить диалог.",
  },
  saveError: {
    variant: "error",
    icon: "ph:cloud-warning",
    title: "Не удалось сохранить",
    description:
      "Изменения не применились. Данные формы не потеряны — повторите отправку.",
  },
  offlineError: {
    variant: "error",
    icon: "ph:wifi-slash",
    title: "Нет соединения",
    description:
      "Проверьте интернет — мы обновим страницу, как только связь вернётся.",
  },
  serverError: {
    variant: "error",
    icon: "ph:plugs",
    title: "Что-то пошло не так",
    description: "Мы уже разбираемся. Попробуйте обновить страницу через минуту.",
    code: "ОШИБКА 500",
  },
} as const satisfies Record<string, StatePreset>;

export type StatePresetKey = keyof typeof STATE_PRESETS;
