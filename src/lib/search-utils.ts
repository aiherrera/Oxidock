export const filterByQuery = <T>(items: T[], query: string, getValues: (item: T) => string[]) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return items;
  }

  return items.filter((item) => getValues(item).some((value) => value.toLowerCase().includes(normalized)));
};

export const toErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return fallback;
};
