import { Separator, InputGroup, Button } from '@heroui/react'

import BasePage from '@renderer/components/base/base-page'
import RuleItem from '@renderer/components/rules/rule-item'
import { Virtuoso } from 'react-virtuoso'
import { useMemo, useState } from 'react'
import { useRules } from '@renderer/hooks/use-rules'
import { includesIgnoreCase } from '@renderer/utils/includes'

const Rules: React.FC = () => {
  const { rules } = useRules()
  const [filter, setFilter] = useState('')

  const filteredRules = useMemo(() => {
    if (!rules) return []
    if (filter === '') return rules.rules
    return rules.rules.filter((rule) => {
      return (
        includesIgnoreCase(rule.payload, filter) ||
        includesIgnoreCase(rule.type, filter) ||
        includesIgnoreCase(rule.proxy, filter)
      )
    })
  }, [rules, filter])

  return (
    <BasePage title="分流规则">
      <div className="sticky top-0 z-40">
        <div className="flex p-2">
          <InputGroup fullWidth>
            <InputGroup.Input
              value={filter}
              placeholder="筛选过滤"
              onChange={(event) => setFilter(event.target.value)}
            />
            {filter && (
              <InputGroup.Suffix>
                <Button
                  size="sm"
                  variant="ghost"
                  isIconOnly
                  aria-label="清空"
                  onPress={(event) => {
                    setFilter('')
                    event.target
                      .closest('[data-slot="input-group"]')
                      ?.querySelector('input')
                      ?.focus()
                  }}
                >
                  ×
                </Button>
              </InputGroup.Suffix>
            )}
          </InputGroup>
        </div>
        <Separator />
      </div>
      <div className="h-[calc(100vh-100px)] mt-px">
        <Virtuoso
          data={filteredRules}
          itemContent={(i, rule) => <RuleItem index={i} rule={rule} />}
        />
      </div>
    </BasePage>
  )
}

export default Rules
