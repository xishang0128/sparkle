type FilterExpression =
  | { type: 'literal'; value: unknown }
  | { type: 'path'; segments: Array<string | number> }
  | { type: 'unary'; operator: 'not'; argument: FilterExpression }
  | {
      type: 'binary'
      operator: 'and' | 'or' | '==' | '!=' | '>=' | '<=' | '>' | '<' | '~='
      left: FilterExpression
      right: FilterExpression
    }

type FilterToken =
  | { type: 'identifier'; value: string; position: number }
  | { type: 'string'; value: string; position: number }
  | { type: 'number'; value: number; position: number }
  | { type: 'boolean'; value: boolean; position: number }
  | { type: 'null'; position: number }
  | { type: 'not'; position: number }
  | { type: 'and'; position: number }
  | { type: 'or'; position: number }
  | { type: 'amp'; position: number }
  | { type: 'pipe'; position: number }
  | { type: 'dot'; position: number }
  | { type: 'lparen'; position: number }
  | { type: 'rparen'; position: number }
  | { type: 'lbracket'; position: number }
  | { type: 'rbracket'; position: number }
  | { type: 'eq'; position: number }
  | { type: 'ne'; position: number }
  | { type: 'gte'; position: number }
  | { type: 'lte'; position: number }
  | { type: 'gt'; position: number }
  | { type: 'lt'; position: number }
  | { type: 'fuzzy'; position: number }
  | { type: 'eof'; position: number }

export interface CompiledAdvancedFilter<T> {
  mode: 'plain' | 'advanced'
  error?: string
  matches: (item: T) => boolean
}

class FilterSyntaxError extends Error {
  constructor(
    message: string,
    readonly position: number
  ) {
    super(message)
    this.name = 'FilterSyntaxError'
  }
}

class FilterParser {
  private index = 0

  constructor(private readonly tokens: FilterToken[]) {}

  parse(): FilterExpression {
    const expression = this.parseOr()

    if (this.current().type !== 'eof') {
      throw new FilterSyntaxError('存在无法识别的多余内容', this.current().position)
    }

    return expression
  }

  private parseOr(): FilterExpression {
    let expression = this.parseAnd()

    while (this.current().type === 'or' || this.current().type === 'pipe') {
      this.index += 1
      expression = {
        type: 'binary',
        operator: 'or',
        left: expression,
        right: this.parseAnd()
      }
    }

    return expression
  }

  private parseAnd(): FilterExpression {
    let expression = this.parseComparison()

    while (this.current().type === 'and' || this.current().type === 'amp') {
      this.index += 1
      expression = {
        type: 'binary',
        operator: 'and',
        left: expression,
        right: this.parseComparison()
      }
    }

    return expression
  }

  private parseComparison(): FilterExpression {
    let expression = this.parseUnary()

    while (true) {
      const operator = this.matchComparisonOperator()
      if (!operator) return expression

      expression = {
        type: 'binary',
        operator,
        left: expression,
        right: this.parseUnary()
      }
    }
  }

  private parseUnary(): FilterExpression {
    if (this.match('not')) {
      return {
        type: 'unary',
        operator: 'not',
        argument: this.parseUnary()
      }
    }

    return this.parsePrimary()
  }

  private parsePrimary(): FilterExpression {
    const token = this.current()

    if (token.type === 'lparen') {
      this.index += 1
      const expression = this.parseOr()
      this.expect('rparen', '缺少右括号 ")"')
      return expression
    }

    if (token.type === 'dot') {
      return this.parsePath()
    }

    if (token.type === 'string' || token.type === 'number' || token.type === 'boolean') {
      this.index += 1
      return { type: 'literal', value: token.value }
    }

    if (token.type === 'null') {
      this.index += 1
      return { type: 'literal', value: null }
    }

    if (token.type === 'identifier') {
      this.index += 1
      return { type: 'literal', value: token.value }
    }

    throw new FilterSyntaxError('缺少合法表达式', token.position)
  }

  private parsePath(): FilterExpression {
    const segments: Array<string | number> = []
    this.expect('dot', '路径必须以 "." 开头')

    let expectSegment = false

    while (true) {
      if (this.current().type === 'identifier') {
        segments.push(this.consume('identifier').value)
        expectSegment = false
      } else if (this.current().type === 'lbracket') {
        this.index += 1
        const token = this.current()

        if (token.type === 'number') {
          segments.push(token.value)
          this.index += 1
        } else if (token.type === 'string') {
          segments.push(token.value)
          this.index += 1
        } else {
          throw new FilterSyntaxError('方括号中只支持数字下标或字符串键名', token.position)
        }

        this.expect('rbracket', '缺少右方括号 "]"')
        expectSegment = false
      } else if (expectSegment) {
        throw new FilterSyntaxError('点号后缺少字段名', this.current().position)
      } else {
        break
      }

      if (this.current().type === 'dot') {
        this.index += 1
        expectSegment = true
      }
    }

    return { type: 'path', segments }
  }

  private matchComparisonOperator(): '==' | '!=' | '>=' | '<=' | '>' | '<' | '~=' | null {
    const token = this.current()

    switch (token.type) {
      case 'eq':
        this.index += 1
        return '=='
      case 'ne':
        this.index += 1
        return '!='
      case 'gte':
        this.index += 1
        return '>='
      case 'lte':
        this.index += 1
        return '<='
      case 'gt':
        this.index += 1
        return '>'
      case 'lt':
        this.index += 1
        return '<'
      case 'fuzzy':
        this.index += 1
        return '~='
      default:
        return null
    }
  }

  private current(): FilterToken {
    return this.tokens[this.index]
  }

  private match(type: FilterToken['type']): boolean {
    if (this.current().type !== type) return false
    this.index += 1
    return true
  }

  private expect<T extends FilterToken['type']>(
    type: T,
    message: string
  ): Extract<FilterToken, { type: T }> {
    const token = this.current()
    if (token.type !== type) {
      throw new FilterSyntaxError(message, token.position)
    }

    this.index += 1
    return token as Extract<FilterToken, { type: T }>
  }

  private consume<T extends FilterToken['type']>(type: T): Extract<FilterToken, { type: T }> {
    return this.expect(type, `缺少 ${type}`)
  }
}

function parseQuotedString(input: string, start: number): { value: string; nextIndex: number } {
  const quote = input[start]
  let result = ''
  let index = start + 1

  while (index < input.length) {
    const char = input[index]

    if (char === quote) {
      return { value: result, nextIndex: index + 1 }
    }

    if (char === '\\') {
      const escaped = input[index + 1]

      if (!escaped) {
        throw new FilterSyntaxError('字符串转义不完整', index)
      }

      switch (escaped) {
        case '\\':
        case '"':
        case "'":
          result += escaped
          break
        case 'n':
          result += '\n'
          break
        case 'r':
          result += '\r'
          break
        case 't':
          result += '\t'
          break
        default:
          result += escaped
          break
      }

      index += 2
      continue
    }

    result += char
    index += 1
  }

  throw new FilterSyntaxError('字符串缺少结束引号', start)
}

function tokenize(input: string): FilterToken[] {
  const tokens: FilterToken[] = []
  const len = input.length
  let index = 0

  while (index < len) {
    const ch = input.charCodeAt(index)

    if (ch === 32 || ch === 9 || ch === 10 || ch === 13) {
      index++
      continue
    }

    if (ch === 46) {
      tokens.push({ type: 'dot', position: index++ })
      continue
    }
    if (ch === 40) {
      tokens.push({ type: 'lparen', position: index++ })
      continue
    }
    if (ch === 41) {
      tokens.push({ type: 'rparen', position: index++ })
      continue
    }
    if (ch === 91) {
      tokens.push({ type: 'lbracket', position: index++ })
      continue
    }
    if (ch === 93) {
      tokens.push({ type: 'rbracket', position: index++ })
      continue
    }

    const next = index + 1 < len ? input.charCodeAt(index + 1) : -1

    if (ch === 61 && next === 61) {
      tokens.push({ type: 'eq', position: index })
      index += 2
      continue
    }
    if (ch === 33 && next === 61) {
      tokens.push({ type: 'ne', position: index })
      index += 2
      continue
    }
    if (ch === 62 && next === 61) {
      tokens.push({ type: 'gte', position: index })
      index += 2
      continue
    }
    if (ch === 60 && next === 61) {
      tokens.push({ type: 'lte', position: index })
      index += 2
      continue
    }
    if (ch === 126 && next === 61) {
      tokens.push({ type: 'fuzzy', position: index })
      index += 2
      continue
    }
    if (ch === 38 && next === 38) {
      tokens.push({ type: 'amp', position: index })
      index += 2
      continue
    }
    if (ch === 124 && next === 124) {
      tokens.push({ type: 'pipe', position: index })
      index += 2
      continue
    }

    if (ch === 62) {
      tokens.push({ type: 'gt', position: index++ })
      continue
    }
    if (ch === 60) {
      tokens.push({ type: 'lt', position: index++ })
      continue
    }
    if (ch === 38) {
      tokens.push({ type: 'amp', position: index++ })
      continue
    }
    if (ch === 124) {
      tokens.push({ type: 'pipe', position: index++ })
      continue
    }

    if (ch === 34 || ch === 39) {
      const { value, nextIndex } = parseQuotedString(input, index)
      tokens.push({ type: 'string', value, position: index })
      index = nextIndex
      continue
    }

    if (ch === 45 || (ch >= 48 && ch <= 57)) {
      let end = index
      if (ch === 45) end++
      const digitStart = end
      while (end < len && input.charCodeAt(end) >= 48 && input.charCodeAt(end) <= 57) end++
      if (end > digitStart) {
        if (end < len && input.charCodeAt(end) === 46) {
          end++
          while (end < len && input.charCodeAt(end) >= 48 && input.charCodeAt(end) <= 57) end++
        }
        tokens.push({ type: 'number', value: Number(input.slice(index, end)), position: index })
        index = end
        continue
      }
    }

    if ((ch >= 65 && ch <= 90) || (ch >= 97 && ch <= 122) || ch === 95) {
      let end = index + 1
      while (end < len) {
        const c = input.charCodeAt(end)
        if (!((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || (c >= 48 && c <= 57)))
          break
        end++
      }
      const value = input.slice(index, end)
      if (value === 'true' || value === 'false') {
        tokens.push({ type: 'boolean', value: value === 'true', position: index })
      } else if (value === 'null') {
        tokens.push({ type: 'null', position: index })
      } else if (value === 'not' || value === 'and' || value === 'or') {
        tokens.push({ type: value as 'not' | 'and' | 'or', position: index })
      } else {
        tokens.push({ type: 'identifier', value, position: index })
      }
      index = end
      continue
    }

    throw new FilterSyntaxError(`存在无法识别的字符 "${input[index]}"`, index)
  }

  tokens.push({ type: 'eof', position: len })
  return tokens
}

function parseFilterExpression(input: string): FilterExpression {
  return new FilterParser(tokenize(input)).parse()
}

function getPathValue(root: unknown, segments: ReadonlyArray<string | number>): unknown {
  let value = root
  for (let i = 0; i < segments.length; i++) {
    if (value == null) return undefined
    const segment = segments[i]
    if (typeof segment === 'number') {
      if (!Array.isArray(value)) return undefined
      value = segment < 0 ? (value as unknown[]).at(segment) : (value as unknown[])[segment]
    } else {
      value = (value as Record<string, unknown>)[segment]
    }
  }
  return value
}

function isTruthy(value: unknown): boolean {
  if (value == null) return false
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0 && !Number.isNaN(value)
  if (typeof value === 'string') return value.length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value as object).length > 0
  return true
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null
  if (!/^-?\d+(?:\.\d+)?$/.test(value.trim())) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function stringifyValue(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true

  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, i) => deepEqual(item, right[i]))
  }

  if (
    left != null &&
    right != null &&
    typeof left === 'object' &&
    typeof right === 'object' &&
    !Array.isArray(left) &&
    !Array.isArray(right)
  ) {
    const leftKeys = Object.keys(left)
    const rightKeys = Object.keys(right)
    if (leftKeys.length !== rightKeys.length) return false
    const rightKeySet = new Set(rightKeys)
    return leftKeys.every(
      (key) =>
        rightKeySet.has(key) &&
        deepEqual((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key])
    )
  }

  const leftNumber = toNumber(left)
  const rightNumber = toNumber(right)
  if (leftNumber != null && rightNumber != null) return leftNumber === rightNumber

  return false
}

function compareOrderedValues(left: unknown, right: unknown): number {
  const leftNumber = toNumber(left)
  const rightNumber = toNumber(right)
  if (leftNumber != null && rightNumber != null) return leftNumber - rightNumber
  return stringifyValue(left).localeCompare(stringifyValue(right), undefined, {
    sensitivity: 'base',
    numeric: true
  })
}

function fuzzyMatch(left: unknown, right: unknown): boolean {
  const needle = stringifyValue(right).trim().toLowerCase()
  if (!needle) return false
  const matchValue = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(matchValue)
    return stringifyValue(value).toLowerCase().includes(needle)
  }
  return matchValue(left)
}

type ValueFn = (root: unknown) => unknown
type Predicate = (root: unknown) => boolean

function compileValue(expression: FilterExpression): ValueFn {
  switch (expression.type) {
    case 'literal':
      return () => expression.value

    case 'path': {
      const { segments } = expression
      if (segments.length === 1 && typeof segments[0] === 'string') {
        const s0 = segments[0]
        return (root) => (root != null ? (root as Record<string, unknown>)[s0] : undefined)
      }
      if (
        segments.length === 2 &&
        typeof segments[0] === 'string' &&
        typeof segments[1] === 'string'
      ) {
        const s0 = segments[0]
        const s1 = segments[1]
        return (root) => {
          const mid = root != null ? (root as Record<string, unknown>)[s0] : undefined
          return mid != null ? (mid as Record<string, unknown>)[s1] : undefined
        }
      }
      return (root) => getPathValue(root, segments)
    }

    default:
      return compilePredicate(expression) as ValueFn
  }
}

function compilePredicate(expression: FilterExpression): Predicate {
  switch (expression.type) {
    case 'literal':
      return isTruthy(expression.value) ? () => true : () => false

    case 'path': {
      const getVal = compileValue(expression)
      return (root) => isTruthy(getVal(root))
    }

    case 'unary': {
      const arg = compilePredicate(expression.argument)
      return (root) => !arg(root)
    }

    case 'binary': {
      if (expression.operator === 'and') {
        const left = compilePredicate(expression.left)
        const right = compilePredicate(expression.right)
        return (root) => left(root) && right(root)
      }

      if (expression.operator === 'or') {
        const left = compilePredicate(expression.left)
        const right = compilePredicate(expression.right)
        return (root) => left(root) || right(root)
      }

      const getLeft = compileValue(expression.left)

      // Specialize for constant right operand (most common pattern)
      if (expression.right.type === 'literal') {
        const rightVal = expression.right.value

        if (expression.operator === '~=') {
          const needle = stringifyValue(rightVal).trim().toLowerCase()
          if (!needle) return () => false
          return (root) => {
            const val = getLeft(root)
            if (typeof val === 'string') return val.toLowerCase().includes(needle)
            if (Array.isArray(val)) {
              return val.some((v) =>
                typeof v === 'string'
                  ? v.toLowerCase().includes(needle)
                  : stringifyValue(v).toLowerCase().includes(needle)
              )
            }
            return stringifyValue(val).toLowerCase().includes(needle)
          }
        }

        if (expression.operator === '==') {
          if (rightVal === null) return (root) => getLeft(root) == null
          if (typeof rightVal === 'string') return (root) => getLeft(root) === rightVal
          if (typeof rightVal === 'number') {
            return (root) => {
              const lv = getLeft(root)
              return typeof lv === 'number' ? lv === rightVal : toNumber(lv) === rightVal
            }
          }
          if (typeof rightVal === 'boolean') return (root) => Boolean(getLeft(root)) === rightVal
          return (root) => deepEqual(getLeft(root), rightVal)
        }

        if (expression.operator === '!=') {
          if (rightVal === null) return (root) => getLeft(root) != null
          if (typeof rightVal === 'string') return (root) => getLeft(root) !== rightVal
          if (typeof rightVal === 'number') {
            return (root) => {
              const lv = getLeft(root)
              return typeof lv === 'number' ? lv !== rightVal : toNumber(lv) !== rightVal
            }
          }
          if (typeof rightVal === 'boolean') return (root) => Boolean(getLeft(root)) !== rightVal
          return (root) => !deepEqual(getLeft(root), rightVal)
        }

        if (typeof rightVal === 'number') {
          if (expression.operator === '>') {
            return (root) => {
              const lv = getLeft(root)
              return (typeof lv === 'number' ? lv : (toNumber(lv) ?? -Infinity)) > rightVal
            }
          }
          if (expression.operator === '<') {
            return (root) => {
              const lv = getLeft(root)
              return (typeof lv === 'number' ? lv : (toNumber(lv) ?? Infinity)) < rightVal
            }
          }
          if (expression.operator === '>=') {
            return (root) => {
              const lv = getLeft(root)
              return (typeof lv === 'number' ? lv : (toNumber(lv) ?? -Infinity)) >= rightVal
            }
          }
          if (expression.operator === '<=') {
            return (root) => {
              const lv = getLeft(root)
              return (typeof lv === 'number' ? lv : (toNumber(lv) ?? Infinity)) <= rightVal
            }
          }
        }
      }

      // General case: both sides dynamic
      const getRight = compileValue(expression.right)
      switch (expression.operator) {
        case '==':
          return (root) => deepEqual(getLeft(root), getRight(root))
        case '!=':
          return (root) => !deepEqual(getLeft(root), getRight(root))
        case '>':
          return (root) => compareOrderedValues(getLeft(root), getRight(root)) > 0
        case '<':
          return (root) => compareOrderedValues(getLeft(root), getRight(root)) < 0
        case '>=':
          return (root) => compareOrderedValues(getLeft(root), getRight(root)) >= 0
        case '<=':
          return (root) => compareOrderedValues(getLeft(root), getRight(root)) <= 0
        case '~=':
          return (root) => fuzzyMatch(getLeft(root), getRight(root))
      }
    }
  }
}

function looksLikeAdvancedFilter(input: string): boolean {
  return (
    /(==|!=|~=|>=|<=|&&|\|\||[&|])/.test(input) ||
    /\b(and|or|not)\b/.test(input) ||
    (/[<>]/.test(input) && input.includes('.'))
  )
}

function formatFilterError(error: unknown): string {
  if (error instanceof FilterSyntaxError) {
    return `高级筛选语法错误：${error.message}（第 ${error.position + 1} 位）`
  }

  return '高级筛选解析失败'
}

export function compileAdvancedFilter<T>(
  input: string,
  plainMatcher: (item: T, query: string) => boolean
): CompiledAdvancedFilter<T> {
  const query = input.trim()

  if (query === '') {
    return {
      mode: 'plain',
      matches: () => true
    }
  }

  if (!looksLikeAdvancedFilter(query)) {
    return {
      mode: 'plain',
      matches: (item) => plainMatcher(item, query)
    }
  }

  try {
    const expression = parseFilterExpression(query)
    const matchFn = compilePredicate(expression)

    return {
      mode: 'advanced',
      matches: (item) => {
        try {
          return matchFn(item)
        } catch {
          return false
        }
      }
    }
  } catch (error) {
    return {
      mode: 'advanced',
      error: formatFilterError(error),
      matches: () => false
    }
  }
}
