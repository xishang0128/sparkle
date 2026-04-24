export interface ConnectionFilterSuggestion {
  key: string
  label: string
  replaceFrom: number
  replaceTo: number
  insertText: string
  cursorOffset?: number
}

export interface ConnectionFilterCompletionSession {
  baseValue: string
  currentIndex: number
  suggestions: ConnectionFilterSuggestion[]
}

const connectionFilterFields = [
  { label: '.metadata.process' },
  { label: '.metadata.processPath' },
  { label: '.metadata.host' },
  { label: '.metadata.sniffHost' },
  { label: '.metadata.destinationIP' },
  { label: '.metadata.sourceIP' },
  { label: '.metadata.destinationPort' },
  { label: '.metadata.sourcePort' },
  { label: '.metadata.network' },
  { label: '.metadata.type' },
  { label: '.metadata.inboundName' },
  { label: '.metadata.inboundUser' },
  { label: '.metadata.remoteDestination' },
  { label: '.rule' },
  { label: '.rulePayload' },
  { label: '.chains[0]' },
  { label: '.upload' },
  { label: '.download' },
  { label: '.uploadSpeed' },
  { label: '.downloadSpeed' },
  { label: '.isActive' },
  { label: '.start' }
] as const

const connectionFilterTemplates = [
  {
    key: 'tpl-process-fuzzy',
    label: '.metadata.process ~= ""',
    cursorOffset: '.metadata.process ~= "'.length
  },
  {
    key: 'tpl-host-fuzzy',
    label: '.metadata.host ~= ""',
    cursorOffset: '.metadata.host ~= "'.length
  },
  {
    key: 'tpl-dst-ip',
    label: '.metadata.destinationIP == ""',
    cursorOffset: '.metadata.destinationIP == "'.length
  },
  {
    key: 'tpl-network',
    label: '.metadata.network == "tcp"',
    cursorOffset: '.metadata.network == "tcp"'.length
  },
  {
    key: 'tpl-upload-speed',
    label: '.uploadSpeed > 0',
    cursorOffset: '.uploadSpeed > 0'.length
  },
  {
    key: 'tpl-rule',
    label: '.rule ~= ""',
    cursorOffset: '.rule ~= "'.length
  }
] as const

const connectionFilterLeafPaths: string[] = connectionFilterFields.map((field) => field.label)

function isPathChar(char: string | undefined): boolean {
  if (!char) return false

  return /[A-Za-z0-9_.[\]"'-]/.test(char)
}

function getPathTokenAtCursor(input: string, cursor: number) {
  let start = cursor
  let end = cursor

  while (start > 0 && isPathChar(input[start - 1])) {
    start -= 1
  }

  while (end < input.length && isPathChar(input[end])) {
    end += 1
  }

  if (input[start] !== '.') return null

  return {
    start,
    end,
    text: input.slice(start, end)
  }
}

function rankByPrefix(value: string, prefix: string): number {
  const lowerValue = value.toLowerCase()
  const lowerPrefix = prefix.toLowerCase()

  if (lowerValue === lowerPrefix) return 0
  if (lowerValue.startsWith(lowerPrefix)) return 1

  const includesIndex = lowerValue.indexOf(lowerPrefix)
  return includesIndex === -1 ? Number.POSITIVE_INFINITY : includesIndex + 2
}

function findPathSeparatorIndex(value: string): number {
  const dotIndex = value.indexOf('.')
  const bracketIndex = value.indexOf('[')

  if (dotIndex === -1) return bracketIndex
  if (bracketIndex === -1) return dotIndex

  return Math.min(dotIndex, bracketIndex)
}

function getNextPathSuggestionTarget(prefix: string, fullPath: string): string {
  if (!fullPath.startsWith(prefix)) return fullPath

  const remainder = fullPath.slice(prefix.length)
  if (remainder === '') return fullPath

  if (remainder.startsWith('.')) {
    const nextSeparatorIndex = findPathSeparatorIndex(remainder.slice(1))
    return nextSeparatorIndex === -1
      ? fullPath
      : prefix + remainder.slice(0, nextSeparatorIndex + 1)
  }

  const nextSeparatorIndex = findPathSeparatorIndex(remainder)
  return nextSeparatorIndex === -1 ? fullPath : prefix + remainder.slice(0, nextSeparatorIndex)
}

function withLeadingSpace(input: string, index: number, text: string) {
  const previousChar = input[index - 1]
  if (!previousChar || /\s|\(/.test(previousChar)) return { text, offset: 0 }

  return { text: ` ${text}`, offset: 1 }
}

function endsWithValueOperand(input: string): boolean {
  return /(?:\.[A-Za-z0-9_.[\]"'-]+|\)|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|-?\d+(?:\.\d+)?|true|false|null)\s*$/.test(
    input
  )
}

function endsWithComparisonClause(input: string): boolean {
  return /(?:==|!=|>=|<=|>|<|~=)\s*(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|-?\d+(?:\.\d+)?|true|false|null|\.[A-Za-z0-9_.[\]"'-]+)\s*$/.test(
    input
  )
}

function getCurrentClause(input: string): string {
  let clauseStart = 0
  let quote: '"' | "'" | null = null
  let escaped = false

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]

    if (escaped) {
      escaped = false
      continue
    }

    if (quote) {
      if (char === '\\') {
        escaped = true
      } else if (char === quote) {
        quote = null
      }
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (char === '&' || char === '|') {
      clauseStart = index + 1
      continue
    }

    if (!/\s/.test(char)) continue

    const matchedLogical = input.slice(index).match(/^\s+(and|or)\s+/i)
    if (!matchedLogical) continue

    clauseStart = index + matchedLogical[0].length
    index = clauseStart - 1
  }

  return input.slice(clauseStart)
}

function hasComparisonOperator(input: string): boolean {
  return /(==|!=|>=|<=|>|<|~=)/.test(input)
}

function normalizeClauseForCompletion(input: string): string {
  return input
    .trim()
    .replace(/^\(+\s*/, '')
    .replace(/\s*\)+$/, '')
    .trim()
}

function collectPathSuggestionTargets(prefix: string) {
  const matchedTargets = new Map<
    string,
    { rank: number; sourceIndex: number; sourceLabel: string }
  >()

  connectionFilterFields.forEach(({ label }, sourceIndex) => {
    if (rankByPrefix(label, prefix) === Number.POSITIVE_INFINITY) return

    const target = getNextPathSuggestionTarget(prefix, label)
    const currentEntry = matchedTargets.get(target)
    const currentRank = rankByPrefix(target, prefix)

    if (
      !currentEntry ||
      currentRank < currentEntry.rank ||
      (currentRank === currentEntry.rank && sourceIndex < currentEntry.sourceIndex) ||
      (currentRank === currentEntry.rank &&
        sourceIndex === currentEntry.sourceIndex &&
        target.localeCompare(currentEntry.sourceLabel) < 0)
    ) {
      matchedTargets.set(target, {
        rank: currentRank,
        sourceIndex,
        sourceLabel: label
      })
    }
  })

  return Array.from(matchedTargets.entries()).sort((left, right) => {
    const leftMeta = left[1]
    const rightMeta = right[1]

    return (
      leftMeta.rank - rightMeta.rank ||
      leftMeta.sourceIndex - rightMeta.sourceIndex ||
      left[0].localeCompare(right[0])
    )
  })
}

function getPathSuggestions(
  prefix: string,
  replaceFrom: number,
  replaceTo: number
): ConnectionFilterSuggestion[] {
  return collectPathSuggestionTargets(prefix)
    .slice(0, 8)
    .map(([target]) => ({
      key: `field:${replaceFrom}:${target}`,
      label: target,
      replaceFrom,
      replaceTo,
      insertText: target,
      cursorOffset: target.length
    }))
}

function getConnectionFilterSuggestions(
  input: string,
  cursor: number
): ConnectionFilterSuggestion[] {
  const beforeCursor = input.slice(0, cursor)
  const trimmedBeforeCursor = beforeCursor.trimEnd()
  const currentClause = getCurrentClause(beforeCursor)
  const currentClauseStart = beforeCursor.length - currentClause.length
  const normalizedCurrentClause = normalizeClauseForCompletion(currentClause)
  const pathToken = getPathTokenAtCursor(input, cursor)
  const isExactLeafPathToken =
    pathToken != null && connectionFilterLeafPaths.includes(pathToken.text)

  if (pathToken && !isExactLeafPathToken) {
    return collectPathSuggestionTargets(pathToken.text)
      .slice(0, 8)
      .map(([target]) => ({
        key: `field:${target}`,
        label: target,
        replaceFrom: pathToken.start,
        replaceTo: pathToken.end,
        insertText: target,
        cursorOffset: target.length
      }))
  }

  const operatorTokenMatch = beforeCursor.match(/[!<>=~]*$/)
  const operatorReplaceFrom = cursor - (operatorTokenMatch?.[0].length ?? 0)
  const operatorContextInClause = beforeCursor.slice(currentClauseStart, operatorReplaceFrom)
  const normalizedOperatorContext = normalizeClauseForCompletion(operatorContextInClause)
  const canShowOperatorSuggestions =
    !pathToken || (cursor === pathToken.end && isExactLeafPathToken)

  if (endsWithComparisonClause(normalizedCurrentClause)) {
    return [
      { key: 'logic-and', label: 'and', insertText: ' and ' },
      { key: 'logic-or', label: 'or', insertText: ' or ' },
      { key: 'logic-amp', label: '&', insertText: ' & ' },
      { key: 'logic-pipe', label: '|', insertText: ' | ' }
    ].map((keyword) => ({
      key: keyword.key,
      label: keyword.label,
      replaceFrom: cursor,
      replaceTo: cursor,
      insertText: keyword.insertText,
      cursorOffset: keyword.insertText.length
    }))
  }

  if (
    canShowOperatorSuggestions &&
    !hasComparisonOperator(normalizedCurrentClause) &&
    endsWithValueOperand(normalizedOperatorContext)
  ) {
    return [
      {
        key: 'op-fuzzy',
        label: '~= ""',
        insertText: '~= ""',
        cursorOffset: '~= "'.length
      },
      {
        key: 'op-eq-string',
        label: '== ""',
        insertText: '== ""',
        cursorOffset: '== "'.length
      },
      {
        key: 'op-ne-string',
        label: '!= ""',
        insertText: '!= ""',
        cursorOffset: '!= "'.length
      },
      {
        key: 'op-eq-true',
        label: '== true',
        insertText: '== true',
        cursorOffset: '== true'.length
      },
      {
        key: 'op-gt-zero',
        label: '> 0',
        insertText: '> 0',
        cursorOffset: '> 0'.length
      }
    ].map((operator) => {
      const { text, offset } = withLeadingSpace(input, operatorReplaceFrom, operator.insertText)

      return {
        key: operator.key,
        label: operator.label,
        replaceFrom: operatorReplaceFrom,
        replaceTo: cursor,
        insertText: text,
        cursorOffset: offset + operator.cursorOffset
      }
    })
  }

  if (trimmedBeforeCursor === '') {
    return connectionFilterTemplates.map((template) => ({
      key: template.key,
      label: template.label,
      replaceFrom: 0,
      replaceTo: input.length,
      insertText: template.label,
      cursorOffset: template.cursorOffset
    }))
  }

  return []
}

export function getEnhancedConnectionFilterSuggestions(
  input: string,
  cursor: number
): ConnectionFilterSuggestion[] {
  const beforeCursor = input.slice(0, cursor)
  const trimmedBeforeCursor = beforeCursor.trimEnd()
  const currentClause = getCurrentClause(beforeCursor)
  const normalizedCurrentClause = normalizeClauseForCompletion(currentClause)
  const pathToken = getPathTokenAtCursor(input, cursor)
  const isExactLeafPathToken =
    pathToken != null && connectionFilterLeafPaths.includes(pathToken.text)

  if (pathToken && !isExactLeafPathToken) {
    return getPathSuggestions(pathToken.text, pathToken.start, pathToken.end)
  }

  if (!pathToken && normalizedCurrentClause === '' && trimmedBeforeCursor !== '') {
    return getPathSuggestions('.', cursor, cursor)
  }

  return getConnectionFilterSuggestions(input, cursor)
}

export function buildConnectionFilterSuggestionResult(
  baseValue: string,
  suggestion: ConnectionFilterSuggestion
) {
  const nextValue =
    baseValue.slice(0, suggestion.replaceFrom) +
    suggestion.insertText +
    baseValue.slice(suggestion.replaceTo)

  const nextCursor =
    suggestion.replaceFrom + (suggestion.cursorOffset ?? suggestion.insertText.length)

  return { nextCursor, nextValue }
}

export function isConnectionFilterCompletionSessionActive(
  session: ConnectionFilterCompletionSession | null,
  value: string,
  cursor: number
): boolean {
  if (!session) return false

  const currentSuggestion = session.suggestions[session.currentIndex]
  if (!currentSuggestion) return false

  const { nextCursor, nextValue } = buildConnectionFilterSuggestionResult(
    session.baseValue,
    currentSuggestion
  )

  return value === nextValue && cursor === nextCursor
}
