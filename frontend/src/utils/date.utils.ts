export const formatDate = (date: Date | string | null) => {
  if (!date) {
    return "не указано";
  }

  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export const formatYear = (date: Date | string | null) => {
  if (!date) {
    return "не указано";
  }

  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
  });
};

export const formatDateTime = (date: Date | string | null) => {
  if (!date) {
    return "не указано";
  }

  return new Date(date).toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
