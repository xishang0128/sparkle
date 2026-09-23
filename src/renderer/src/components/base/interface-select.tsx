import { Select, ListBox } from '@heroui/react'
import React, { useEffect, useState } from 'react'
import { getInterfaces } from '@renderer/utils/ipc'

const InterfaceSelect: React.FC<{
  value: string
  exclude?: string[]
  onChange: (iface: string) => void
}> = ({ value, onChange, exclude = [] }) => {
  const [ifaces, setIfaces] = useState<string[]>([])
  useEffect(() => {
    const fetchInterfaces = async (): Promise<void> => {
      const names = Object.keys(await getInterfaces())
      setIfaces(names.filter((name) => !exclude.includes(name)))
    }
    fetchInterfaces()
  }, [])

  return (
    <Select
      aria-label="网络接口"
      className={['w-75'].filter(Boolean).join(' ')}
      data-size="sm"
      value={value ?? null}
      onChange={(v) => onChange(v as string)}
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover placement="bottom" shouldFlip containerPadding={56}>
        <ListBox>
          <ListBox.Item key="" id="" textValue="禁用">
            禁用
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <>
            {ifaces.map((name) => (
              <ListBox.Item key={name} id={name} textValue={name}>
                {name}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </>
        </ListBox>
      </Select.Popover>
    </Select>
  )
}

export default InterfaceSelect
