export type TimestampedOrder = {
  id: number;
  createdAt: string | Date;
};

/** Return a stable first-in-first-out copy without changing API cache order. */
export function sortOrdersOldestFirst<T extends TimestampedOrder>(orders: readonly T[]): T[] {
  return [...orders].sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime();
    const rightTime = new Date(right.createdAt).getTime();
    const safeLeftTime = Number.isFinite(leftTime) ? leftTime : Number.POSITIVE_INFINITY;
    const safeRightTime = Number.isFinite(rightTime) ? rightTime : Number.POSITIVE_INFINITY;
    return safeLeftTime - safeRightTime || left.id - right.id;
  });
}