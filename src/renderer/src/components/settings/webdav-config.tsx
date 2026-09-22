import { Input, Button, Spinner } from '@heroui/react'

import React, { useState } from 'react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { listWebdavBackups, webdavBackup } from '@renderer/utils/ipc'
import WebdavRestoreModal from './webdav-restore-modal'
import debounce from '@renderer/utils/debounce'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { notify } from '@renderer/utils/notification'

const WebdavConfig: React.FC = () => {
  const { appConfig, patchAppConfig } = useAppConfig()
  const { webdavUrl, webdavUsername, webdavPassword, webdavDir = 'sparkle' } = appConfig || {}
  const [backuping, setBackuping] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [filenames, setFilenames] = useState<string[]>([])
  const [restoreOpen, setRestoreOpen] = useState(false)

  const [webdav, setWebdav] = useState({ webdavUrl, webdavUsername, webdavPassword, webdavDir })
  const setWebdavDebounce = debounce(
    ({ webdavUrl, webdavUsername, webdavPassword, webdavDir }: typeof webdav) => {
      patchAppConfig({ webdavUrl, webdavUsername, webdavPassword, webdavDir })
    },
    500
  )
  const handleBackup = async (): Promise<void> => {
    setBackuping(true)
    try {
      await webdavBackup()
      notify('备份成功', { body: '备份文件已上传至 WebDAV', variant: 'success' })
    } catch (e) {
      notify(e, { variant: 'danger' })
    } finally {
      setBackuping(false)
    }
  }

  const handleRestore = async (): Promise<void> => {
    try {
      setRestoring(true)
      const filenames = await listWebdavBackups()
      setFilenames(filenames)
      setRestoreOpen(true)
    } catch (e) {
      notify(`获取备份列表失败：${e}`, { variant: 'danger' })
    } finally {
      setRestoring(false)
    }
  }
  return (
    <>
      {restoreOpen && (
        <WebdavRestoreModal filenames={filenames} onClose={() => setRestoreOpen(false)} />
      )}
      <SettingCard header="WebDAV 备份">
        <SettingItem compatKey="legacy" title="WebDAV 地址" divider>
          <Input
            value={webdav.webdavUrl}
            onChange={(event) => {
              const v = event.target.value
              setWebdav({ ...webdav, webdavUrl: v })
              setWebdavDebounce({ ...webdav, webdavUrl: v })
            }}
            className="w-[60%]"
            fullWidth
          />
        </SettingItem>
        <SettingItem compatKey="legacy" title="WebDAV 备份目录" divider>
          <Input
            value={webdav.webdavDir}
            onChange={(event) => {
              const v = event.target.value
              setWebdav({ ...webdav, webdavDir: v })
              setWebdavDebounce({ ...webdav, webdavDir: v })
            }}
            className="w-[60%]"
            fullWidth
          />
        </SettingItem>
        <SettingItem compatKey="legacy" title="WebDAV 用户名" divider>
          <Input
            value={webdav.webdavUsername}
            onChange={(event) => {
              const v = event.target.value
              setWebdav({ ...webdav, webdavUsername: v })
              setWebdavDebounce({ ...webdav, webdavUsername: v })
            }}
            className="w-[60%]"
            fullWidth
          />
        </SettingItem>
        <SettingItem compatKey="legacy" title="WebDAV 密码" divider>
          <Input
            type="password"
            value={webdav.webdavPassword}
            onChange={(event) => {
              const v = event.target.value
              setWebdav({ ...webdav, webdavPassword: v })
              setWebdavDebounce({ ...webdav, webdavPassword: v })
            }}
            className="w-[60%]"
            fullWidth
          />
        </SettingItem>
        <div className="flex justify0between">
          <Button
            fullWidth
            size="sm"
            onPress={handleBackup}
            variant="primary"
            data-color="default"
            className="mr-1"
            isPending={backuping}
            isDisabled={backuping}
          >
            {backuping ? <Spinner size="sm" color="current" /> : null}备份
          </Button>
          <Button
            fullWidth
            size="sm"
            onPress={handleRestore}
            variant="primary"
            data-color="default"
            className="ml-1"
            isPending={restoring}
            isDisabled={restoring}
          >
            {restoring ? <Spinner size="sm" color="current" /> : null}恢复
          </Button>
        </div>
      </SettingCard>
    </>
  )
}

export default WebdavConfig
