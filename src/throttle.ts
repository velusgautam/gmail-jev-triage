const DELAY_MS = Number(process.env.REQUEST_DELAY_MS ?? 0);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Every request reserves the next free slot, so the gap holds even with several workers.
let nextSlot = 0;
async function waitForSlot() {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + DELAY_MS;
  if (at > now) await sleep(at - now);
}

/** Runs `worker` over `items` with at most `n` running at once. */
export async function pool<T>(items: T[], n: number, worker: (item: T) => Promise<void>) {
  let next = 0;
  const lane = async () => {
    while (next < items.length) await worker(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, lane));
}

/** Waits for a slot, calls `fn`, and retries the errors that are worth retrying. */
export async function withJevLimits<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  for (let i = 1; ; i++) {
    await waitForSlot();
    try {
      return await fn();
    } catch (err: any) {
      if (err.status === 402) throw new Error("Jev says your balance is empty (402). Top up and re-run.");
      const retryable = err.status === 429 || err.status === 502 || err.status === 503;
      if (!retryable || i >= attempts) throw err;
      const wait = err.status === 429 ? (err.retryAfter ?? 61) * 1000 : 3000 * i;
      console.log(`  Jev returned ${err.status}, retrying in ${Math.round(wait / 1000)}s (${i}/${attempts})`);
      await sleep(wait);
    }
  }
}
