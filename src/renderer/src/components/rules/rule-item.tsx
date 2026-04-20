import { Card, CardBody, Switch, Chip } from '@heroui/react'
import React, { useEffect, useState } from 'react'
import { mihomoRulesDisable } from '@renderer/utils/ipc'

import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import dayjs from 'dayjs'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

interface Props {
  index: number
  rule: ControllerRulesDetail
}

const isZeroTime = (at: string): boolean => {
  return at.startsWith('0001-01-01') || at.startsWith('1970-01-01')
}

const RuleItem: React.FC<Props> = ({ rule, index }) => {
  const [isEnabled, setIsEnabled] = useState(!rule.extra.disabled)

  const { hitCount, hitAt, missCount, missAt } = rule.extra

  const totalCount = hitCount + missCount
  const hitRate = totalCount > 0 ? (hitCount / totalCount) * 100 : 0

  const hasStats = totalCount > 0

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
          <div className="flex justify-between text-ellipsis whitespace-nowrap overflow-hidden">
            {rule.payload || 'Match'}
            <Switch size="sm" isSelected={isEnabled} onValueChange={handleToggle} />
          </div>
          <div className="flex justify-between mt-1">
            <div className="flex justify-start text-foreground-500">
              <div>{rule.type}</div>
              <div className="ml-2">{rule.proxy}</div>
            </div>
            {/* 统计信息 */}
            {hasStats && (
              <div className="right-2 flex items-center gap-2 text-xs shrink-0  whitespace-nowrap">
                <span className="text-foreground-500">
                  {!isZeroTime(hitAt)
                    ? dayjs(hitAt).fromNow()
                    : !isZeroTime(missAt)
                      ? dayjs(missAt).fromNow()
                      : '未使用规则'}
                </span>
                <span className="text-foreground-600 font-medium">
                  {hitCount}/{totalCount}
                </span>
                <Chip size="sm" variant="flat" color="primary" className="text-xs">
                  {hitRate.toFixed(1)}%
                </Chip>
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

export default RuleItem
