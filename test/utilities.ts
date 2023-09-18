import { setTimeout } from "node:timers/promises";

export const retry = async <T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  delayMs: number = 1000,
): Promise<T> => {
  const startTime = Date.now();

  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (Date.now() - startTime > timeoutMs) {
        throw error;
      }

      await setTimeout(delayMs);
    }
  }
};
