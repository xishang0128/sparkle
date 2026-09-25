import yaml, { isPair, isScalar } from 'yaml'

export function parseYaml<T = unknown>(content: string): T {
  const document = yaml.parseDocument(content, {
    merge: true
  })

  if (document.errors.length > 0) {
    throw document.errors[0]
  }

  yaml.visit(document, {
    Pair(_key, pair, path) {
      if (!isRealityShortId(pair, path)) return

      const value = pair.value
      if (!isScalar(value)) return

      // Preserve null, explicit tags, and already-resolved strings.
      if (value.value === null || typeof value.value === 'string' || value.tag) return
      if (value.source === undefined) return

      value.value = value.source
      value.tag = 'tag:yaml.org,2002:str'
    }
  })

  return (document.toJS() || {}) as T
}

export function stringifyYaml(data: unknown): string {
  return yaml.stringify(data)
}

function isRealityShortId(pair: unknown, path: readonly unknown[]): boolean {
  if (!isPair(pair) || !isScalar(pair.key) || pair.key.value !== 'short-id') return false

  return path.some(
    (node) => isPair(node) && isScalar(node.key) && node.key.value === 'reality-opts'
  )
}
