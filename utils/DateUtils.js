export const formatMonthYear = (value) => {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
};

const DateUtils = {
  formatMonthYear,
};

export default DateUtils;
