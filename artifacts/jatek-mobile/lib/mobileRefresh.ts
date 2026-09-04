/**
 * Runs refresh requests independently.
 *
 * A refresh is best-effort: one optional feed failing must not prevent the
 * other feeds from updating or leave the pull-to-refresh indicator spinning.
 */
export async function refreshAll(
  tasks: readonly (() => Promise<unknown> | unknown)[],
): Promise<void> {
  await Promise.allSettled(tasks.map((task) => task()));
}