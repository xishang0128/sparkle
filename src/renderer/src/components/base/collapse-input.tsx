import { InputGroup } from '@heroui/react'
import React, { useEffect, useRef, useState } from 'react'
import { FaSearch } from 'react-icons/fa'

interface CollapseInputProps {
  value: string
  onValueChange: (value: string) => void
}

const CollapseInput: React.FC<CollapseInputProps> = ({ value, onValueChange }) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const composingRef = useRef(false)
  const [internalValue, setInternalValue] = useState(value)

  useEffect(() => {
    if (!composingRef.current) setInternalValue(value)
  }, [value])

  return (
    <InputGroup className="w-auto cursor-pointer gap-0 bg-transparent p-0 hover:bg-content2">
      <InputGroup.Input
        ref={inputRef}
        aria-label="搜索节点"
        value={internalValue}
        className={`flex-none w-0 focus:w-37.5 focus:ml-2 ${internalValue ? 'w-37.5 ml-2' : ''} transition-all duration-200`}
        onCompositionStart={() => {
          composingRef.current = true
        }}
        onCompositionEnd={(event) => {
          composingRef.current = false
          const nextValue = event.currentTarget.value
          setInternalValue(nextValue)
          onValueChange(nextValue)
        }}
        onChange={(event) => {
          const nextValue = event.target.value
          setInternalValue(nextValue)
          if (!composingRef.current) onValueChange(nextValue)
        }}
        onClick={(event) => event.stopPropagation()}
      />
      <InputGroup.Suffix>
        <button
          type="button"
          aria-label="展开或收起节点搜索"
          className="cursor-pointer p-2 text-lg text-foreground-500"
          onClick={(event) => {
            event.stopPropagation()
            if (inputRef.current?.offsetWidth !== 0) inputRef.current?.blur()
            else inputRef.current?.focus()
          }}
        >
          <FaSearch />
        </button>
      </InputGroup.Suffix>
    </InputGroup>
  )
}

export default CollapseInput
