import { Button, Checkbox, Chip, Input, Switch } from '@heroui/react'
import { Label, Modal, Separator, Surface } from '@heroui-v3/react'
import React, { useEffect, useMemo, useState } from 'react'
import { FaPlus } from 'react-icons/fa6'
import { MdDeleteForever, MdDragIndicator } from 'react-icons/md'
import {
  createSplitOverrideTemplate,
  defaultAppRules,
  defaultNodeGroups,
  defaultPolicyGroups,
  ProviderCategory,
  providerCategoryLabels,
  providerPresets,
  ProviderPreset,
  SplitAppRule,
  SplitNodeGroup,
  SplitPolicyGroup
} from '@renderer/utils/split-override-template'

interface Props {
  item?: OverrideItem
  addOverrideItem: (item: Partial<OverrideItem>) => Promise<void>
  onClose: () => void
}

interface RemoteRuleOption {
  name: string
  label: string
  category: ProviderCategory
  behavior: 'domain' | 'ipcidr'
  url: string
  recommendedTarget?: string
  noResolve?: boolean
  fallback?: boolean
}

interface RemoteRulesIndex {
  rules?: RemoteRuleOption[]
}

let metaCubeRemoteRulesCache: RemoteRuleOption[] | null = null
let metaCubeRemoteRulesPromise: Promise<RemoteRuleOption[]> | null = null
const remoteRulesIndexUrl =
  'https://raw.githubusercontent.com/robinzc2008/sparkle/master/public/rules-index.json'

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 6)}`
}

function prettyRuleName(slug: string, behavior: RemoteRuleOption['behavior']): string {
  const label = slug
    .split(/[-_@]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
  return behavior === 'ipcidr' ? `${label} IP` : label
}

const fallbackGeositeSlugs = [
  'private',
  'cn',
  'geolocation-!cn',
  'gfw',
  'proxy',
  'category-ads-all',
  'tracker',
  'youtube',
  'google',
  'netflix',
  'disney',
  'primevideo',
  'hbo',
  'hulu',
  'spotify',
  'tiktok',
  'twitch',
  'abema',
  'bahamut',
  'biliintl',
  'telegram',
  'twitter',
  'facebook',
  'instagram',
  'whatsapp',
  'discord',
  'line',
  'openai',
  'category-ai-!cn',
  'github',
  'gitlab',
  'docker',
  'microsoft',
  'microsoft@cn',
  'onedrive',
  'apple',
  'apple-cn',
  'applemusic',
  'icloud',
  'cloudflare',
  'steam',
  'steam@cn',
  'epicgames',
  'xbox',
  'playstation',
  'nintendo',
  'ea',
  'ubisoft',
  'category-games@cn',
  'paypal',
  'amazon',
  'bilibili',
  'douyin',
  'xiaohongshu',
  'weibo',
  'zhihu',
  'baidu',
  'alibaba',
  'taobao',
  'jd',
  'netease',
  'cloudmusic',
  'iqiyi',
  'youku',
  'acfun',
  'pixiv',
  'ehentai'
]

const fallbackGeoipSlugs = [
  'private',
  'cn',
  'google',
  'telegram',
  'twitter',
  'facebook',
  'netflix',
  'cloudflare',
  'cloudfront',
  'fastly',
  'apple',
  'bilibili'
]

function createRemoteRuleOption(
  slug: string,
  behavior: RemoteRuleOption['behavior'],
  fallback = false
): RemoteRuleOption {
  const inferred = inferRemoteRuleCategory(slug, behavior)
  const safeSlug = slug.replace(/[^a-zA-Z0-9_-]/g, '_')
  const path = behavior === 'ipcidr' ? `geo/geoip/${slug}.mrs` : `geo/geosite/${slug}.mrs`
  return {
    name: `metacube_${behavior === 'ipcidr' ? 'geoip' : 'geosite'}_${safeSlug}`,
    label: prettyRuleName(slug, behavior),
    category: inferred.category,
    behavior,
    url: `https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/${path}`,
    recommendedTarget: inferred.recommendedTarget,
    noResolve: behavior === 'ipcidr',
    fallback
  }
}

function createFallbackRemoteRules(): RemoteRuleOption[] {
  return [
    ...fallbackGeositeSlugs.map((slug) => createRemoteRuleOption(slug, 'domain', true)),
    ...fallbackGeoipSlugs.map((slug) => createRemoteRuleOption(slug, 'ipcidr', true))
  ].sort((a, b) => a.label.localeCompare(b.label))
}

function inferRemoteRuleCategory(
  slug: string,
  behavior: RemoteRuleOption['behavior']
): Pick<RemoteRuleOption, 'category' | 'recommendedTarget'> {
  const normalized = slug.toLowerCase()
  if (behavior === 'ipcidr') {
    if (normalized === 'cn' || normalized === 'private') {
      return { category: 'basic', recommendedTarget: '直连' }
    }
    return { category: 'system', recommendedTarget: '默认代理' }
  }
  if (
    /youtube|netflix|disney|spotify|tiktok|hbo|hulu|twitch|bahamut|abema|prime|video|tv|media|biliintl/.test(
      normalized
    )
  ) {
    return { category: 'media', recommendedTarget: '国际媒体' }
  }
  if (
    /telegram|twitter|facebook|instagram|whatsapp|discord|line|social|messenger/.test(normalized)
  ) {
    return { category: 'social', recommendedTarget: '默认代理' }
  }
  if (/openai|anthropic|claude|gemini|copilot|perplexity|ai|category-ai/.test(normalized)) {
    return { category: 'ai', recommendedTarget: 'AI' }
  }
  if (/github|gitlab|docker|npm|developer|dev|microsoft/.test(normalized)) {
    return { category: 'dev', recommendedTarget: '默认代理' }
  }
  if (/steam|epic|xbox|playstation|nintendo|ea|ubisoft|game/.test(normalized)) {
    return { category: 'game', recommendedTarget: '游戏平台' }
  }
  if (
    /cn|china|bilibili|douyin|xiaohongshu|weibo|zhihu|baidu|alibaba|taobao|jd|netease|iqiyi|youku/.test(
      normalized
    )
  ) {
    return { category: 'china', recommendedTarget: '直连' }
  }
  if (/paypal|stripe|amazon|shop|payment|pay/.test(normalized)) {
    return { category: 'payment', recommendedTarget: '默认代理' }
  }
  if (/ads|advert|privacy|reject|tracker/.test(normalized)) {
    return { category: 'privacy', recommendedTarget: '直连' }
  }
  return { category: 'system', recommendedTarget: '默认代理' }
}

const steps = [
  { key: 'basic', label: '基础信息' },
  { key: 'nodes', label: '节点组' },
  { key: 'policies', label: '策略组' },
  { key: 'apps', label: '应用分流' },
  { key: 'preview', label: '预览' }
] as const

type StepKey = (typeof steps)[number]['key']

async function loadMetaCubeRemoteRules(): Promise<RemoteRuleOption[]> {
  if (metaCubeRemoteRulesCache) return metaCubeRemoteRulesCache
  if (metaCubeRemoteRulesPromise) return metaCubeRemoteRulesPromise

  metaCubeRemoteRulesPromise = fetch(remoteRulesIndexUrl, { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) throw new Error(`MetaCubeX rules index fetch failed: ${response.status}`)
      const data = (await response.json()) as RemoteRulesIndex
      const rules =
        data.rules
          ?.filter((rule) => rule.name && rule.label && rule.url)
          .map((rule) => ({ ...rule, fallback: false }))
          .sort((a, b) => a.label.localeCompare(b.label)) || []
      if (!rules.length) return createFallbackRemoteRules()
      metaCubeRemoteRulesCache = rules
      return rules
    })
    .catch(() => {
      const rules = createFallbackRemoteRules()
      metaCubeRemoteRulesCache = rules
      return rules
    })
    .finally(() => {
      metaCubeRemoteRulesPromise = null
    })

  return metaCubeRemoteRulesPromise
}

const SplitOverrideWizardModal: React.FC<Props> = ({ item, addOverrideItem, onClose }) => {
  const [name, setName] = useState(item?.name || '分流覆写')
  const [global, setGlobal] = useState(item?.global ?? false)
  const [nodeGroups, setNodeGroups] = useState<SplitNodeGroup[]>(
    item?.visualConfig?.nodeGroups || defaultNodeGroups
  )
  const [policyGroups, setPolicyGroups] = useState<SplitPolicyGroup[]>(
    item?.visualConfig?.policyGroups || defaultPolicyGroups
  )
  const [appRules, setAppRules] = useState<SplitAppRule[]>(
    item?.visualConfig?.appRules || defaultAppRules
  )
  const [activeStep, setActiveStep] = useState<StepKey>('basic')
  const [draggingRuleId, setDraggingRuleId] = useState<string | null>(null)
  const [librarySearch, setLibrarySearch] = useState('')
  const [libraryCategory, setLibraryCategory] = useState<ProviderCategory | 'all'>('all')
  const [highlightedRuleId, setHighlightedRuleId] = useState<string | null>(null)
  const [remoteRuleDatabase, setRemoteRuleDatabase] = useState<RemoteRuleOption[]>([])
  const [remoteLibraryLoading, setRemoteLibraryLoading] = useState(false)
  const [remoteLibraryError, setRemoteLibraryError] = useState(false)
  const [remoteLibraryAttempted, setRemoteLibraryAttempted] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [saving, setSaving] = useState(false)

  const generated = useMemo(
    () => createSplitOverrideTemplate(nodeGroups, policyGroups, appRules, []),
    [nodeGroups, policyGroups, appRules]
  )
  const targetOptions = ['直连', ...policyGroups.map((group) => group.name)]
  const appRuleProviderNames = new Set(
    appRules.flatMap((rule) => (rule.provider ? [rule.provider] : []))
  )
  const normalizedLibrarySearch = librarySearch.trim().toLowerCase()
  const libraryOptions = providerPresets.filter((provider) => {
    if (libraryCategory !== 'all' && provider.category !== libraryCategory) return false
    if (!normalizedLibrarySearch) return true
    return [provider.name, provider.label, provider.url, ...provider.aliases].some((value) =>
      value.toLowerCase().includes(normalizedLibrarySearch)
    )
  })
  const remoteLibraryOptions = remoteRuleDatabase.filter((provider) => {
    if (libraryCategory !== 'all' && provider.category !== libraryCategory) return false
    if (!normalizedLibrarySearch) return true
    return [provider.name, provider.label, provider.url].some((value) =>
      value.toLowerCase().includes(normalizedLibrarySearch)
    )
  })
  const visibleRemoteLibraryOptions = remoteLibraryOptions.slice(0, 120)
  const remoteLibraryUsingFallback =
    remoteRuleDatabase.length > 0 && remoteRuleDatabase.every((provider) => provider.fallback)
  const addedBuiltinCount = providerPresets.filter((provider) =>
    appRuleProviderNames.has(provider.name)
  ).length
  const availableBuiltinCount = providerPresets.length - addedBuiltinCount
  const categoryEntries = Object.entries(providerCategoryLabels) as Array<
    [ProviderCategory, string]
  >
  const nativeSelectClass =
    'h-9 rounded-md border border-default-200 bg-default-50 px-3 text-sm text-foreground shadow-sm outline-none transition-colors hover:border-default-300 focus:border-primary'
  const panelClass = 'rounded-lg border border-default-100/80 bg-default-50/45'
  const rowClass =
    'rounded-md border border-transparent bg-transparent px-2 py-2 transition-colors hover:bg-default-50'

  const syncRemoteRuleDatabase = (): void => {
    setRemoteLibraryAttempted(true)
    setRemoteLibraryLoading(true)
    setRemoteLibraryError(false)
    loadMetaCubeRemoteRules()
      .then((rules) => {
        setRemoteRuleDatabase(rules)
      })
      .catch(() => {
        setRemoteRuleDatabase([])
        setRemoteLibraryError(true)
      })
      .finally(() => setRemoteLibraryLoading(false))
  }

  useEffect(() => {
    if (
      activeStep !== 'apps' ||
      remoteRuleDatabase.length ||
      remoteLibraryLoading ||
      remoteLibraryAttempted
    ) {
      return
    }
    const timer = window.setTimeout(syncRemoteRuleDatabase, 120)
    return (): void => window.clearTimeout(timer)
  }, [activeStep, remoteRuleDatabase.length, remoteLibraryLoading, remoteLibraryAttempted])

  useEffect(() => {
    if (!highlightedRuleId) return
    const timer = window.setTimeout(() => setHighlightedRuleId(null), 1800)
    return (): void => window.clearTimeout(timer)
  }, [highlightedRuleId])

  const updateNodeGroup = (id: string, patch: Partial<SplitNodeGroup>): void => {
    setNodeGroups((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const updatePolicyGroup = (id: string, patch: Partial<SplitPolicyGroup>): void => {
    const oldName = policyGroups.find((item) => item.id === id)?.name
    setPolicyGroups((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
    if (oldName && patch.name && oldName !== patch.name) {
      setAppRules((items) =>
        items.map((item) => (item.target === oldName ? { ...item, target: patch.name! } : item))
      )
    }
  }

  const updateAppRule = (id: string, patch: Partial<SplitAppRule>): void => {
    setAppRules((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const removeAppRule = (id: string): void => {
    setAppRules((items) => items.filter((item) => item.id !== id))
  }

  const moveAppRule = (activeId: string, overId: string): void => {
    if (activeId === overId) return
    setAppRules((items) => {
      const next = items.slice()
      const activeIndex = next.findIndex((item) => item.id === activeId)
      const overIndex = next.findIndex((item) => item.id === overId)
      if (activeIndex === -1 || overIndex === -1) return items
      const [activeItem] = next.splice(activeIndex, 1)
      if (!activeItem) return items
      next.splice(overIndex, 0, activeItem)
      return next
    })
  }

  const removePolicyGroup = (id: string): void => {
    const removedName = policyGroups.find((item) => item.id === id)?.name
    const nextPolicyGroups = policyGroups.filter((item) => item.id !== id)
    const fallbackTarget =
      nextPolicyGroups.find((item) => item.name === '默认代理')?.name ||
      nextPolicyGroups[0]?.name ||
      '直连'

    setPolicyGroups(nextPolicyGroups)
    if (removedName) {
      setAppRules((items) =>
        items.map((item) =>
          item.target === removedName ? { ...item, target: fallbackTarget } : item
        )
      )
    }
  }

  const addCustomApp = (): void => {
    setActiveStep('apps')
    setAppRules((items) =>
      items.concat({
        id: newId('app'),
        type: 'rule-set',
        name: '新应用',
        behavior: 'domain',
        format: 'mrs',
        url: '',
        target: '默认代理',
        enabled: true
      })
    )
  }

  const validTarget = (target?: string): string => {
    if (!target) return '默认代理'
    return target === '直连' || targetOptions.includes(target) ? target : '默认代理'
  }

  const focusAppRule = (id: string): void => {
    setActiveStep('apps')
    setHighlightedRuleId(id)
  }

  const addBuiltinProvider = (provider: ProviderPreset): void => {
    const existingRule = appRules.find((rule) => rule.provider === provider.name)
    if (existingRule) {
      focusAppRule(existingRule.id)
      return
    }
    const id = `${provider.name}-${newId('preset')}`
    setAppRules((items) =>
      items.concat({
        id,
        type: 'preset',
        provider: provider.name,
        name: provider.label,
        target: validTarget(provider.recommendedTarget),
        enabled: true
      })
    )
    focusAppRule(id)
  }

  const addRemoteProvider = (provider: RemoteRuleOption): void => {
    const existingRule = appRules.find((rule) => rule.url === provider.url)
    if (existingRule) {
      focusAppRule(existingRule.id)
      return
    }
    const id = `${provider.name}-${newId('remote')}`
    setAppRules((items) =>
      items.concat({
        id,
        type: 'rule-set',
        name: provider.label,
        behavior: provider.behavior,
        format: 'mrs',
        url: provider.url,
        target: validTarget(provider.recommendedTarget),
        enabled: true
      })
    )
    focusAppRule(id)
  }

  const toggleBuiltinProvider = (provider: ProviderPreset): void => {
    const existingRule = appRules.find((rule) => rule.provider === provider.name)
    if (existingRule) {
      removeAppRule(existingRule.id)
      return
    }
    addBuiltinProvider(provider)
  }

  const toggleRemoteProvider = (provider: RemoteRuleOption): void => {
    const existingRule = appRules.find((rule) => rule.url === provider.url)
    if (existingRule) {
      removeAppRule(existingRule.id)
      return
    }
    addRemoteProvider(provider)
  }

  const onSave = async (): Promise<void> => {
    setSaving(true)
    try {
      const visualConfig = { nodeGroups, policyGroups, appRules }
      if (item) {
        await addOverrideItem({
          ...item,
          name: name.trim() || '分流覆写',
          global,
          visualType: 'split',
          visualConfig,
          file: generated
        })
      } else {
        await addOverrideItem({
          name: name.trim() || '分流覆写',
          type: 'local',
          ext: 'yaml',
          global,
          visualType: 'split',
          visualConfig,
          file: generated
        })
      }
      onClose()
    } catch (e) {
      alert(e)
    } finally {
      setSaving(false)
    }
  }

  const stepIndex = steps.findIndex((step) => step.key === activeStep)
  const canGoBack = stepIndex > 0
  const canGoNext = stepIndex < steps.length - 1

  const renderAppRule = (rule: SplitAppRule): React.ReactNode => {
    const preset = providerPresets.find((item) => item.name === rule.provider)
    return (
      <Surface
        key={rule.id}
        variant="transparent"
        draggable
        onDragStart={() => setDraggingRuleId(rule.id)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => {
          if (draggingRuleId) moveAppRule(draggingRuleId, rule.id)
          setDraggingRuleId(null)
        }}
        onDragEnd={() => setDraggingRuleId(null)}
        className={`rounded-md border px-2 py-2 transition-colors ${
          highlightedRuleId === rule.id
            ? 'border-primary bg-primary/10'
            : 'border-transparent bg-transparent hover:bg-default-50'
        } ${draggingRuleId === rule.id ? 'opacity-50' : ''}`}
      >
        <div className="grid grid-cols-[22px_24px_minmax(0,1fr)_150px_28px] items-center gap-2">
          <MdDragIndicator className="cursor-grab text-lg text-foreground-400" />
          <Checkbox
            size="sm"
            isSelected={rule.enabled}
            onValueChange={(enabled) => updateAppRule(rule.id, { enabled })}
          />
          {rule.type !== 'preset' ? (
            <Input
              size="sm"
              value={rule.name}
              placeholder="应用名称"
              onValueChange={(value) => updateAppRule(rule.id, { name: value })}
            />
          ) : (
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{preset?.label || rule.name}</div>
              <div className="truncate text-xs text-foreground-500">
                {preset ? providerCategoryLabels[preset.category] : '内置规则'}
              </div>
            </div>
          )}
          <select
            className={nativeSelectClass}
            value={rule.target}
            onChange={(event) => updateAppRule(rule.id, { target: event.target.value })}
          >
            {targetOptions.map((target) => (
              <option key={target} value={target}>
                {target}
              </option>
            ))}
          </select>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            color="danger"
            onPress={() => removeAppRule(rule.id)}
          >
            <MdDeleteForever />
          </Button>
        </div>
        {rule.type !== 'preset' && (
          <>
            <div className="mt-2 grid grid-cols-[150px_1fr] gap-2">
              <select
                className={nativeSelectClass}
                value={rule.type}
                onChange={(event) =>
                  updateAppRule(rule.id, { type: event.target.value as SplitAppRule['type'] })
                }
              >
                <option value="rule-set">在线规则集</option>
                <option value="domain-suffix">域名后缀</option>
                <option value="domain-keyword">域名关键词</option>
                <option value="ip-cidr">IP 段</option>
                <option value="process-name">进程名</option>
              </select>
              {rule.type === 'rule-set' ? (
                <Input
                  size="sm"
                  label="规则集 URL"
                  value={rule.url || ''}
                  placeholder="https://.../xxx.mrs"
                  onValueChange={(value) => updateAppRule(rule.id, { url: value })}
                />
              ) : (
                <Input
                  size="sm"
                  label="匹配内容"
                  value={rule.values || ''}
                  placeholder="多个值用逗号隔开"
                  onValueChange={(value) => updateAppRule(rule.id, { values: value })}
                />
              )}
            </div>
            {rule.type === 'rule-set' && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <select
                  className={nativeSelectClass}
                  value={rule.behavior || 'domain'}
                  onChange={(event) =>
                    updateAppRule(rule.id, {
                      behavior: event.target.value as SplitAppRule['behavior']
                    })
                  }
                >
                  <option value="domain">域名规则</option>
                  <option value="ipcidr">IP 规则</option>
                  <option value="classical">经典规则</option>
                </select>
                <select
                  className={nativeSelectClass}
                  value={rule.format || 'mrs'}
                  onChange={(event) =>
                    updateAppRule(rule.id, {
                      format: event.target.value as SplitAppRule['format']
                    })
                  }
                >
                  <option value="mrs">MRS</option>
                  <option value="yaml">YAML</option>
                  <option value="text">Text/List</option>
                </select>
              </div>
            )}
          </>
        )}
      </Surface>
    )
  }

  const renderContent = (): React.ReactNode => {
    switch (activeStep) {
      case 'basic':
        return (
          <Surface variant="transparent" className="grid gap-3">
            <div>
              <Label className="text-base font-medium">基础信息</Label>
              <p className="mt-1 text-sm text-foreground-500">
                覆写只保存分流策略，不包含机场订阅链接。创建后可在卡片上继续可视化编辑。
              </p>
            </div>
            <Separator variant="tertiary" />
            <div className="grid grid-cols-[116px_minmax(0,1fr)] items-center gap-x-3 gap-y-2">
              <Label className="text-sm text-foreground-500">名称</Label>
              <Input size="sm" value={name} onValueChange={setName} />
              <Label className="text-sm text-foreground-500">全局生效</Label>
              <div className="flex items-center justify-between rounded-md bg-default-50 px-3 py-2">
                <span className="text-sm text-foreground-500">
                  默认关闭，可在订阅里单独选择覆写
                </span>
                <Switch size="sm" isSelected={global} onValueChange={setGlobal} />
              </div>
            </div>
          </Surface>
        )
      case 'nodes':
        return (
          <Surface variant="transparent" className="grid gap-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-medium">节点组</Label>
                <p className="mt-1 text-sm text-foreground-500">
                  用节点名称关键词分类，多个关键词用逗号隔开，例如：港,香港,HK。
                </p>
              </div>
              <Button
                size="sm"
                variant="flat"
                onPress={() =>
                  setNodeGroups((items) =>
                    items.concat({
                      id: newId('node'),
                      name: '新节点组',
                      type: 'url-test',
                      filter: '',
                      interval: 60
                    })
                  )
                }
              >
                <FaPlus /> 添加节点组
              </Button>
            </div>
            <div className={`scrollbar-thin max-h-[470px] overflow-y-auto p-2 ${panelClass}`}>
              <div className="grid gap-2">
                {nodeGroups.map((group) => (
                  <Surface
                    key={group.id}
                    variant="transparent"
                    className="grid gap-2 rounded-md p-2"
                  >
                    <div className="grid grid-cols-[minmax(0,1fr)_140px_92px_28px] gap-2">
                      <Input
                        size="sm"
                        label="节点组名称"
                        value={group.name}
                        onValueChange={(value) => updateNodeGroup(group.id, { name: value })}
                      />
                      <select
                        className={nativeSelectClass}
                        value={group.type}
                        onChange={(event) =>
                          updateNodeGroup(group.id, {
                            type: event.target.value as SplitNodeGroup['type']
                          })
                        }
                      >
                        <option value="url-test">自动选择</option>
                        <option value="select">手动选择</option>
                        <option value="fallback">故障转移</option>
                        <option value="load-balance">负载均衡</option>
                      </select>
                      <Input
                        size="sm"
                        type="number"
                        label="间隔(秒)"
                        value={String(group.interval)}
                        onValueChange={(value) =>
                          updateNodeGroup(group.id, { interval: Number(value) || 60 })
                        }
                      />
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        onPress={() =>
                          setNodeGroups((items) => items.filter((item) => item.id !== group.id))
                        }
                      >
                        <MdDeleteForever />
                      </Button>
                    </div>
                    <Input
                      size="sm"
                      label="匹配关键词"
                      value={group.filter}
                      placeholder="港,香港,HK,Hong Kong"
                      onValueChange={(value) => updateNodeGroup(group.id, { filter: value })}
                    />
                  </Surface>
                ))}
              </div>
            </div>
          </Surface>
        )
      case 'policies':
        return (
          <Surface variant="transparent" className="grid gap-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-medium">策略组</Label>
                <p className="mt-1 text-sm text-foreground-500">
                  应用分流会选择策略组作为出口，每个策略组可勾选允许使用的节点组。
                </p>
              </div>
              <Button
                size="sm"
                variant="flat"
                onPress={() =>
                  setPolicyGroups((items) =>
                    items.concat({
                      id: newId('policy'),
                      name: '新策略组',
                      nodeGroupIds: nodeGroups.map((group) => group.id)
                    })
                  )
                }
              >
                <FaPlus /> 添加策略组
              </Button>
            </div>
            <div className={`scrollbar-thin max-h-[470px] overflow-y-auto p-2 ${panelClass}`}>
              <div className="grid gap-2">
                {policyGroups.map((group) => (
                  <Surface key={group.id} variant="transparent" className="rounded-md p-2">
                    <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto_28px] items-center gap-2">
                      <Input
                        size="sm"
                        value={group.name}
                        onValueChange={(value) => updatePolicyGroup(group.id, { name: value })}
                      />
                      <Chip size="sm" variant="flat">
                        {group.nodeGroupIds.length}/{nodeGroups.length} 个节点组
                      </Chip>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        onPress={() => removePolicyGroup(group.id)}
                      >
                        <MdDeleteForever />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {nodeGroups.map((nodeGroup) => (
                        <Checkbox
                          key={nodeGroup.id}
                          size="sm"
                          isSelected={group.nodeGroupIds.includes(nodeGroup.id)}
                          onValueChange={(checked) => {
                            const next = checked
                              ? Array.from(new Set(group.nodeGroupIds.concat(nodeGroup.id)))
                              : group.nodeGroupIds.filter((id) => id !== nodeGroup.id)
                            updatePolicyGroup(group.id, { nodeGroupIds: next })
                          }}
                        >
                          {nodeGroup.name}
                        </Checkbox>
                      ))}
                    </div>
                  </Surface>
                ))}
              </div>
            </div>
          </Surface>
        )
      case 'apps':
        return (
          <div className="grid min-h-0 gap-3 lg:grid-cols-[0.95fr_1.05fr]">
            <Surface variant="transparent" className={`min-h-0 p-3 ${panelClass}`}>
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <Label className="text-base font-medium">规则库</Label>
                  <p className="mt-1 text-sm text-foreground-500">
                    推荐 {providerPresets.length} / 在线 {remoteRuleDatabase.length || '未同步'} /
                    已添加 {addedBuiltinCount} / 可添加 {availableBuiltinCount}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="flat"
                  isLoading={remoteLibraryLoading}
                  onPress={syncRemoteRuleDatabase}
                >
                  同步在线库
                </Button>
              </div>
              <Input
                size="sm"
                value={librarySearch}
                placeholder="搜索 tiktok、抖音、netflix、telegram、openai..."
                onValueChange={setLibrarySearch}
              />
              <div className="my-3 flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant={libraryCategory === 'all' ? 'solid' : 'flat'}
                  color={libraryCategory === 'all' ? 'primary' : 'default'}
                  onPress={() => setLibraryCategory('all')}
                >
                  全部
                </Button>
                {categoryEntries.map(([key, label]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={libraryCategory === key ? 'solid' : 'flat'}
                    color={libraryCategory === key ? 'primary' : 'default'}
                    onPress={() => setLibraryCategory(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <div className="scrollbar-thin max-h-[348px] overflow-y-auto pr-1">
                <div className="grid gap-1">
                  {libraryOptions.map((provider) => {
                    const existingRule = appRules.find((rule) => rule.provider === provider.name)
                    return (
                      <div key={provider.name} className={rowClass}>
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() =>
                              existingRule
                                ? focusAppRule(existingRule.id)
                                : addBuiltinProvider(provider)
                            }
                          >
                            <div className="truncate text-sm font-medium">{provider.label}</div>
                            <div className="truncate text-xs text-foreground-500">
                              {providerCategoryLabels[provider.category]} ·{' '}
                              {provider.behavior === 'ipcidr' ? 'IP 规则' : '域名规则'}
                            </div>
                          </button>
                          <Button
                            size="sm"
                            variant={existingRule ? 'flat' : 'light'}
                            color={existingRule ? 'danger' : 'primary'}
                            onPress={() => toggleBuiltinProvider(provider)}
                          >
                            {existingRule ? '移除' : '添加'}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                  {(remoteRuleDatabase.length > 0 ||
                    remoteLibraryLoading ||
                    remoteLibraryError) && (
                    <div className="mt-2">
                      <div className="mb-2 text-xs font-medium text-foreground-500">
                        MetaCubeX 在线规则
                        {remoteLibraryLoading ? ' · 同步中...' : ''}
                        {remoteLibraryError ? ' · 同步失败，请检查网络或稍后重试' : ''}
                        {remoteLibraryUsingFallback ? ' · 正在使用本地索引' : ''}
                        {remoteRuleDatabase.length > 0
                          ? ` · 当前显示 ${visibleRemoteLibraryOptions.length}/${remoteLibraryOptions.length}`
                          : ''}
                      </div>
                      {visibleRemoteLibraryOptions.map((provider) => {
                        const existingRule = appRules.find((rule) => rule.url === provider.url)
                        return (
                          <div
                            key={provider.name}
                            className={`mb-1.5 w-full text-left ${rowClass}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                className="min-w-0 flex-1 text-left"
                                onClick={() =>
                                  existingRule
                                    ? focusAppRule(existingRule.id)
                                    : addRemoteProvider(provider)
                                }
                              >
                                <div className="truncate text-sm font-medium">{provider.label}</div>
                                <div className="truncate text-xs text-foreground-500">
                                  MetaCubeX · {providerCategoryLabels[provider.category]} ·{' '}
                                  {provider.behavior === 'ipcidr' ? 'IP' : '域名'}
                                </div>
                              </button>
                              <Button
                                size="sm"
                                variant={existingRule ? 'flat' : 'light'}
                                color={existingRule ? 'danger' : 'primary'}
                                onPress={() => toggleRemoteProvider(provider)}
                              >
                                {existingRule ? '移除' : '添加'}
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </Surface>
            <Surface variant="transparent" className={`min-h-0 p-3 ${panelClass}`}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">已添加应用规则</Label>
                  <p className="mt-1 text-sm text-foreground-500">
                    按从上到下的顺序匹配，可拖动调整优先级。
                  </p>
                </div>
                <Button size="sm" variant="flat" onPress={addCustomApp}>
                  高级规则
                </Button>
              </div>
              <div className="scrollbar-thin max-h-[500px] overflow-y-auto pr-1">
                <div className="grid gap-1">{appRules.map(renderAppRule)}</div>
              </div>
            </Surface>
          </div>
        )
      case 'preview':
        return (
          <Surface variant="transparent" className="grid gap-3">
            <div>
              <Label className="text-base font-medium">生成预览</Label>
              <p className="mt-1 text-sm text-foreground-500">
                普通用户无需编辑这里；保存时会把当前可视化配置同步生成 YAML。
              </p>
            </div>
            <Button
              size="sm"
              variant="flat"
              className="w-fit"
              onPress={() => setShowPreview((value) => !value)}
            >
              {showPreview ? '收起 YAML' : '查看 YAML'}
            </Button>
            {showPreview && (
              <textarea
                readOnly
                className="min-h-[420px] resize-y rounded-lg border border-default-200 bg-default-50 p-3 font-mono text-xs outline-none"
                value={generated}
              />
            )}
          </Surface>
        )
    }
  }

  return (
    <Modal>
      <Modal.Backdrop
        isOpen={true}
        onOpenChange={onClose}
        variant="blur"
        className="top-12 h-[calc(100%-48px)]"
      >
        <Modal.Container scroll="inside">
          <Modal.Dialog className="max-h-[calc(100%-72px)] w-[min(960px,calc(100%-24px))] max-w-none">
            <Modal.Header className="app-drag pb-1">
              <div className="flex w-full items-center justify-between gap-3">
                <Modal.Heading>{item ? '编辑分流覆写' : '创建分流覆写'}</Modal.Heading>
                <div className="mr-2 flex rounded-lg bg-default-50 p-1">
                  {steps.map((step, index) => (
                    <Button
                      key={step.key}
                      size="sm"
                      variant={activeStep === step.key ? 'solid' : 'light'}
                      color={activeStep === step.key ? 'primary' : 'default'}
                      className="h-8 px-3"
                      onPress={() => setActiveStep(step.key)}
                    >
                      {index + 1}. {step.label}
                    </Button>
                  ))}
                </div>
              </div>
            </Modal.Header>
            <Modal.Body className="no-scrollbar max-h-[calc(100vh-190px)] overflow-y-auto px-8 py-3">
              {renderContent()}
            </Modal.Body>
            <Modal.Footer className="justify-between pt-2">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="flat"
                  isDisabled={!canGoBack}
                  onPress={() => setActiveStep(steps[stepIndex - 1].key)}
                >
                  上一步
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  isDisabled={!canGoNext}
                  onPress={() => setActiveStep(steps[stepIndex + 1].key)}
                >
                  下一步
                </Button>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="light" onPress={onClose}>
                  取消
                </Button>
                <Button size="sm" color="primary" isLoading={saving} onPress={onSave}>
                  {item ? '保存覆写' : '创建覆写'}
                </Button>
              </div>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

export default SplitOverrideWizardModal
