/**
 * Small in-memory queue for identity-sensitive push operations.
 *
 * This deliberately serializes registration and detach requests without
 * changing the single-token database model. A rejected operation does not
 * poison the queue, so a later login can still register normally.
 */
export function createPushOperationQueue() {
  let tail: Promise<unknown> = Promise.resolve();

  return function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = tail.then(operation, operation);
    tail = next.then(() => undefined, () => undefined);
    return next;
  };
}

export const pushOperationQueue = createPushOperationQueue();

/**
 * React Native 0.81 does not provide AbortSignal.timeout consistently.
 * Always clear the timer when the request settles to avoid leaked timers.
 */
export async function withManualAbortTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  shouldAbort: () => boolean = () => false,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const guard = setInterval(() => {
    if (shouldAbort()) controller.abort();
  }, 50);
  try {
    return await operation(controller.signal);
  } finally {
    clearTimeout(timer);
    clearInterval(guard);
  }
}