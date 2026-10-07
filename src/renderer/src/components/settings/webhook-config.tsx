import { Button, Input, InputGroup, Switch, Checkbox, Modal, Separator } from '@heroui/react'
import { useState } from 'react'
import { RiDeleteBinLine, RiEditLine } from 'react-icons/ri'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { testWebhook } from '@renderer/utils/ipc'
import { notify } from '@renderer/utils/notification'

const webhookCategories: Record<WebhookCategory, string> = {
  lifecycle: '内核生命周期',
  network: '代理与网络',
  profiles: '订阅与覆写',
  connections: '连接与规则操作',
  settings: '应用设置',
  service: '服务管理',
  tools: '备份与工具',
  application: '窗口与应用'
}
const allCategories = Object.keys(webhookCategories) as WebhookCategory[]

export default function WebhookConfigPanel(): React.JSX.Element {
  const { appConfig, patchAppConfig } = useAppConfig()
  const targets = appConfig?.webhook?.targets ?? []
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [editingTarget, setEditingTarget] = useState<WebhookTarget>()
  const save = async (targets: WebhookTarget[]): Promise<boolean> => {
    setSaving(true)
    try {
      return !!(await patchAppConfig({ webhook: { targets } }))
    } finally {
      setSaving(false)
    }
  }
  const test = async (target: WebhookTarget): Promise<void> => {
    setTesting(true)
    try {
      await testWebhook(target)
      notify('Webhook 测试发送成功', { variant: 'success' })
    } catch (error) {
      notify(error, { variant: 'danger' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <>
      <SettingCard header="Webhook 操作通知">
        {targets.map((target, index) => (
          <div key={target.id} data-webhook-target={target.id}>
            <div className="flex items-center gap-3 py-1">
              <div className="min-w-0 flex-1">
                <div className="truncate text-base leading-6">
                  {target.name?.trim() || `目标 ${index + 1}`}
                </div>
                <div className="truncate text-xs text-muted leading-4" title={target.url}>
                  {target.url}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  isIconOnly
                  aria-label="编辑目标"
                  isDisabled={saving}
                  onPress={() => setEditingTarget(target)}
                >
                  <RiEditLine className="text-lg" />
                </Button>
                <Button
                  size="sm"
                  isIconOnly
                  aria-label="删除目标"
                  isDisabled={saving}
                  variant="ghost"
                  data-color="danger"
                  onPress={() => save(targets.filter((item) => item.id !== target.id))}
                >
                  <RiDeleteBinLine className="text-lg" />
                </Button>
                <Switch
                  aria-label={`启用目标 ${index + 1}`}
                  className="ml-2 shrink-0"
                  size="sm"
                  isDisabled={saving}
                  isSelected={target.enabled !== false}
                  onChange={(enabled) =>
                    save(
                      targets.map((item) => (item.id === target.id ? { ...item, enabled } : item))
                    )
                  }
                >
                  <Switch.Content>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch.Content>
                </Switch>
              </div>
            </div>
            <Separator className="my-2" />
          </div>
        ))}
        <Button
          size="sm"
          variant="secondary"
          isDisabled={saving || !appConfig}
          onPress={() =>
            setEditingTarget({
              id: crypto.randomUUID(),
              enabled: true,
              url: '',
              timeout: 3000
            })
          }
        >
          添加目标
        </Button>
      </SettingCard>
      {editingTarget && (
        <WebhookTargetModal
          target={editingTarget}
          isNew={!targets.some((target) => target.id === editingTarget.id)}
          saving={saving}
          testing={testing}
          onClose={() => setEditingTarget(undefined)}
          onTest={test}
          onSave={async (target) => {
            const next = targets.some((item) => item.id === target.id)
              ? targets.map((item) => (item.id === target.id ? target : item))
              : [...targets, target]
            if (await save(next)) {
              notify('Webhook 设置已保存', { variant: 'success' })
              setEditingTarget(undefined)
            }
          }}
        />
      )}
    </>
  )
}

interface TargetModalProps {
  target: WebhookTarget
  isNew: boolean
  saving: boolean
  testing: boolean
  onClose: () => void
  onTest: (target: WebhookTarget) => Promise<void>
  onSave: (target: WebhookTarget) => Promise<void>
}

function WebhookTargetModal({
  target,
  isNew,
  saving,
  testing,
  onClose,
  onTest,
  onSave
}: TargetModalProps): React.JSX.Element {
  const [draft, setDraft] = useState<WebhookTarget>({ ...target })
  const categories = draft.categories ?? allCategories
  const update = (patch: Partial<WebhookTarget>): void =>
    setDraft((current) => ({ ...current, ...patch }))
  return (
    <Modal>
      <Modal.Backdrop
        isOpen
        onOpenChange={() => {
          if (!saving) onClose()
        }}
        variant="blur"
        className="top-12 h-[calc(100%-48px)]"
      >
        <Modal.Container scroll="inside">
          <Modal.Dialog>
            <Modal.Header className="app-drag">
              <Modal.Heading>{isNew ? '添加 Webhook 目标' : '编辑 Webhook 目标'}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <fieldset disabled={saving}>
                <SettingItem compatKey="legacy" title="名称" divider>
                  <Input
                    aria-label="目标名称"
                    value={draft.name ?? ''}
                    onChange={(event) => update({ name: event.target.value })}
                    className="w-[60%]"
                    fullWidth
                  />
                </SettingItem>
                <SettingItem compatKey="legacy" title="接收地址" divider>
                  <Input
                    aria-label="接收地址"
                    placeholder="https://example.com/webhook"
                    value={draft.url ?? ''}
                    onChange={(event) => update({ url: event.target.value.trim() })}
                    className="w-[60%]"
                    fullWidth
                  />
                </SettingItem>
                <SettingItem compatKey="legacy" title="访问令牌" divider>
                  <Input
                    aria-label="访问令牌"
                    type="password"
                    placeholder="可选"
                    value={draft.token ?? ''}
                    onChange={(event) => update({ token: event.target.value })}
                    className="w-[60%]"
                    fullWidth
                  />
                </SettingItem>
                <SettingItem compatKey="legacy" title="请求超时" divider>
                  <InputGroup className="w-[60%]">
                    <InputGroup.Input
                      aria-label="请求超时"
                      type="number"
                      min={1000}
                      max={10000}
                      step={1000}
                      value={String(draft.timeout ?? 3000)}
                      onChange={(event) => update({ timeout: Number(event.target.value) })}
                    />
                    <InputGroup.Suffix>毫秒</InputGroup.Suffix>
                  </InputGroup>
                </SettingItem>
                <div className="mb-3">推送事件</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {allCategories.map((category) => (
                    <Checkbox
                      key={category}
                      isSelected={categories.includes(category)}
                      onChange={(selected) =>
                        update({
                          categories: selected
                            ? [...categories, category]
                            : categories.filter((item) => item !== category)
                        })
                      }
                    >
                      <Checkbox.Content>
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        <span>{webhookCategories[category]}</span>
                      </Checkbox.Content>
                    </Checkbox>
                  ))}
                </div>
              </fieldset>
            </Modal.Body>
            <Modal.Footer>
              <Button
                size="sm"
                variant="secondary"
                className="mr-auto"
                isPending={testing}
                isDisabled={testing || saving || !draft.url}
                onPress={() => onTest(draft)}
              >
                发送测试
              </Button>
              <Button size="sm" variant="secondary" isDisabled={saving} onPress={onClose}>
                取消
              </Button>
              <Button
                size="sm"
                variant="primary"
                isPending={saving}
                isDisabled={saving || !draft.url}
                onPress={() => onSave({ ...draft, name: draft.name?.trim() })}
              >
                保存
              </Button>
            </Modal.Footer>
            <Modal.CloseTrigger className="app-nodrag" isDisabled={saving} />
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
