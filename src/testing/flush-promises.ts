/**
 * Drains microtasks and pending `setImmediate` callbacks so tests can await
 * fire-and-forget `void this.method()` background work.
 */
export async function flushMicrotasks(rounds = 5): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}
