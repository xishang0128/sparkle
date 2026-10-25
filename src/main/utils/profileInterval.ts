const minuteMs = 60 * 1000
const maxTimeoutMs = 2 ** 31 - 1
const maxIntervalMinutes = Math.floor(maxTimeoutMs / minuteMs)

export function isValidProfileInterval(interval: unknown): interval is number {
  return (
    typeof interval === 'number' &&
    Number.isInteger(interval) &&
    interval > 0 &&
    interval <= maxIntervalMinutes
  )
}

export function parseProfileUpdateInterval(value: unknown): number | undefined {
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return undefined
  const intervalMinutes = Number(value.trim()) * 60
  return isValidProfileInterval(intervalMinutes) ? intervalMinutes : undefined
}
