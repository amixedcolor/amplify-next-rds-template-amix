// Aurora runs with minCapacity: 0 (see aws-blocks/index.ts), so it auto-pauses
// after ~5 minutes idle. Requests fail with this error while it resumes, which
// can take from several seconds to a few minutes.
const DB_RESUMING_ERROR = 'ConnectionFailedException';

const RETRY_INTERVAL_MS = 10_000;
const RETRY_TIMEOUT_MS = 3 * 60_000;

export function isDbResuming(e: unknown): boolean {
  return e instanceof Error && e.name === DB_RESUMING_ERROR;
}

/**
 * Calls `fn`, retrying every 10 seconds (for up to 3 minutes) while the
 * database is resuming. Retrying is safe even for writes: a connection failure
 * means the statement never ran. `onWaiting(true)` fires when the first retry
 * is scheduled and `onWaiting(false)` when the call finally settles.
 */
export async function retryWhileDbResumes<T>(
  fn: () => Promise<T>,
  onWaiting: (waiting: boolean) => void,
): Promise<T> {
  const deadline = Date.now() + RETRY_TIMEOUT_MS;
  let waiting = false;
  try {
    for (;;) {
      try {
        return await fn();
      } catch (e) {
        if (!isDbResuming(e) || Date.now() + RETRY_INTERVAL_MS > deadline) throw e;
        if (!waiting) onWaiting((waiting = true));
        await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS));
      }
    }
  } finally {
    if (waiting) onWaiting(false);
  }
}
