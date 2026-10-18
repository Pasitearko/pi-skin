# pi-skin · Linux

**CachyOS + Kitty + Pi 1.3.0：细线消息框、彩色天气、计时 / 额度共享行、干净复制和提问导航。**

[English](README.en.md) · [项目首页](../README.md) · [配置清单](INVENTORY.md) · [安全说明](../SECURITY.md)

## 布局与交互

```text
┌ USER · 14:20 ────────────────────────────────────┐    ● ← 提问刻度条
│ 帮我检查这个函数                                 │    │
└──────────────────────────────────────────────────┘    ●
┌ TOOL · read ─────────────────────────────────────┐    │
│ src/example.ts                  点击展开 ↕       │    ●
└──────────────────────────────────────────────────┘
  ☀ Shanghai · 22°C          ← 城市区域可点击切换
┌ INPUT ───────────────────────────────────────────┐
│ 输入消息…                                        │
└ input / output · cache · tok/s · cost ───────────┘
  Completed 12s                       quota remaining
```

*布局示意，数据为虚构示例；不是实机截图，实际宽度与图标取决于字体。*

| 整框点击 | 干净选区与复制 |
|:---:|:---:|
| ![折叠与展开演示](../docs/previews/frame-click.png) | ![装饰线不进入复制文本](../docs/previews/clean-selection.png) |

上图演示共用的交互机制，来自原基础包渲染，不是 Linux 实机截图。[预览来源](../docs/previews/README.md)

## 功能

| 组件 | 功能 | 操作 |
|---|---|---|
| `weather-row` | 单列彩色天气图标、3 个默认城市、15 分钟更新、缓存与失败退避 | `/weather`；点击城市切换 |
| `working-timer` | Working / Completed / Failed / Cancelled；最终结束才响一次；与额度共享行 | 自动；`/sound-test` |
| `message-timestamps` | 消息标题显示产生时的本地时间 | 自动 |
| `tick-rail` | 右侧提问位置、预览与跳转 | `/rail`；`Alt+[` / `Alt+]` / `Alt+J` |
| `frame-click-toggle` | 点击已有可折叠框任意非交互区域展开 / 收缩；拖选不切换 | `/frame-clicks on/off/status` |
| `clean-frame-copy` | 去除消息框 / 多行输入框装饰的高亮和复制；保留真实正文 | `/clean-copy on/off/status` |
| `tool-status-style` | 🟩 正常框 `#4ADE80`；🟥 错误框 `#F87171`；无大块工具 / 原生 CUSTOM 背景 | 自动；保留 diff 和自定义 renderer 配色 |

依赖 ALPS 的功能在不支持的布局上保留原生行为。Linux 输入框去框由 ALPS 0.3.4 编辑器适配提供，无需原基础包的 `bottom-input/editor.ts` 补丁。终端自己的 Shift 选区不受影响。

## 安装

要求：**Pi 1.3.0**、Node **22.19.0+**（建议 24 LTS）、Kitty fullscreen / SGR mouse / 真彩色。图标建议使用 **Maple Mono NF CN**。

```sh
git clone https://github.com/Pasitearko/pi-skin.git
cd pi-skin
pi install npm:alps-pi@0.3.4
pi install npm:@specode/pi-subscription-usage@1.3.1
pi install ./linux
```

1. 停用原基础包或 `~/.pi/agent/extensions/` 中的同名副本，避免重复加载。
2. 按下节合并配置；高级布局需显式应用补丁。
3. 重启或 `/reload`。本地包从克隆路径加载，安装后不要移动该目录。

已在本机使用同名组件时无需重复安装。Linux 包独立于原 npm 包，不会自动修改终端或导入账号。

## 配置

### 文件位置

| 示例 | 合并位置 / 用途 |
|---|---|
| [`config/settings.example.json`](config/settings.example.json) | `~/.pi/agent/settings.json`；Pi / ALPS 外观字段 |
| [`config/keybindings.example.json`](config/keybindings.example.json) | `~/.pi/agent/keybindings.json`；Pi 快捷键 |
| [`config/packages.example.json`](config/packages.example.json) | 可选插件与固定版本清单；不自动安装 |
| [`config/kitty-fonts.example.conf`](config/kitty-fonts.example.conf) | Kitty 字体片段 |
| [`config/kitty-input.example.conf`](config/kitty-input.example.conf) | Kitty 输入片段，放在现有 include 之后 |
| [`config/mcp-github.example.json`](config/mcp-github.example.json) | 适配器用户合并 github 项到 `~/.config/mcp/mcp.json` |
| [`config/mcp-playwright.example.json`](config/mcp-playwright.example.json) | 按需合并到 `~/.pi/agent/mcp.json` |

**逐项合并，不覆盖整份文件；保留已有模型、认证和 packages。**

### Pi / ALPS 参数

以下是仓库示例值，不是 Pi / ALPS 的上游默认值。`alps-pi.*` 表示 settings 中的嵌套字段。

| 参数 | 示例值 | 效果 |
|---|---|---|
| `defaultThinkingLevel` | `"high"` | 默认推理级别，模型需支持 |
| `hideThinkingBlock` | `false` | 显示 thinking 块 |
| `defaultTools` | `["+codemode"]` | 在默认工具上加入 codemode |
| `showHardwareCursor` | `true` | 硬件光标 |
| `fullscreenScrollbar` | `"hidden"` | 隐藏全屏滚动条 |
| `alps-pi.chromeFrame.enabled` | `true` | 消息框 |
| `alps-pi.chromeFrame.assistantFrame` | `true` | Assistant 外框 |
| `alps-pi.chromeFrame.toolCompactMode` | `"compact"` | 紧凑工具框 |
| `alps-pi.chromeFrame.compactEditTool` | `false` | 不启用 compactEditTool |
| `alps-pi.fixedBottomEditor.enabled` | `true` | 固定底部输入框 |
| `alps-pi.beautifiedInput.enabled` | `true` | 美化输入框 |
| `alps-pi.inputMetrics.*` | 见下表 | 底部指标 |
| `alps-pi.footer.enabled` | `true` | Footer |
| `alps-pi.animations.enabled` | `true` | 状态动画 |
| `alps-pi.animations.randomMode` | `false` | 不随机切换动画 |
| `alps-pi.animations.working/thinking/tool` | `crush / shimmer / pipeline` | 分阶段动画 |
| `alps-pi.animations.width` / `fps` | `"default"` / `16` | 动画宽度 / 帧率 |

| `alps-pi.inputMetrics` 字段 | inputTokens | outputTokens | cacheHit | tokenSpeed | elapsedTime | cost |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| 示例值 | `true` | `true` | `true` | `true` | `false` | `true` |

ALPS 隐藏 elapsedTime，独立 working-timer 负责本轮耗时；cost 为估算值，不是账单。未固定主题，保留 Pi 的主题选择。

### 快捷键

| 操作 | 快捷键 / 设置来源 |
|---|---|
| 全屏搜索 | `Ctrl+F`；Pi `tui.altScreen.search` |
| 光标向右 | `Right`；Pi `tui.editor.cursorRight` |
| 上一个 / 下一个提问 | `Alt+[` / `Alt+]`；tick-rail |
| 提问列表 | `Alt+J`；tick-rail |
| 暂存输入 | `Alt+S`；ALPS `shortcuts.stashEditor` |
| 复制 / 剪切输入 | `Ctrl+Alt+C` / `Ctrl+Alt+X`；ALPS |
| 滚动对话 | `Super+Up` / `Super+Down`；ALPS |
| 输入开头 / 结尾 | `Super+Shift+Up` / `Super+Shift+Down`；ALPS |
| 上一条 / 下一条用户消息 | `Ctrl+Shift+U` / `Ctrl+Shift+I`；ALPS |
| 上一条 / 下一条 Assistant 消息 | `Ctrl+Alt+,` / `Ctrl+Alt+.`；ALPS |
| 对话底部 | `Ctrl+Shift+G`；ALPS |
| 打开链接 | `Ctrl+左键`；Kitty 片段；默认 `Ctrl+Shift+左键` 仍可用 |
| 图片粘贴给 Pi | `Ctrl+V`；Kitty `no_op` 将按键传给 Pi |
| 终端粘贴 / 复制 | `Ctrl+Shift+V` / `Ctrl+Shift+C`；Kitty |

终端、窗口管理器可能先截获按键；此包不更改系统快捷键。

### 命令

| 命令 | 功能 |
|---|---|
| `/weather` 或 `/weather refresh` | 刷新当前城市；15 秒内不重复手动刷新 |
| `/weather next` | 切换城市缓存，不额外请求 |
| `/weather <city-id>` | 切换到指定城市 |
| `/rail on` / `off` / `status` / `list` | 提问刻度条与列表 |
| `/frame-clicks on` / `off` / `status` | 整框点击 |
| `/clean-copy on` / `off` / `status` | 干净复制 |
| `/sound-test` | 测试提示音，不创建计时轮次 |

`/rail` 无参为 status；刻度与前后跳转需 fullscreen、至少 3 个提问，列表可从 1 个提问使用。`/rail off` 隐藏刻度，不解绑导航快捷键。`/frame-clicks`、`/clean-copy` 无参查看状态，默认开启，开关不写入 settings。

### 环境变量：天气与声音

| 变量 | 值 / 默认行为 |
|---|---|
| `PI_WEATHER_LOCATIONS` | 1–5 个城市的 JSON 数组；默认上海 / 斯特拉斯堡 / 东京 |
| `PI_COMPLETION_SOUND` | 建议使用自备音频的绝对路径；默认 `~/.local/share/pi/sounds/minecraft-exp-orb.wav`，仓库不附带该文件 |

```sh
export PI_WEATHER_LOCATIONS='[{"id":"london","name":"London","latitude":51.5074,"longitude":-0.1278}]'
export PI_COMPLETION_SOUND="$HOME/.local/share/pi/sounds/my-completion.wav"
pi
```

Fish 对应 `set -gx PI_COMPLETION_SOUND "$HOME/.local/share/pi/sounds/my-completion.wav"`。

- 天气使用 [Open-Meteo](https://open-meteo.com/)；每 15 分钟边界更新，失败按 1 / 2 / 4 / 8 分钟退避。显示时间为 Asia/Shanghai，不自动定位。坐标和源 IP 会发送到服务，遵守其[条款](https://open-meteo.com/en/terms)。
- 城市字段：`id`（唯一，`^[a-z0-9-]{1,32}$`）、`name`（非空，最多 40 个 JS 字符单元，无控制字符）、`latitude`（−90～90）、`longitude`（−180～180）。任一条非法即回退默认城市；修改后重启 Pi。
- 固定请求超时 12 秒；天气缓存：agent 目录下 `cache/weather-cities-v1.json`。
- 声音需要 `/usr/bin/pw-play`（PipeWire），每播放器音量 100%，不改系统音量。最终结束（含 Failed / Cancelled）才播放一次；重试和普通工具错误不重复响。缺文件 / 播放失败不影响本轮结果。

### 可选插件与 MCP

| 插件 | 固定版本 | 用途 |
|---|---|---|
| `alps-pi` | `0.3.4` | 消息框、输入框、底部布局 |
| `@specode/pi-subscription-usage` | `1.3.1` | 订阅额度；需自己的登录 |
| `billion-context` | `0.1.201` | 长会话上下文管理 |
| `@crazygit/pi-codex-image-gen` | `0.2.2` | 图片生成 |
| `pi-mcp-adapter` | `5.3.2` | MCP 适配器 |
| `pi-web-access` | `0.42.0` | Web 工具 |
| `@plannotator/pi-extension` | `0.28.23` | 计划审阅 |

这些插件不随本包安装。仅在选择 pi-mcp-adapter 时参考清单中的 `-builtin:mcp`，避免重复加载 MCP 实现。

| MCP 参数 | 示例值 | 含义 |
|---|---|---|
| GitHub `command` | `github-mcp-server` | 从 PATH 启动；自行安装并登录 |
| GitHub `lifecycle` | `"lazy"` | 按需启动 |
| GitHub `openUi` | `false` | 不打开 MCP App 表单 |
| GitHub `approveTools` | `true` | 调用工具前要求交互确认；与 UI 开关独立 |
| GitHub OAuth scope | `repo,read:org` | 包含私人仓库 / 写权限；无需写入时添加 `--read-only` |
| Playwright | `@playwright/mcp@0.0.83` | Chrome；`--isolated --sandbox --no-webmcp` |

模板不附带认证；修改后 `/reload`。保留 MCP UI 且使用沉浸式翻译时，可单独安装[消息噪声过滤补丁](compat/mcp-ui-filter/README.md)。

## 补丁工具与参数

高级补丁提供底部指标、tok/s 保存、消息框 / 输入框适配和额度共享桥。固定 **ALPS 0.3.4 / renderer 18**、**subscription-usage 1.3.1**；MCP 过滤补丁固定 **pi-mcp-adapter 5.3.2**。

先退出 Pi，从仓库根目录运行：

```sh
# 外观补丁：默认检查，显式 --apply 才写入
node linux/tools/patches.mjs
node linux/tools/patches.mjs --apply

# 可选：MCP UI 过滤，独立于外观补丁
node linux/tools/patches.mjs --mcp-ui-filter
node linux/tools/patches.mjs --mcp-ui-filter --apply
```

| 参数 | 作用 / 默认值 |
|---|---|
| 无参数 | 只检查外观补丁，不写入 |
| `--apply` | 写入并生成本机 undo receipt |
| `--mcp-ui-filter` | 只选择独立的 MCP UI 过滤补丁 |
| `--agent-dir <dir>` | agent 路径；默认 `PI_CODING_AGENT_DIR` 或 `~/.pi/agent` |
| `--modules <dir>` | 第三方依赖路径；默认 `<agent>/npm/node_modules` |
| `--undo <receipt> --apply` | 撤回；MCP 补丁需同时加 `--mcp-ui-filter` |

```sh
node linux/tools/patches.mjs --undo /path/to/patch-undo.json --apply
node linux/tools/patches.mjs --mcp-ui-filter --undo /path/to/mcp-undo.json --apply
```

版本、SHA-256、symlink 与后续文件修改均受检查；不会覆盖未知改动或整份 settings。**Linux CLI 没有 `--settings` / `--replace-settings`。** 更新插件后重新验证，不绕过版本保护。

## 测试与卸载

```sh
cd linux
npm ci --ignore-scripts
npm test
npm run check:privacy
```

| 覆盖范围 | 用例 |
|---|---:|
| 包、配置、补丁安全与完整应用 / 撤回 | 7 |
| 天气 | 57 |
| 计时 / 音频 | 36 |
| 干净复制集成 | 24 |
| CUSTOM / 工具框渲染组合 | 960 |
| 可选 MCP UI 过滤回归（[单独运行](compat/mcp-ui-filter/README.md)） | 11 |

测试仅操作隔离开发依赖，不改本机 Pi，不调用模型或真实额度，不播放声音。其他 Pi 版本 / 终端需自行验收。

卸载前用 receipt 撤回补丁，再 `pi remove <pi list 显示的本地 source>` 并重启。手工合并的设置自行保留或恢复。

不附带账号、会话、缓存、音频或字体二进制。[收录边界](INVENTORY.md) · [MIT](../LICENSE) · [第三方许可](../THIRD_PARTY_NOTICES.md)
