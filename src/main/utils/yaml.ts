import yaml from 'yaml'

export function parseYaml<T = unknown>(content: string): T {
  const processedContent = content.replace(
    /(^|\{|,)(\s*short-id:\s*)(?!['"]|null\b|Null\b|NULL\b|~)([^"'\s,}\n]+)/gm,
    '$1$2"$3"'
  )

  const result =
    yaml.parse(processedContent, {
      merge: true
    }) || {}
  return result as T
}

export function stringifyYaml(data: unknown): string {
  return yaml.stringify(data)
}
