export const DEFAULT_DELAY_TEST_CONCURRENCY = 50
export const MIN_DELAY_TEST_CONCURRENCY = 1
export const MAX_DELAY_TEST_CONCURRENCY = 512

export function normalizeDelayTestConcurrency(value?: number): number {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return DEFAULT_DELAY_TEST_CONCURRENCY

  return Math.min(
    Math.max(Math.floor(numericValue), MIN_DELAY_TEST_CONCURRENCY),
    MAX_DELAY_TEST_CONCURRENCY
  )
}

export async function runDelayTestsWithConcurrency<T>(
  items: T[],
  concurrency: number | undefined,
  run: (item: T) => Promise<void>
): Promise<void> {
  const workerCount = Math.min(normalizeDelayTestConcurrency(concurrency), items.length)

  await Promise.all(
    Array.from({ length: workerCount }, async (_, workerIndex) => {
      for (let index = workerIndex; index < items.length; index += workerCount) {
        await run(items[index])
      }
    })
  )
}
