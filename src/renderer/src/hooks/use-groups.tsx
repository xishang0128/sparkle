import React, { createContext, useContext, ReactNode } from 'react'
import useSWR from 'swr'
import { mihomoGroups } from '@renderer/utils/ipc'

interface GroupsContextType {
  groups: ControllerMixedGroup[] | undefined
  mutate: () => void
}

const GroupsContext = createContext<GroupsContextType | undefined>(undefined)

export const GroupsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { data: groups, mutate } = useSWR<ControllerMixedGroup[]>('mihomoGroups', mihomoGroups, {
    errorRetryInterval: 200,
    errorRetryCount: 10
  })

  React.useEffect(() => {
    window.electron.ipcRenderer.on('groupsUpdated', () => {
      mutate()
    })
    window.electron.ipcRenderer.on('core-started', () => {
      mutate()
    })
    return (): void => {
      window.electron.ipcRenderer.removeAllListeners('groupsUpdated')
      window.electron.ipcRenderer.removeAllListeners('core-started')
    }
  }, [])

  return <GroupsContext.Provider value={{ groups, mutate }}>{children}</GroupsContext.Provider>
}

export const useGroups = (): GroupsContextType => {
  const context = useContext(GroupsContext)
  if (context === undefined) {
    throw new Error('useGroups must be used within an GroupsProvider')
  }
  return context
}
