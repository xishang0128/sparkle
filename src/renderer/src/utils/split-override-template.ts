export interface SplitNodeGroup {
  id: string
  name: string
  type: 'select' | 'url-test' | 'fallback' | 'load-balance'
  filter: string
  interval: number
}

export interface SplitPolicyGroup {
  id: string
  name: string
  nodeGroupIds: string[]
}

export interface SplitAppRule {
  id: string
  type: 'preset' | 'rule-set' | 'domain-suffix' | 'domain-keyword' | 'ip-cidr' | 'process-name'
  provider?: string
  behavior?: 'domain' | 'ipcidr' | 'classical'
  format?: 'mrs' | 'yaml' | 'text'
  url?: string
  name: string
  values?: string
  target: string
  enabled: boolean
}

export type ProviderCategory =
  | 'basic'
  | 'media'
  | 'social'
  | 'ai'
  | 'dev'
  | 'game'
  | 'china'
  | 'payment'
  | 'system'
  | 'privacy'

export interface ProviderPreset {
  name: string
  label: string
  category: ProviderCategory
  aliases: string[]
  recommendedTarget?: string
  behavior: 'domain' | 'ipcidr' | 'classical'
  format: 'mrs' | 'text'
  url: string
  noResolve?: boolean
}

type ProviderPresetInput = Omit<ProviderPreset, 'category' | 'aliases'> &
  Partial<Pick<ProviderPreset, 'category' | 'aliases'>>

const providerCategoryNames: Record<ProviderCategory, string> = {
  basic: '基础规则',
  media: '国际媒体',
  social: '社交通讯',
  ai: 'AI',
  dev: '开发服务',
  game: '游戏平台',
  china: '国内服务',
  payment: '支付购物',
  system: '系统服务',
  privacy: '广告/隐私'
}

export const providerCategoryLabels = providerCategoryNames

const providerMetadata: Record<
  string,
  Partial<Pick<ProviderPreset, 'category' | 'aliases' | 'recommendedTarget'>>
> = {
  private_ip: { category: 'basic', aliases: ['private', 'lan'], recommendedTarget: '直连' },
  private_domain: { category: 'basic', aliases: ['private', 'lan'], recommendedTarget: '直连' },
  youtube_domain: { category: 'media', aliases: ['油管', 'yt'], recommendedTarget: '国际媒体' },
  google_domain: { category: 'system', aliases: ['谷歌'], recommendedTarget: '默认代理' },
  google_ip: { category: 'system', aliases: ['谷歌 ip'], recommendedTarget: '默认代理' },
  bilibili_domain: { category: 'china', aliases: ['哔哩哔哩', 'b站'], recommendedTarget: '直连' },
  biliintl_domain: {
    category: 'media',
    aliases: ['b站国际版', 'bilibili international'],
    recommendedTarget: '国际媒体'
  },
  acfun_domain: { category: 'china', aliases: ['a站'], recommendedTarget: '直连' },
  iqiyi_domain: { category: 'china', aliases: ['爱奇艺'], recommendedTarget: '直连' },
  youku_domain: { category: 'china', aliases: ['优酷'], recommendedTarget: '直连' },
  douyin_domain: { category: 'china', aliases: ['抖音'], recommendedTarget: '直连' },
  xiaohongshu_domain: {
    category: 'china',
    aliases: ['小红书', 'rednote'],
    recommendedTarget: '直连'
  },
  weibo_domain: { category: 'china', aliases: ['微博'], recommendedTarget: '直连' },
  zhihu_domain: { category: 'china', aliases: ['知乎'], recommendedTarget: '直连' },
  baidu_domain: { category: 'china', aliases: ['百度'], recommendedTarget: '直连' },
  alibaba_domain: { category: 'china', aliases: ['阿里', '阿里巴巴'], recommendedTarget: '直连' },
  taobao_domain: { category: 'payment', aliases: ['淘宝'], recommendedTarget: '直连' },
  jd_domain: { category: 'payment', aliases: ['京东'], recommendedTarget: '直连' },
  netease_domain: { category: 'china', aliases: ['网易'], recommendedTarget: '直连' },
  cloudmusic_domain: { category: 'china', aliases: ['网易云音乐'], recommendedTarget: '直连' },
  github_domain: { category: 'dev', aliases: ['代码', '开发'], recommendedTarget: '默认代理' },
  ai: {
    category: 'ai',
    aliases: ['人工智能', 'chatgpt', 'claude', 'gemini'],
    recommendedTarget: 'AI'
  },
  openai_domain: { category: 'ai', aliases: ['chatgpt', 'open ai'], recommendedTarget: 'AI' },
  claude_domain: { category: 'ai', aliases: ['anthropic'], recommendedTarget: 'AI' },
  gemini_domain: { category: 'ai', aliases: ['google ai', 'bard'], recommendedTarget: 'AI' },
  copilot_domain: { category: 'ai', aliases: ['github copilot'], recommendedTarget: 'AI' },
  perplexity_domain: { category: 'ai', aliases: ['pplx'], recommendedTarget: 'AI' },
  telegram_domain: { category: 'social', aliases: ['tg', '电报'], recommendedTarget: '默认代理' },
  telegram_ip: { category: 'social', aliases: ['tg ip', '电报 ip'], recommendedTarget: '默认代理' },
  twitter_domain: { category: 'social', aliases: ['x', '推特'], recommendedTarget: '默认代理' },
  twitter_ip: { category: 'social', aliases: ['x ip', '推特 ip'], recommendedTarget: '默认代理' },
  facebook_domain: { category: 'social', aliases: ['meta', '脸书'], recommendedTarget: '默认代理' },
  facebook_ip: {
    category: 'social',
    aliases: ['meta ip', '脸书 ip'],
    recommendedTarget: '默认代理'
  },
  instagram_domain: { category: 'social', aliases: ['ig'], recommendedTarget: '默认代理' },
  whatsapp_domain: { category: 'social', aliases: ['wa'], recommendedTarget: '默认代理' },
  discord_domain: { category: 'social', aliases: ['dc'], recommendedTarget: '默认代理' },
  line_domain: { category: 'social', aliases: ['连我'], recommendedTarget: '默认代理' },
  netflix_domain: { category: 'media', aliases: ['奈飞'], recommendedTarget: '国际媒体' },
  netflix_ip: { category: 'media', aliases: ['奈飞 ip'], recommendedTarget: '国际媒体' },
  tiktok_domain: { category: 'media', aliases: ['海外抖音'], recommendedTarget: '国际媒体' },
  spotify_domain: { category: 'media', aliases: ['音乐'], recommendedTarget: '国际媒体' },
  disney_domain: { category: 'media', aliases: ['disney plus'], recommendedTarget: '国际媒体' },
  primevideo_domain: {
    category: 'media',
    aliases: ['amazon prime'],
    recommendedTarget: '国际媒体'
  },
  hbo_domain: { category: 'media', aliases: ['max'], recommendedTarget: '国际媒体' },
  hulu_domain: { category: 'media', aliases: ['hulu'], recommendedTarget: '国际媒体' },
  twitch_domain: { category: 'media', aliases: ['直播'], recommendedTarget: '国际媒体' },
  paypal_domain: { category: 'payment', aliases: ['支付'], recommendedTarget: '默认代理' },
  pixiv_domain: { category: 'media', aliases: ['p站'], recommendedTarget: '默认代理' },
  ehentai_domain: { category: 'media', aliases: ['eh'], recommendedTarget: '默认代理' },
  bahamut_domain: { category: 'media', aliases: ['巴哈姆特'], recommendedTarget: '国际媒体' },
  abema_domain: { category: 'media', aliases: ['abema tv'], recommendedTarget: '国际媒体' },
  steam_domain: { category: 'game', aliases: ['steam 商店'], recommendedTarget: '游戏平台' },
  steamcn_domain: { category: 'game', aliases: ['steam 中国'], recommendedTarget: '直连' },
  epic_domain: { category: 'game', aliases: ['epic games'], recommendedTarget: '游戏平台' },
  xbox_domain: { category: 'game', aliases: ['微软游戏'], recommendedTarget: '游戏平台' },
  playstation_domain: { category: 'game', aliases: ['psn', 'sony'], recommendedTarget: '游戏平台' },
  nintendo_domain: {
    category: 'game',
    aliases: ['任天堂', 'switch'],
    recommendedTarget: '游戏平台'
  },
  ea_domain: { category: 'game', aliases: ['origin'], recommendedTarget: '游戏平台' },
  ubisoft_domain: { category: 'game', aliases: ['育碧'], recommendedTarget: '游戏平台' },
  apple_domain: { category: 'system', aliases: ['苹果中国'], recommendedTarget: '直连' },
  apple_global_domain: { category: 'system', aliases: ['苹果'], recommendedTarget: '默认代理' },
  apple_ip: { category: 'system', aliases: ['苹果 ip'], recommendedTarget: '默认代理' },
  applemusic_domain: { category: 'media', aliases: ['苹果音乐'], recommendedTarget: '国际媒体' },
  onedrive_domain: { category: 'system', aliases: ['微软网盘'], recommendedTarget: '直连' },
  microsoft_cn_domain: { category: 'system', aliases: ['微软中国'], recommendedTarget: '直连' },
  microsoft_domain: { category: 'system', aliases: ['微软'], recommendedTarget: '默认代理' },
  cloudflare_domain: { category: 'system', aliases: ['cf'], recommendedTarget: '默认代理' },
  cloudflare_ip: { category: 'system', aliases: ['cf ip'], recommendedTarget: '默认代理' },
  category_games_cn_domain: { category: 'game', aliases: ['国内游戏'], recommendedTarget: '直连' },
  category_ads_domain: {
    category: 'privacy',
    aliases: ['广告', '去广告'],
    recommendedTarget: '直连'
  },
  tracker_domain: { category: 'privacy', aliases: ['bt tracker'], recommendedTarget: '直连' },
  proxy_domain: { category: 'basic', aliases: ['代理常用'], recommendedTarget: '默认代理' },
  cn_domain: { category: 'basic', aliases: ['中国域名'], recommendedTarget: '直连' },
  cn_ip: { category: 'basic', aliases: ['中国 ip'], recommendedTarget: '直连' },
  'geolocation-!cn': {
    category: 'basic',
    aliases: ['非中国', '海外域名'],
    recommendedTarget: '默认代理'
  }
}

function enrichProviderPresets(items: ProviderPresetInput[]): ProviderPreset[] {
  return items.map((item) => {
    const metadata = providerMetadata[item.name] || {}
    return {
      ...item,
      category: item.category || metadata.category || 'system',
      aliases: Array.from(new Set([...(item.aliases || []), ...(metadata.aliases || [])])),
      recommendedTarget: item.recommendedTarget || metadata.recommendedTarget
    }
  })
}

export const providerPresets: ProviderPreset[] = enrichProviderPresets([
  {
    name: 'private_ip',
    label: '私有 IP',
    behavior: 'ipcidr',
    format: 'mrs',
    url: 'https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geoip/private.mrs',
    noResolve: true
  },
  {
    name: 'private_domain',
    label: '私有域名',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/private.mrs'
  },
  {
    name: 'youtube_domain',
    label: 'YouTube',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/youtube.mrs'
  },
  {
    name: 'google_domain',
    label: 'Google',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/google.mrs'
  },
  {
    name: 'google_ip',
    label: 'Google IP',
    behavior: 'ipcidr',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/google.mrs',
    noResolve: true
  },
  {
    name: 'bilibili_domain',
    label: 'Bilibili',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/bilibili.mrs'
  },
  {
    name: 'biliintl_domain',
    label: 'Bilibili 国际版',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/biliintl.mrs'
  },
  {
    name: 'acfun_domain',
    label: 'AcFun',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/acfun.mrs'
  },
  {
    name: 'iqiyi_domain',
    label: '爱奇艺 / iQIYI',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/iqiyi.mrs'
  },
  {
    name: 'youku_domain',
    label: '优酷 / Youku',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/youku.mrs'
  },
  {
    name: 'douyin_domain',
    label: '抖音 / Douyin',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/douyin.mrs'
  },
  {
    name: 'xiaohongshu_domain',
    label: '小红书 / Xiaohongshu',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/xiaohongshu.mrs'
  },
  {
    name: 'weibo_domain',
    label: '微博 / Weibo',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/weibo.mrs'
  },
  {
    name: 'zhihu_domain',
    label: '知乎 / Zhihu',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/zhihu.mrs'
  },
  {
    name: 'baidu_domain',
    label: '百度 / Baidu',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/baidu.mrs'
  },
  {
    name: 'alibaba_domain',
    label: '阿里巴巴 / Alibaba',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/alibaba.mrs'
  },
  {
    name: 'taobao_domain',
    label: '淘宝 / Taobao',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/taobao.mrs'
  },
  {
    name: 'jd_domain',
    label: '京东 / JD',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/jd.mrs'
  },
  {
    name: 'netease_domain',
    label: '网易 / NetEase',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/netease.mrs'
  },
  {
    name: 'cloudmusic_domain',
    label: '网易云音乐',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/cloudmusic.mrs'
  },
  {
    name: 'github_domain',
    label: 'GitHub',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/github.mrs'
  },
  {
    name: 'ai',
    label: 'AI',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/category-ai-!cn.mrs'
  },
  {
    name: 'openai_domain',
    label: 'OpenAI / ChatGPT',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/openai.mrs'
  },
  {
    name: 'claude_domain',
    label: 'Claude / Anthropic',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/category-ai-!cn.mrs'
  },
  {
    name: 'gemini_domain',
    label: 'Gemini',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/category-ai-!cn.mrs'
  },
  {
    name: 'copilot_domain',
    label: 'GitHub Copilot',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/category-ai-!cn.mrs'
  },
  {
    name: 'perplexity_domain',
    label: 'Perplexity',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/category-ai-!cn.mrs'
  },
  {
    name: 'telegram_domain',
    label: 'Telegram',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/telegram.mrs'
  },
  {
    name: 'telegram_ip',
    label: 'Telegram IP',
    behavior: 'ipcidr',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/telegram.mrs',
    noResolve: true
  },
  {
    name: 'twitter_domain',
    label: 'X / Twitter',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/twitter.mrs'
  },
  {
    name: 'twitter_ip',
    label: 'X / Twitter IP',
    behavior: 'ipcidr',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/twitter.mrs',
    noResolve: true
  },
  {
    name: 'facebook_domain',
    label: 'Facebook / Instagram',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/facebook.mrs'
  },
  {
    name: 'facebook_ip',
    label: 'Facebook IP',
    behavior: 'ipcidr',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/facebook.mrs',
    noResolve: true
  },
  {
    name: 'instagram_domain',
    label: 'Instagram',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/instagram.mrs'
  },
  {
    name: 'whatsapp_domain',
    label: 'WhatsApp',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/whatsapp.mrs'
  },
  {
    name: 'discord_domain',
    label: 'Discord',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/discord.mrs'
  },
  {
    name: 'line_domain',
    label: 'Line',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/line.mrs'
  },
  {
    name: 'netflix_domain',
    label: 'NETFLIX',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/netflix.mrs'
  },
  {
    name: 'netflix_ip',
    label: 'NETFLIX IP',
    behavior: 'ipcidr',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/netflix.mrs',
    noResolve: true
  },
  {
    name: 'tiktok_domain',
    label: 'TikTok',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/tiktok.mrs'
  },
  {
    name: 'spotify_domain',
    label: 'Spotify',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/spotify.mrs'
  },
  {
    name: 'disney_domain',
    label: 'Disney+',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/disney.mrs'
  },
  {
    name: 'primevideo_domain',
    label: 'Prime Video',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/primevideo.mrs'
  },
  {
    name: 'hbo_domain',
    label: 'HBO',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/hbo.mrs'
  },
  {
    name: 'hulu_domain',
    label: 'Hulu',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/hulu.mrs'
  },
  {
    name: 'twitch_domain',
    label: 'Twitch',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/twitch.mrs'
  },
  {
    name: 'paypal_domain',
    label: 'PayPal',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/paypal.mrs'
  },
  {
    name: 'pixiv_domain',
    label: 'Pixiv',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/pixiv.mrs'
  },
  {
    name: 'ehentai_domain',
    label: 'EHentai',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/ehentai.mrs'
  },
  {
    name: 'bahamut_domain',
    label: 'Bahamut',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/bahamut.mrs'
  },
  {
    name: 'abema_domain',
    label: 'Abema',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/abema.mrs'
  },
  {
    name: 'steam_domain',
    label: 'Steam',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/steam.mrs'
  },
  {
    name: 'steamcn_domain',
    label: 'Steam CN',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/steam@cn.mrs'
  },
  {
    name: 'epic_domain',
    label: 'Epic Games',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/epicgames.mrs'
  },
  {
    name: 'xbox_domain',
    label: 'Xbox',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/xbox.mrs'
  },
  {
    name: 'playstation_domain',
    label: 'PlayStation',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/playstation.mrs'
  },
  {
    name: 'nintendo_domain',
    label: 'Nintendo',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/nintendo.mrs'
  },
  {
    name: 'ea_domain',
    label: 'EA',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/ea.mrs'
  },
  {
    name: 'ubisoft_domain',
    label: 'Ubisoft',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/ubisoft.mrs'
  },
  {
    name: 'apple_domain',
    label: 'Apple CN',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/apple-cn.mrs'
  },
  {
    name: 'apple_global_domain',
    label: 'Apple',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/apple.mrs'
  },
  {
    name: 'apple_ip',
    label: 'Apple IP',
    behavior: 'ipcidr',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/apple.mrs',
    noResolve: true
  },
  {
    name: 'applemusic_domain',
    label: 'Apple Music',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/applemusic.mrs'
  },
  {
    name: 'onedrive_domain',
    label: 'OneDrive',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/onedrive.mrs'
  },
  {
    name: 'microsoft_cn_domain',
    label: 'Microsoft CN',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/microsoft@cn.mrs'
  },
  {
    name: 'microsoft_domain',
    label: 'Microsoft',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/microsoft.mrs'
  },
  {
    name: 'cloudflare_domain',
    label: 'Cloudflare',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/cloudflare.mrs'
  },
  {
    name: 'cloudflare_ip',
    label: 'Cloudflare IP',
    behavior: 'ipcidr',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/cloudflare.mrs',
    noResolve: true
  },
  {
    name: 'category_games_cn_domain',
    label: '国内游戏',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/category-games@cn.mrs'
  },
  {
    name: 'category_ads_domain',
    label: '广告拦截',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/category-ads-all.mrs'
  },
  {
    name: 'tracker_domain',
    label: 'Tracker',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/tracker.mrs'
  },
  {
    name: 'proxy_domain',
    label: 'Proxy 常用域名',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/proxy.mrs'
  },
  {
    name: 'cn_domain',
    label: '中国域名',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/cn.mrs'
  },
  {
    name: 'cn_ip',
    label: '中国 IP',
    behavior: 'ipcidr',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/cn.mrs',
    noResolve: true
  },
  {
    name: 'geolocation-!cn',
    label: '非中国域名',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/geolocation-!cn.mrs'
  }
])

export const defaultNodeGroups: SplitNodeGroup[] = [
  {
    id: 'hk',
    name: '香港自动',
    type: 'url-test',
    filter: '港,香港,HK,Hong Kong',
    interval: 60
  },
  {
    id: 'jp',
    name: '日本自动',
    type: 'url-test',
    filter: '日,日本,JP,Japan',
    interval: 60
  },
  {
    id: 'tw',
    name: '台湾自动',
    type: 'url-test',
    filter: '台,台湾,TW,Taiwan',
    interval: 60
  },
  {
    id: 'sg',
    name: '新加坡自动',
    type: 'url-test',
    filter: '新加坡,坡,狮城,SG,Singapore',
    interval: 60
  },
  {
    id: 'us',
    name: '美国自动',
    type: 'url-test',
    filter: '美,美国,US,States,America',
    interval: 60
  },
  {
    id: 'all',
    name: '所有自动',
    type: 'url-test',
    filter: '^(?!.*(?i:DIRECT|REJECT|直连|拒绝)).*$',
    interval: 300
  }
]

export const defaultPolicyGroups: SplitPolicyGroup[] = [
  { id: 'default', name: '默认代理', nodeGroupIds: ['hk', 'jp', 'tw', 'sg', 'us', 'all'] },
  { id: 'media', name: '国际媒体', nodeGroupIds: ['hk', 'jp', 'tw', 'sg', 'us', 'all'] },
  { id: 'ai', name: 'AI', nodeGroupIds: ['hk', 'jp', 'tw', 'sg', 'us', 'all'] },
  { id: 'game', name: '游戏平台', nodeGroupIds: ['hk', 'jp', 'tw', 'sg', 'us', 'all'] }
]

export const defaultAppRules: SplitAppRule[] = [
  {
    id: 'private_ip',
    type: 'preset',
    provider: 'private_ip',
    name: '私有 IP',
    target: '直连',
    enabled: true
  },
  {
    id: 'private_domain',
    type: 'preset',
    provider: 'private_domain',
    name: '私有域名',
    target: '直连',
    enabled: true
  },
  {
    id: 'youtube_domain',
    type: 'preset',
    provider: 'youtube_domain',
    name: 'YouTube',
    target: '国际媒体',
    enabled: true
  },
  {
    id: 'google_domain',
    type: 'preset',
    provider: 'google_domain',
    name: 'Google',
    target: '默认代理',
    enabled: true
  },
  {
    id: 'google_ip',
    type: 'preset',
    provider: 'google_ip',
    name: 'Google IP',
    target: '默认代理',
    enabled: true
  },
  {
    id: 'bilibili_domain',
    type: 'preset',
    provider: 'bilibili_domain',
    name: 'Bilibili',
    target: '直连',
    enabled: true
  },
  { id: 'ai', type: 'preset', provider: 'ai', name: 'AI', target: 'AI', enabled: true },
  {
    id: 'github_domain',
    type: 'preset',
    provider: 'github_domain',
    name: 'GitHub',
    target: '默认代理',
    enabled: true
  },
  {
    id: 'telegram_domain',
    type: 'preset',
    provider: 'telegram_domain',
    name: 'Telegram',
    target: '默认代理',
    enabled: true
  },
  {
    id: 'telegram_ip',
    type: 'preset',
    provider: 'telegram_ip',
    name: 'Telegram IP',
    target: '默认代理',
    enabled: true
  },
  {
    id: 'twitter_domain',
    type: 'preset',
    provider: 'twitter_domain',
    name: 'X / Twitter',
    target: '默认代理',
    enabled: true
  },
  {
    id: 'netflix_domain',
    type: 'preset',
    provider: 'netflix_domain',
    name: 'NETFLIX',
    target: '国际媒体',
    enabled: true
  },
  {
    id: 'netflix_ip',
    type: 'preset',
    provider: 'netflix_ip',
    name: 'NETFLIX IP',
    target: '国际媒体',
    enabled: true
  },
  {
    id: 'tiktok_domain',
    type: 'preset',
    provider: 'tiktok_domain',
    name: 'TikTok',
    target: '国际媒体',
    enabled: true
  },
  {
    id: 'spotify_domain',
    type: 'preset',
    provider: 'spotify_domain',
    name: 'Spotify',
    target: '国际媒体',
    enabled: true
  },
  {
    id: 'paypal_domain',
    type: 'preset',
    provider: 'paypal_domain',
    name: 'PayPal',
    target: '默认代理',
    enabled: true
  },
  {
    id: 'steamcn_domain',
    type: 'preset',
    provider: 'steamcn_domain',
    name: 'Steam CN',
    target: '直连',
    enabled: true
  },
  {
    id: 'steam_domain',
    type: 'preset',
    provider: 'steam_domain',
    name: 'Steam',
    target: '游戏平台',
    enabled: true
  },
  {
    id: 'apple_domain',
    type: 'preset',
    provider: 'apple_domain',
    name: 'Apple CN',
    target: '直连',
    enabled: true
  },
  {
    id: 'onedrive_domain',
    type: 'preset',
    provider: 'onedrive_domain',
    name: 'OneDrive',
    target: '直连',
    enabled: true
  },
  {
    id: 'microsoft_cn_domain',
    type: 'preset',
    provider: 'microsoft_cn_domain',
    name: 'Microsoft CN',
    target: '直连',
    enabled: true
  },
  {
    id: 'cn_domain',
    type: 'preset',
    provider: 'cn_domain',
    name: '中国域名',
    target: '直连',
    enabled: true
  },
  {
    id: 'cn_ip',
    type: 'preset',
    provider: 'cn_ip',
    name: '中国 IP',
    target: '直连',
    enabled: true
  },
  {
    id: 'geolocation-!cn',
    type: 'preset',
    provider: 'geolocation-!cn',
    name: '非中国域名',
    target: '默认代理',
    enabled: true
  }
]

function yamlQuote(value: string): string {
  return JSON.stringify(value)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function groupFilter(filter: string): string {
  if (filter.startsWith('^')) return filter
  const keywords = filter
    .split(/[,，]/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map(escapeRegExp)
  if (keywords.length === 0) return '.*'
  return `(?i)(${keywords.join('|')})`
}

function splitKeywords(value: string): string[] {
  return value
    .split(/[,，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function appRuleProviderName(rule: SplitAppRule): string {
  return `custom_${rule.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`
}

function customRuleType(rule: SplitAppRule): string {
  switch (rule.type) {
    case 'domain-suffix':
      return 'DOMAIN-SUFFIX'
    case 'domain-keyword':
      return 'DOMAIN-KEYWORD'
    case 'ip-cidr':
      return 'IP-CIDR'
    case 'process-name':
      return 'PROCESS-NAME'
    default:
      return ''
  }
}

export function createSplitOverrideTemplate(
  nodeGroups: SplitNodeGroup[],
  policyGroups: SplitPolicyGroup[],
  appRules: SplitAppRule[],
  customRules: string[]
): string {
  const enabledRules = appRules.filter((rule) => rule.enabled)
  const usedProviderNames = new Set(
    enabledRules.flatMap((rule) => (rule.type === 'preset' && rule.provider ? [rule.provider] : []))
  )
  const providers = providerPresets.filter((provider) => usedProviderNames.has(provider.name))
  const customProviders = enabledRules
    .filter((rule) => rule.type === 'rule-set' && rule.url)
    .map((rule) => ({
      name: appRuleProviderName(rule),
      behavior: rule.behavior || 'domain',
      format: rule.format || 'mrs',
      url: rule.url || ''
    }))
  const nodeGroupById = new Map(nodeGroups.map((group) => [group.id, group]))
  const policyGroupNames = new Set(policyGroups.map((group) => group.name))
  const fallbackTarget = policyGroupNames.has('默认代理')
    ? '默认代理'
    : policyGroups[0]?.name || '直连'
  const normalizeTarget = (target: string): string => {
    if (target === '直连' || policyGroupNames.has(target)) return target
    return fallbackTarget
  }
  const selectedPolicyGroups = policyGroups
    .map((group) => {
      const selectedNodeGroups = group.nodeGroupIds
        .map((id) => nodeGroupById.get(id)?.name)
        .filter(Boolean) as string[]
      const proxies = ['直连', '手动选择节点', ...selectedNodeGroups]
      return `  - name: ${group.name}
    type: select
    proxies: [${proxies.join(', ')}]`
    })
    .join('\n')
  const manualGroup = `  - name: 手动选择节点
    type: select
    include-all: true`
  const generatedNodeGroups = nodeGroups
    .map(
      (group) => `  - name: ${group.name}
    type: ${group.type}
    include-all: true
    tolerance: 20
    interval: ${group.interval}
    filter: ${yamlQuote(groupFilter(group.filter))}`
    )
    .join('\n')
  const ruleLines = enabledRules
    .flatMap((rule) => {
      if (rule.type !== 'preset') {
        if (rule.type === 'rule-set') {
          if (!rule.url) return []
          return [`  - RULE-SET,${appRuleProviderName(rule)},${normalizeTarget(rule.target)}`]
        }
        const ruleType = customRuleType(rule)
        const suffix = rule.type === 'ip-cidr' ? ',no-resolve' : ''
        return splitKeywords(rule.values || '').map(
          (value) => `  - ${ruleType},${value},${normalizeTarget(rule.target)}${suffix}`
        )
      }
      const provider = providerPresets.find((preset) => preset.name === rule.provider)
      if (!rule.provider || !provider) return []
      const suffix = provider.noResolve ? ',no-resolve' : ''
      return [`  - RULE-SET,${rule.provider},${normalizeTarget(rule.target)}${suffix}`]
    })
    .concat(customRules.map((rule) => `  - ${rule}`))
    .concat([`  - MATCH,${fallbackTarget}`])
    .join('\n')
  const providerLines = providers
    .map(
      (provider) =>
        `  ${provider.name}: {type: http, interval: 86400, behavior: ${provider.behavior}, format: ${provider.format}, url: ${yamlQuote(provider.url)}}`
    )
    .concat(
      customProviders.map(
        (provider) =>
          `  ${provider.name}: {type: http, interval: 86400, behavior: ${provider.behavior}, format: ${provider.format}, url: ${yamlQuote(provider.url)}}`
      )
    )
    .join('\n')

  return `# Sparkle 分流覆写
# 此文件只覆盖策略组、规则和规则集；机场订阅链接仍由订阅管理里的机场配置负责。
proxies+:
  - {name: 直连, type: direct}

proxy-groups:
${selectedPolicyGroups}
${manualGroup}
${generatedNodeGroups}

rules:
${ruleLines}

rule-providers:
${providerLines}
`
}
