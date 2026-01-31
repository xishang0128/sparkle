import { Card, CardBody, Switch } from '@heroui/react'
import React, { useEffect, useState } from 'react'
import { mihomoRulesDisable } from '@renderer/utils/ipc'

interface Props {
  index: number
  rule: ControllerRulesDetail
}

const RuleItem: React.FC<Props> = ({ rule, index }) => {
  const [isEnabled, setIsEnabled] = useState(!rule.extra.disabled)

  useEffect(() => {
    setIsEnabled(!rule.extra.disabled)
  }, [rule, rule.extra.disabled])

  const handleToggle = async (v: boolean): Promise<void> => {
    setIsEnabled(v)
    try {
      await mihomoRulesDisable({ [index]: !v })
    } catch {
      setIsEnabled(!v)
    }
  }

  return (
    <div className={`w-full px-2 pb-2 ${index === 0 ? 'pt-2' : ''}`}>
      <Card>
        <CardBody className="w-full">
          <div className="text-ellipsis whitespace-nowrap overflow-hidden">
            {rule.payload}
            <Switch
              size="sm"
              isSelected={isEnabled}
              onValueChange={handleToggle}
              className="absolute right-2"
            />
          </div>
          <div className="flex justify-start text-foreground-500">
            <div>{rule.type}</div>
            <div className="ml-2">{rule.proxy}</div>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

export default RuleItem
