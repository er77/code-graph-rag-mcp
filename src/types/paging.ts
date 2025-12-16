export type Page<T> = {
  items: T[];
  nextCursor: string | null;
  total?: number;
};
