import React, { createContext, useContext, ReactNode } from 'react'
import useSWR from 'swr'
import { mihomoRules } from '@renderer/utils/ipc'

interface RulesContextType {
  rules: ControllerRules | undefined
  mutate: () => void
}

const RulesContext = createContext<RulesContextType | undefined>(undefined)

export const RulesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { data: rules, mutate } = useSWR<ControllerRules>('mihomoRules', mihomoRules, {
    errorRetryInterval: 200,
    errorRetryCount: 10
  })

  React.useEffect(() => {
    const unsubscribeRulesUpdated = window.electron.ipcRenderer.on('rulesUpdated', () => {
      mutate()
    })
    const unsubscribeCoreStarted = window.electron.ipcRenderer.on('core-started', () => {
      mutate()
    })
    return (): void => {
      unsubscribeRulesUpdated()
      unsubscribeCoreStarted()
    }
  }, [])

  return <RulesContext.Provider value={{ rules, mutate }}>{children}</RulesContext.Provider>
}

export const useRules = (): RulesContextType => {
  const context = useContext(RulesContext)
  if (context === undefined) {
    throw new Error('useRules must be used within an RulesProvider')
  }
  return context
}
