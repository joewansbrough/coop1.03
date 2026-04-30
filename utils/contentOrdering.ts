type DatedItem = {
  date?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

const getTimestamp = (value?: string | null) => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const getContentTimestamp = (item: DatedItem) =>
  Math.max(getTimestamp(item.createdAt), getTimestamp(item.updatedAt), getTimestamp(item.date));

export const sortNewestFirst = <T extends DatedItem>(items: T[]) =>
  [...items].sort((a, b) => getContentTimestamp(b) - getContentTimestamp(a));
