import { arrayMove, type SortingStrategy } from '@dnd-kit/sortable'

export const siderSortingStrategy: SortingStrategy = ({ rects, activeIndex, overIndex, index }) => {
  const current = rects[index]
  if (!current || current.width <= 0 || current.height <= 0 || activeIndex < 0 || overIndex < 0) {
    return null
  }

  const visible = rects.filter((rect) => rect && rect.width > 0 && rect.height > 0)
  const left = Math.min(...visible.map((rect) => rect.left))
  const top = Math.min(...visible.map((rect) => rect.top))
  const width = Math.max(...visible.map((rect) => rect.right)) - left
  const halfCard = visible.find((rect) => rect.width <= width / 2)
  const columnStep = halfCard ? width - halfCard.width : 0
  const rows = [...new Set(visible.map((rect) => rect.top))].sort((a, b) => a - b)
  const firstRowBottom = Math.max(
    ...visible.filter((rect) => rect.top === top).map((rect) => rect.bottom)
  )
  const rowGap = rows.length > 1 ? Math.max(0, rows[1] - firstRowBottom) : 0
  const reordered = arrayMove(
    Array.from(rects, (rect, originalIndex) => ({ rect, originalIndex })),
    activeIndex,
    overIndex
  )

  let y = top
  let rowHeight = 0
  let column = 0
  for (const { rect, originalIndex } of reordered) {
    // Hidden cards still have entries in the saved order, but occupy no grid cells.
    if (!rect || rect.width <= 0 || rect.height <= 0) continue
    const span = rect.width > width / 2 ? 2 : 1
    if (column + span > 2) {
      y += rowHeight + rowGap
      rowHeight = 0
      column = 0
    }
    if (originalIndex === index) {
      return {
        x: left + column * columnStep - current.left,
        y: y - current.top,
        scaleX: 1,
        scaleY: 1
      }
    }
    column += span
    rowHeight = Math.max(rowHeight, rect.height)
    if (column === 2) {
      y += rowHeight + rowGap
      rowHeight = 0
      column = 0
    }
  }
  return null
}
