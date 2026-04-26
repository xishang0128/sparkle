#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'

const categories = [
  'basic',
  'media',
  'social',
  'ai',
  'dev',
  'game',
  'china',
  'payment',
  'system',
  'privacy'
]

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

/**
 * @returns {{ source: string, out: string }}
 */
function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    source: '',
    out: 'public/rules-index.json'
  }
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--source') options.source = args[++index] || ''
    if (arg === '--out') options.out = args[++index] || options.out
  }
  return options
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function walkFiles(dir) {
  const items = []
  for (const name of readdirSync(dir)) {
    const fullPath = join(dir, name)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      items.push(...walkFiles(fullPath))
    } else {
      items.push(fullPath)
    }
  }
  return items
}

/**
 * @param {string} slug
 * @param {'domain' | 'ipcidr'} behavior
 * @returns {string}
 */
function prettyRuleName(slug, behavior) {
  const known = new Map([
    ['cn', '中国'],
    ['geolocation-!cn', '非中国域名'],
    ['category-ads-all', '广告拦截'],
    ['category-ai-!cn', 'AI'],
    ['category-games@cn', '国内游戏'],
    ['apple-cn', 'Apple CN'],
    ['microsoft@cn', 'Microsoft CN'],
    ['steam@cn', 'Steam CN'],
    ['biliintl', 'Bilibili 国际版'],
    ['cloudmusic', '网易云音乐'],
    ['primevideo', 'Prime Video'],
    ['epicgames', 'Epic Games']
  ])
  const label =
    known.get(slug) ||
    slug
      .split(/[-_@]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  return behavior === 'ipcidr' ? `${label} IP` : label
}

/**
 * @param {string} slug
 * @param {'domain' | 'ipcidr'} behavior
 * @returns {{ category: string, recommendedTarget: string }}
 */
function inferCategory(slug, behavior) {
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

/**
 * @param {string} slug
 * @param {'domain' | 'ipcidr'} behavior
 * @returns {{
 *   name: string,
 *   label: string,
 *   category: string,
 *   behavior: 'domain' | 'ipcidr',
 *   format: 'mrs',
 *   url: string,
 *   recommendedTarget: string,
 *   noResolve: boolean
 * }}
 */
function createRule(slug, behavior) {
  const inferred = inferCategory(slug, behavior)
  const safeSlug = slug.replace(/[^a-zA-Z0-9_-]/g, '_')
  const folder = behavior === 'ipcidr' ? 'geoip' : 'geosite'
  return {
    name: `metacube_${folder}_${safeSlug}`,
    label: prettyRuleName(slug, behavior),
    category: categories.includes(inferred.category) ? inferred.category : 'system',
    behavior,
    format: 'mrs',
    url: `https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/${folder}/${slug}.mrs`,
    recommendedTarget: inferred.recommendedTarget,
    noResolve: behavior === 'ipcidr'
  }
}

/**
 * @param {string} source
 * @returns {{ geosite: string[], geoip: string[] } | null}
 */
function slugsFromSource(source) {
  if (!source) return null
  const sourceRoot = resolve(source)
  const files = walkFiles(sourceRoot)
  const geosite = new Set()
  const geoip = new Set()
  for (const file of files) {
    const normalized = relative(sourceRoot, file).split(sep).join('/')
    const geositeMatch = normalized.match(/^geo\/geosite\/(.+)\.mrs$/)
    if (geositeMatch?.[1]) geosite.add(geositeMatch[1])
    const geoipMatch = normalized.match(/^geo\/geoip\/(.+)\.mrs$/)
    if (geoipMatch?.[1]) geoip.add(geoipMatch[1])
  }
  return {
    geosite: Array.from(geosite),
    geoip: Array.from(geoip)
  }
}

const options = parseArgs()
const discovered = slugsFromSource(options.source)
const geositeSlugs = discovered?.geosite?.length ? discovered.geosite : fallbackGeositeSlugs
const geoipSlugs = discovered?.geoip?.length ? discovered.geoip : fallbackGeoipSlugs
const generatedAt = new Date().toISOString()
const rules = [
  ...geositeSlugs.map((slug) => createRule(slug, 'domain')),
  ...geoipSlugs.map((slug) => createRule(slug, 'ipcidr'))
].sort((a, b) => a.label.localeCompare(b.label))

const output = {
  version: 1,
  source: 'MetaCubeX/meta-rules-dat@meta',
  generatedAt,
  total: rules.length,
  rules
}

writeFileSync(resolve(options.out), `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(`Generated ${rules.length} rules -> ${options.out}`)
