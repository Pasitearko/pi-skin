# pi-skin · Linux 配置清单与同步边界

快照核对日期：2026-10-18。环境：CachyOS Linux、Kitty、Pi 1.3.0。

本次整理只写入 `linux/`，保留 Windows / 原基础包的所有代码、补丁、配置、截图、说明及 npm 包名。GitHub 仓库更名为 `Pasitearko/pi-skin`；npm 的 `@jiuliyear/pi-personalization` 不会因此改名或重新发布。

## 已收录

| 本机内容 | 仓库位置 | 处理方式 |
|---|---|---|
| 七个本地扩展 | `extensions/` | 已逐文件核对实际运行源码：天气、计时、时间戳、提问刻度条、整框点击、干净复制、工具框配色 |
| Pi / ALPS 外观字段 | `config/settings.example.json` | 白名单导出；无默认模型、设备 ID、认证或私人路径 |
| Pi 快捷键 | `config/keybindings.example.json` | 仅相关功能映射，不覆盖整份配置 |
| 上游插件版本 | `config/packages.example.json` | 安装清单；不捆绑 node_modules，不自动安装/登录 |
| Maple Mono 字体选择 | `config/kitty-fonts.example.conf` | 可手动合并的片段；不分发字体二进制 |
| Ctrl+左键打开链接、Ctrl+V 图片粘贴透传 | `config/kitty-input.example.conf` | 可手动合并的片段；不复制整份终端/桌面配置 |
| GitHub 直接工具调用 | `config/mcp-github.example.json` | PATH 命令示例、`openUi: false`、安全默认 `approveTools: true`；无凭据，需自行安装和登录 |
| 隔离 Playwright + Chrome | `config/mcp-playwright.example.json` | 固定版本、隔离浏览器、有 sandbox 的可选模板 |
| ALPS / quota 的 13 个源码补丁 | `patches/` | 与本机版本一致，固定版本、哈希检查、显式应用和可撤回 |
| MCP UI 翻译扩展噪声修复 | `compat/mcp-ui-filter/` | 独立可选，pi-mcp-adapter 5.3.2、双层过滤、上游 MIT 许可、11 项回归 |

Linux 发布副本与本机有意保留的差异：working-timer 增加可选 `PI_COMPLETION_SOUND`，测试依赖改用克隆目录的隔离 node_modules，并修正旧平台断言；公开 GitHub MCP 模板额外启用 `approveTools: true`，与 UI 展示开关、账号权限分开说明；额外 README 记录安装边界。这些不会改变本机正在运行的扩展或确认策略。

## 不收录

- `auth.json`、OAuth/API keys、cookies、GitHub token、MCP 登录缓存或项目授权记录。
- 聊天/会话、工具日志、天气缓存、额度和吞吐率缓存、私有草稿、undo receipt、设备标识。
- 私人目录、截图、用户实际声效、字体二进制、node_modules、整份 shell / Kitty / Niri / 系统配置。
- 模型选择和上下文窗口覆盖：这属于模型能力/服务配置，不是皮肤；不把本机模型元数据作为跨环境承诺。
- DSH、独立 Codex CLI、桌面 ChatGPT、Claude 的配置：均不是本 Pi Linux 外观包的组成部分。

## 恢复原则

1. 先阅读 [Linux 安装说明](README.md)，备份原配置，停用重复扩展。
2. 克隆目录是本地 Pi 包的源码位置，安装后不要移动它。
3. 配置示例逐项合并，不覆盖认证、模型或已有 packages。
4. 默认补丁命令只检查；主动添加 `--apply` 才写入第三方源码并备份。
5. MCP UI 修复单独启用；更新上游后重新核对版本，不绕过保护。
6. 不替换 Windows 版本，也不把 Windows 私有 API 验证范围当成 Linux 的保证。
