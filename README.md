# Sparkle

<h3 align="center">Another <a href="https://github.com/MetaCubeX/mihomo">Mihomo</a> GUI</h3>

<p align="center">
  <a href="https://github.com/xishang0128/sparkle/releases">
    <img src="https://img.shields.io/github/release/xishang0128/sparkle/all.svg">
  </a>
  <a href="https://t.me/+y7rcYjEKIiI1NzZl">
    <img src="https://img.shields.io/badge/Telegram-Group-blue?logo=telegram">
  </a>
</p>

## 特性

- [x] 开箱即用，无需服务模式的 Tun
- [x] 多种配色主题可选，UI 焕然一新
- [x] 支持大部分 Mihomo 常用配置修改
- [x] 内置稳定版和预览版 Mihomo 内核
- [x] 通过 WebDAV 一键备份和恢复配置
- [x] 强大的覆写功能，任意修订配置文件
- [x] 深度集成 Sub-Store，轻松管理订阅

## 本 fork 与官方 Sparkle 的区别

本仓库基于官方 [xishang0128/sparkle](https://github.com/xishang0128/sparkle) fork，当前主要面向“机场订阅 + 可视化分流覆写”的小白用户场景做增强。

### 分流覆写向导

- 新增“分流覆写”可视化创建/编辑入口，不需要手写 YAML。
- 采用分步向导：基础信息、节点组、策略组、应用分流、YAML 预览。
- 支持自定义节点组，例如香港、日本、台湾、新加坡、美国等，用户可按节点名称关键词自行分组。
- 支持自定义策略组，例如默认代理、国际媒体、AI、游戏平台等，并可选择允许使用哪些节点组。
- 支持应用分流规则拖动排序，生成的 `rules` 顺序与 UI 顺序一致。
- 支持后续从覆写卡片直接“可视化编辑”，保存后同步更新覆写 YAML 和可视化元数据。

### 规则库增强

- 内置常用推荐规则集，覆盖基础规则、国际媒体、社交通讯、AI、开发服务、游戏平台、国内服务、支付购物、系统服务、广告/隐私等分类。
- 保留 TikTok、Netflix、Disney+、YouTube、Google、Telegram、OpenAI/ChatGPT、Claude、Gemini、Steam、Epic、Bilibili、抖音、小红书等常见服务。
- 支持从 MetaCubeX `meta-rules-dat` 在线同步 GeoSite/GeoIP `.mrs` 规则库，避免规则集只停留在固定内置列表。
- 在线规则库索引由 GitHub Actions 自动生成并更新，不依赖客户端直接请求 GitHub API，避免普通用户遇到 API rate limit。
- 在线规则会识别域名规则和 IP 规则；IP 规则会自动生成 `no-resolve`。
- 网络同步失败时不影响内置推荐规则使用。

### 覆写与启动兼容性

- 覆写配置保存时保留 `visualType`、`visualConfig` 等可视化编辑元数据。
- 修复重复默认代理组、覆写目标不存在等容易导致 Mihomo 配置检查失败的问题。
- 优化 Windows 下 core hook 文件被占用时的启动处理，降低 `EPERM: operation not permitted, unlink` 导致的启动失败概率。
- 优化内核启动等待逻辑，避免部分环境下 API 已可用但 `post-up` 等待超时。

### 规则索引自动更新

本 fork 通过 `.github/workflows/update-rules-index.yml` 定时同步 MetaCubeX 规则目录：

1. GitHub Actions checkout `MetaCubeX/meta-rules-dat` 的 `meta` 分支。
2. `scripts/generate-rules-index.mjs` 扫描 `geo/geosite/*.mrs` 和 `geo/geoip/*.mrs`。
3. 自动生成 `public/rules-index.json` 并提交回仓库。
4. 客户端“同步在线库”只读取这个静态 JSON，避免直接调用 GitHub API。

## 开发

本项目为自用，绝大部分 pr 可能都不会合并，你可以自行 fork 修改。

### 环境要求

- **Node.js**: >= 20.0.0 (推荐使用 LTS 版本)
- **pnpm**: >= 9.0.0 (必需)
- **Git**: 最新版本

### 技术架构

Sparkle 基于 Electron + React + TypeScript 构建

#### 前端技术栈

- **React 19** - 用户界面框架
- **TypeScript** - 类型安全的 JavaScript
- **HeroUI (NextUI)** - UI 组件库
- **Tailwind CSS** - 原子化 CSS 框架
- **Monaco Editor** - 代码编辑器

#### 后端技术栈

- **Electron** - 应用主进程
- **Mihomo Core** - 代理内核
- **sysproxy-go** - 系统代理集成

### 快速开始

1. **克隆项目**

```bash
git clone https://github.com/xishang0128/sparkle.git
cd sparkle
```

2. **安装依赖**

```bash
pnpm install
```

3. **处理 Electron 安装问题**（如果遇到 pnpm dev 等命令无法成功运行）

```bash
# 如果 Electron 没有正确安装，执行以下命令
cd node_modules/electron
node install.js
cd ../..
```

4. **启动开发服务器**

```bash
pnpm dev
```

### 注意事项

windows 开发时可能会出现页面白屏，关闭 tun（虚拟网卡）即可

### 项目结构

```
sparkle/
├── src/
│   ├── main/               # Electron 主进程
│   │   ├── core/           # 内核管理
│   │   ├── config/         # 配置管理
│   │   ├── resolve/        # 解析器
│   │   ├── sys/            # 系统集成
│   │   └── utils/          # 工具函数
│   ├── renderer/           # Electron 渲染进程（前端界面）
│   │   ├── src/
│   │   │   ├── assets/     # 静态资源
│   │   │   ├── components/ # React 组件
│   │   │   ├── pages/      # 页面组件
│   │   │   ├── hooks/      # 自定义 hooks
│   │   │   ├── routes/     # 路由配置
│   │   │   └── utils/      # 前端工具
│   │   └── index.html      # 渲染进程入口 HTML
│   ├── preload/            # Electron 预加载脚本（进程间通信桥梁）
│   │   ├── index.ts        # 预加载脚本主文件
│   │   └── index.d.ts      # 预加载脚本类型定义
│   └── shared/             # 共享资源
│       └── types           # 全局类型定义
├── resources/              # 应用资源文件
├── build/                  # 构建配置
├── extra/                  # 额外资源
├── dist/                   # 构建输出目录
├── electron-builder.yml    # 打包配置
├── package.json            # 项目配置
└── README.md               # 项目说明
```

### 可用脚本

#### 开发命令

- `pnpm dev` - 启动开发服务器（前端热重载，后端需要手动重启）
- `pnpm typecheck` - TypeScript 类型检查
- `pnpm typecheck:node` - 主进程类型检查
- `pnpm typecheck:web` - 渲染进程类型检查
- `pnpm lint` - 运行代码检查
- `pnpm format` - 格式化代码

#### 构建命令

- `pnpm build:win` - 构建 Windows 版本
- `pnpm build:mac` - 构建 macOS 版本
- `pnpm build:linux` - 构建 Linux 版本

#### 其他命令

- `pnpm prepare` - 准备构建环境
- `pnpm postinstall` - 安装 Electron 依赖

### 构建发布

#### 环境准备

根据目标平台准备相应的构建环境：

**Windows 构建：**

```bash
pnpm build:win
```

**macOS 构建：**

```bash
pnpm build:mac
```

**Linux 构建：**

```bash
pnpm build:linux
```

**指定架构：**

```bash
pnpm build:win --x64/--arm64
pnpm build:mac --arm64/--x64
pnpm build:linux --x64/--arm64
```

**指定产物类型：**

```bash
pnpm build:win 7z/nsis
pnpm build:linux deb/rpm/pacman
pnpm build:mac pkg/dmg
```

**指定架构和产物类型：**

```bash
pnpm build:win 7z --x64
pnpm build:mac pkg --arm64
pnpm build:linux deb --x64
```

#### 构建产物

- **Windows**: `.exe` 安装包和 `.7z` 便携版
- **macOS**: `.pkg` 安装包
- **Linux**: `.deb`、`.rpm`、`.pkg.tar.zst(pacman)` 等格式

### 常见问题

#### 包管理器要求

本项目使用 pnpm 作为包管理器。

确保使用 pnpm 9.0.0 或更高版本：

```bash
pnpm --version
```

#### Node.js 版本要求

确保使用 Node.js 20.0.0 或更高版本：

```bash
node --version
```

#### 开发环境问题

- 确保 Node.js 版本 >= 20.0.0
- 使用 pnpm 进行依赖管理

### 贡献指南

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

### 开发注意事项

- 请确保代码通过 ESLint 检查
- 提交前运行 `pnpm format` 格式化代码
- 遵循现有的代码风格和命名规范
- 添加新功能时请更新相关文档
- 主进程代码修改后需要重启开发服务器
- 渲染进程代码支持热重载
- 所有命令都使用 pnpm 执行
- 修改类型定义后需要重启 TypeScript 服务
- 预加载脚本修改后需要重启应用

## Star History

<a href="https://www.star-history.com/#xishang0128/sparkle&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=xishang0128/sparkle&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=xishang0128/sparkle&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=xishang0128/sparkle&type=Date" />
 </picture>
</a>
