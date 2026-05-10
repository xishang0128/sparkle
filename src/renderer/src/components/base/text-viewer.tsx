import { Button, Input } from '@heroui-v3/react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import { MdKeyboardArrowDown, MdKeyboardArrowUp, MdSearch } from 'react-icons/md'

interface Props {
  value: string
}

interface Match {
  line: number
  start: number
}

interface CursorPosition {
  line: number
  column: number
}

const LINE_PADDING_LEFT = 12

function getLineStarts(value: string): Uint32Array {
  let count = 1
  for (let index = 0; index < value.length; index++) {
    if (value.charCodeAt(index) === 10) {
      count++
    }
  }

  const starts = new Uint32Array(count)
  let line = 1
  for (let index = 0; index < value.length; index++) {
    if (value.charCodeAt(index) === 10) {
      starts[line++] = index + 1
    }
  }
  return starts
}

function getLine(value: string, starts: Uint32Array, index: number): string {
  const start = starts[index]
  let end = index + 1 < starts.length ? starts[index + 1] - 1 : value.length
  if (end > start && value.charCodeAt(end - 1) === 13) {
    end--
  }
  return value.slice(start, end)
}

function findMatches(value: string, starts: Uint32Array, query: string): Match[] {
  const keyword = query.trim()
  if (!keyword) {
    return []
  }

  const matches: Match[] = []
  const needle = keyword.toLowerCase()

  for (let lineIndex = 0; lineIndex < starts.length; lineIndex++) {
    const line = getLine(value, starts, lineIndex)
    const source = line.toLowerCase()
    let offset = 0

    while (true) {
      const index = source.indexOf(needle, offset)
      if (index === -1) {
        break
      }
      matches.push({ line: lineIndex, start: index })
      offset = index + needle.length
    }
  }

  return matches
}

function HighlightedLine({
  line,
  query,
  activeStart
}: {
  line: string
  query: string
  activeStart?: number
}): React.ReactNode {
  const keyword = query.trim()
  if (!keyword) {
    return line
  }

  const lowerLine = line.toLowerCase()
  const lowerKeyword = keyword.toLowerCase()
  const parts: React.ReactNode[] = []
  let offset = 0

  while (true) {
    const index = lowerLine.indexOf(lowerKeyword, offset)
    if (index === -1) {
      parts.push(line.slice(offset))
      break
    }

    if (index > offset) {
      parts.push(line.slice(offset, index))
    }
    parts.push(
      <mark
        key={index}
        className={
          index === activeStart
            ? 'bg-warning text-warning-foreground'
            : 'bg-warning/35 text-foreground'
        }
      >
        {line.slice(index, index + keyword.length)}
      </mark>
    )
    offset = index + keyword.length
  }

  return parts
}

export const TextViewer: React.FC<Props> = ({ value }) => {
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const viewerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const [query, setQuery] = useState('')
  const [activeMatch, setActiveMatch] = useState(0)
  const [cursor, setCursor] = useState<CursorPosition>({ line: 0, column: 0 })
  const [isViewerFocused, setIsViewerFocused] = useState(false)
  const [charWidth, setCharWidth] = useState(7.83)
  const lineStarts = useMemo(() => getLineStarts(value), [value])
  const matches = useMemo(() => findMatches(value, lineStarts, query), [lineStarts, query, value])
  const currentMatch = matches.length ? Math.min(activeMatch, matches.length - 1) : 0
  const active = matches[currentMatch]

  useEffect(() => {
    if (activeMatch >= matches.length) {
      setActiveMatch(Math.max(matches.length - 1, 0))
    }
  }, [activeMatch, matches.length])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    const width = measureRef.current?.getBoundingClientRect().width
    if (width) {
      setCharWidth(width / 10)
    }
  }, [])

  const jumpToMatch = (index: number): void => {
    if (!matches.length) return
    const next = (index + matches.length) % matches.length
    setActiveMatch(next)
    virtuosoRef.current?.scrollToIndex({ index: matches[next].line, align: 'center' })
  }

  const updateQuery = (value: string): void => {
    setQuery(value)
    setActiveMatch(0)
  }

  const updateCursor = (
    event: React.MouseEvent<HTMLDivElement>,
    lineIndex: number,
    line: string
  ): void => {
    const textElement = event.currentTarget.querySelector('[data-line-text]')
    if (!(textElement instanceof HTMLElement)) {
      setCursor({ line: lineIndex, column: 0 })
      return
    }

    const left = textElement.getBoundingClientRect().left + LINE_PADDING_LEFT
    const column = Math.max(
      0,
      Math.min(line.length, Math.round((event.clientX - left) / charWidth))
    )
    setCursor({ line: lineIndex, column })
    viewerRef.current?.focus()
  }

  const moveCursor = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      return
    }

    event.preventDefault()
    setCursor((current) => {
      const currentLine = getLine(value, lineStarts, current.line)
      let next = current
      if (event.key === 'ArrowUp') {
        const line = Math.max(0, current.line - 1)
        next = { line, column: Math.min(current.column, getLine(value, lineStarts, line).length) }
      } else if (event.key === 'ArrowDown') {
        const line = Math.min(lineStarts.length - 1, current.line + 1)
        next = { line, column: Math.min(current.column, getLine(value, lineStarts, line).length) }
      } else if (event.key === 'ArrowLeft') {
        next = { ...current, column: Math.max(0, current.column - 1) }
      } else if (event.key === 'ArrowRight') {
        next = { ...current, column: Math.min(currentLine.length, current.column + 1) }
      } else if (event.key === 'Home') {
        next = { ...current, column: 0 }
      } else if (event.key === 'End') {
        next = { ...current, column: currentLine.length }
      }

      virtuosoRef.current?.scrollToIndex({ index: next.line, align: 'center' })
      return next
    })
  }

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden bg-content1 text-foreground"
      style={{ userSelect: 'text' }}
    >
      <span
        ref={measureRef}
        className="pointer-events-none absolute -left-2499.75 font-mono text-[13px] leading-5 tracking-normal"
      >
        0000000000
      </span>
      <div className="flex shrink-0 items-center gap-1 border-b border-divider px-2 py-1">
        <div className="relative min-w-0 flex-1">
          <MdSearch className="pointer-events-none absolute left-2 top-1/2 z-10 -translate-y-1/2 text-lg text-foreground-500" />
          <Input
            ref={inputRef}
            size={8}
            variant="secondary"
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                jumpToMatch(event.shiftKey ? currentMatch - 1 : currentMatch + 1)
              }
            }}
            placeholder="搜索"
            className="text-viewer-search w-full pl-8"
          />
        </div>
        {query.trim() && (
          <span className="min-w-12 shrink-0 text-right text-xs text-foreground-500">
            {`${matches.length ? currentMatch + 1 : 0}/${matches.length}`}
          </span>
        )}
        <div className="flex shrink-0 items-center gap-0">
          <Button
            size="sm"
            isIconOnly
            variant="ghost"
            className="size-7 min-w-7 p-0"
            isDisabled={!matches.length}
            onPress={() => jumpToMatch(currentMatch - 1)}
          >
            <MdKeyboardArrowUp className="text-xl" />
          </Button>
          <Button
            size="sm"
            isIconOnly
            variant="ghost"
            className="size-7 min-w-7 p-0"
            isDisabled={!matches.length}
            onPress={() => jumpToMatch(currentMatch + 1)}
          >
            <MdKeyboardArrowDown className="text-xl" />
          </Button>
        </div>
      </div>
      <div
        ref={viewerRef}
        tabIndex={0}
        className="min-h-0 flex-1"
        onFocus={() => setIsViewerFocused(true)}
        onBlur={() => setIsViewerFocused(false)}
        onKeyDown={moveCursor}
      >
        <Virtuoso
          ref={virtuosoRef}
          className="h-full"
          totalCount={lineStarts.length}
          increaseViewportBy={800}
          itemContent={(index) => {
            const line = getLine(value, lineStarts, index)
            const isCursorLine = cursor.line === index
            return (
              <div
                className={`flex min-h-5 font-mono text-[13px] leading-5 tracking-normal ${active?.line === index ? 'bg-warning/10' : isCursorLine ? 'bg-default-100/70' : ''}`}
                style={{ userSelect: 'text' }}
                onMouseDown={(event) => updateCursor(event, index, line)}
              >
                <span
                  className={`sticky left-0 w-14 shrink-0 border-r border-divider bg-content1 px-2 text-right ${isCursorLine ? 'text-primary' : 'text-foreground-400'}`}
                  style={{ userSelect: 'none' }}
                >
                  {index + 1}
                </span>
                <span
                  data-line-text
                  className="relative whitespace-pre px-3"
                  style={{ userSelect: 'text' }}
                >
                  {isCursorLine && isViewerFocused && (
                    <span
                      className="pointer-events-none absolute top-0 h-5 w-px bg-foreground"
                      style={{ left: LINE_PADDING_LEFT + cursor.column * charWidth }}
                    />
                  )}
                  <HighlightedLine
                    line={line}
                    query={query}
                    activeStart={active?.line === index ? active.start : undefined}
                  />
                </span>
              </div>
            )
          }}
        />
      </div>
    </div>
  )
}
