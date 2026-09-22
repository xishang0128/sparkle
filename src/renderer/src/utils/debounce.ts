export default function debounce<Args extends unknown[], This = unknown>(
  func: (this: This, ...args: Args) => unknown,
  wait: number
): (this: This, ...args: Args) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null
  return function (this: This, ...args: Args): void {
    if (timeout !== null) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(() => {
      func.apply(this, args)
    }, wait)
  }
}
