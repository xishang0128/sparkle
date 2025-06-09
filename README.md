# Sparkle

<h3 align="center">Another <a href="https://github.com/MetaCubeX/mihomo">Mihomo</a> GUI</h3>

<p align="center">
  <a href="https://github.com/xishang0128/sparkle/releases">
    <img src="https://img.shields.io/github/release/xishang0128/sparkle/all.svg">
  </a>
  <a href="https://t.me/+y7rcYjEKIiI1NzZl">
    <img src="https://img.shields.io/badge/Telegram-Group-blue?logo=telegram">
  </a>
  <a href="./FAQ.md">
    <img src="https://img.shields.io/badge/FAQ-informational">
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

## 开发

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

3. **处理 Electron 安装问题**（如果遇到）

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
│   └── shared/             # 共享类型定义
│       └── types.d.ts      # 全局类型定义文件
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
pnpm build:win --x64 7z
pnpm build:mac --arm64 pkg
pnpm build:linux --x64 deb
```

#### 构建产物

- **Windows**: `.exe` 安装包和 `.7z` 便携版
- **macOS**: `.pkg` 安装包
- **Linux**: `.deb`、`.rpm`、`.pacman` 等格式

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

#### Electron 安装问题

如果遇到 Electron 下载失败或安装不完整：

1. **手动安装 Electron**

```bash
cd node_modules/electron
node install.js
```

2. **清理重装**

```bash
rm -rf node_modules
pnpm install
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
