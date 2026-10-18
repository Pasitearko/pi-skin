# pi-skin

**Pi 终端界面定制：消息框、干净复制、天气、计时、额度与鼠标交互。**

[English](README.en.md) · [Linux 配置](linux/README.md) · [npm 原基础包](https://www.npmjs.com/package/@jiuliyear/pi-personalization) · [MIT](LICENSE)

## 界面预览

![Pi 界面：消息框、时间戳、天气、额度与底部指标](docs/previews/overview.png)

> 上图是原基础包的演示渲染，使用虚构会话和数值；不是 Linux 实机截图。Linux 的布局与参数见[独立说明](linux/README.md)。

| 整框展开 / 收缩 | 去掉复制内容中的装饰线 |
|:---:|:---:|
| ![点击前后](docs/previews/frame-click.png) | ![选区与复制对比](docs/previews/clean-selection.png) |

<details>
<summary>查看 Windows Terminal 实机截图</summary>

![Windows 11 / Windows Terminal / PowerShell 7.6](docs/previews/windows-terminal-real.png)

原作者授权公开的实机原图。其他预览为演示渲染：[图片来源](docs/previews/README.md)。

</details>

## 选择版本

| | **Linux 配置** | **原基础包 / Windows 配置** |
|---|---|---|
| 入口 | [`linux/`](linux/README.md) | 根目录 `extensions/`、`patches/` |
| 验证环境 | CachyOS + Kitty，Pi **1.3.0** | Pi **1.2.0**；部分适配另支持旧版本 |
| 安装 | 克隆仓库，`pi install ./linux` | npm 或 Git，二选一 |
| 特点 | 7 个组件、彩色天气图标、绿/红工具框、PipeWire 提示音 | 8 个组件、Fast 开关、`no-tool-bg` 主题、Windows 提示音 |
| 详细参数 | [中文](linux/README.md) / [English](linux/README.en.md) | [下方功能与配置](#功能与命令) |

**两套包不要同时加载。** GitHub 名称为 `pi-skin`；原 npm 包名仍是 `@jiuliyear/pi-personalization`。

## 安装

### Linux · CachyOS / Kitty

```sh
git clone https://github.com/Pasitearko/pi-skin.git
cd pi-skin
pi install npm:alps-pi@0.3.4
pi install npm:@specode/pi-subscription-usage@1.3.1
pi install ./linux
```

按 [Linux 配置说明](linux/README.md#配置)合并设置；需要底部布局等高级功能时，再显式应用 Linux 补丁。已有同名本地组件先停用；本地包安装后不要移动克隆目录。

<a id="快速安装基础包"></a>

### 原基础包 / Windows

Node **22.19.0+**；推荐 Pi **1.2.0**。鼠标增强需要 fullscreen 和 SGR mouse 支持。

```sh
# npm 发布版
pi install npm:@jiuliyear/pi-personalization

# 或使用最新 Git 源码，不要与 npm 版同时安装
pi install git:github.com/Pasitearko/pi-skin
```

重启或 `/reload`，可在 Pi 设置中选择 `no-tool-bg`。基础安装不改写 ALPS 或整份配置。最新多行输入去框修复在 Git 源码中，尚未发布到 npm。

## 功能与命令

| 功能 | Linux | 原基础包 | 用法 |
|---|:---:|:---:|---|
| 天气 | ✓ | ✓ | `/weather` 刷新；`/weather next` 切换缓存城市 |
| 本轮计时 / 结果 | ✓ | ✓ | Working → Completed / Failed / Cancelled；`/sound-test` 测试声音 |
| 订阅额度 | 与计时共享；窄屏换行 | 与计时共享；窄屏换行 | 需要 `@specode/pi-subscription-usage` 和自己的登录 |
| 消息时间戳 | ✓ | ✓ | 自动显示本地消息时间 |
| 提问导航 | `/rail` | `/timeline` | 支持 `on` / `off` / `status` / `list` |
| 整框点击展开 | ✓ | ✓ | `/frame-clicks on`、`off`、`status` |
| 干净选区 / 复制 | ✓ | ✓ | `/clean-copy on`、`off`、`status` |
| 固定绿 / 红工具框 | ✓ | — | 正常 `#4ADE80`；错误 `#F87171`；保留 diff 配色 |
| OpenAI Fast | — | ✓ | `/fast`、`/fast ok`、`/fast no`；新会话默认关闭 |
| 简洁主题 | 保留 Pi 主题 | `no-tool-bg` | 减少大面积工具背景 |

- **点击**：未修饰的左键释放才切换已有可折叠框；拖选、链接和独立按钮优先。
- **复制**：保留缩进、空行、中文、emoji 和字面框线；仅排除已验证的装饰。终端自身的 Shift 选区不受影响。
- **输入框去框**：原基础包需要扩展及匹配版本的 ALPS `bottom-input/editor.ts` 补丁；Linux 使用独立编辑器适配，无需该补丁。
- **Fast**：请求 `service_tier=priority`，不代表服务端已接受；可能影响消耗。估算 cost 不是账单。

## 配置

| 内容 | Linux 文件 | 原基础包文件 |
|---|---|---|
| Pi / ALPS 外观 | [`settings.example.json`](linux/config/settings.example.json) | [`examples/settings.json`](examples/settings.json) |
| Pi 快捷键 | [`keybindings.example.json`](linux/config/keybindings.example.json) | [扩展命令与说明](extensions/) |
| 插件版本 | [`packages.example.json`](linux/config/packages.example.json) | 下方固定版本依赖 |
| 终端字体 / 输入 | [Kitty 字体](linux/config/kitty-fonts.example.conf) · [输入](linux/config/kitty-input.example.conf) | [Windows Terminal](examples/windows-terminal.json) |
| MCP 模板 | [GitHub](linux/config/mcp-github.example.json) · [Playwright](linux/config/mcp-playwright.example.json) | 按所用 MCP 插件自行配置 |

只合并需要的字段，不覆盖已有认证、模型和 packages。字体需自行安装：[字体构建配方](fonts/README.md)。

### 天气位置

`PI_WEATHER_LOCATIONS`：1–5 个城市的 JSON 数组；字段为 `id`、`name`、`latitude`、`longitude`。

```sh
export PI_WEATHER_LOCATIONS='[{"id":"london","name":"London","latitude":51.5074,"longitude":-0.1278}]'
```

```powershell
$env:PI_WEATHER_LOCATIONS = '[{"id":"london","name":"London","latitude":51.5074,"longitude":-0.1278}]'
```

默认上海 / 斯特拉斯堡 / 东京；无自动定位、无 API key。每 15 分钟更新，显示时间统一为 Asia/Shanghai。坐标与源 IP 会发送到 [Open-Meteo](https://open-meteo.com/)，遵守其[条款](https://open-meteo.com/en/terms)；修改后重启 Pi。

## 高级补丁

固定依赖：**ALPS 0.3.4**、**subscription-usage 1.3.1**。先退出 Pi，在仓库根目录运行对应工具。

npm / Git 包安装不会在当前目录创建源码工作区。尚未克隆时，先取得补丁工具，无需重复安装原基础包：

```sh
git clone https://github.com/Pasitearko/pi-skin.git
cd pi-skin
```

| 操作 | Linux | 原基础包 |
|---|---|---|
| 检查，不写入 | `node linux/tools/patches.mjs` | `node tools/setup.mjs` |
| 应用并备份 | 上述命令加 `--apply` | 上述命令加 `--apply` |
| 撤回 | `node linux/tools/patches.mjs --undo <receipt> --apply` | `node tools/setup.mjs --undo <receipt> --apply` |
| 可选 MCP UI 噪声过滤 | [单独补丁与参数](linux/compat/mcp-ui-filter/README.md) | — |

原基础包先安装上述依赖。其设置工具另支持 `--settings --apply`（补齐缺失外观字段）、`--settings --replace-settings --apply`（替换示例外观字段）；**Linux CLI 不提供这两个设置选项**。

两套工具均支持 `--agent-dir <dir>`、`--modules <dir>`。默认 agent 为 `PI_CODING_AGENT_DIR` 或 `~/.pi/agent`。校验版本与 SHA-256，拒绝未知改动和 symlink；撤回使用应用时打印的 receipt，不还原整份 settings。

## 兼容性与开发

| 范围 | 支持边界 |
|---|---|
| Linux | 仅验证 Pi 1.3.0 + Kitty；其他版本 / 终端需重新测试 |
| 原基础包 | 框适配：Pi 1.0.4 / 1.1.0 / 1.2.0；去框选区另支持 1.3.0，不代表所有组件支持 1.3.0 |
| 音频 | Linux 包：PipeWire + 自备文件；原基础包：Windows MCI，macOS/Linux 静默降级 |
| 隐私 | 不附带认证、会话或真实额度；天气及可选插件按各自配置联网 |

```sh
# Linux 测试；原基础包测试则在仓库根目录执行同样命令
cd linux
npm ci --ignore-scripts
npm test
npm run check:privacy
```

卸载：Linux 用 `pi remove <pi list 中的本地 source>`；原基础包按实际来源用 `pi remove npm:@jiuliyear/pi-personalization` 或 `pi remove git:github.com/Pasitearko/pi-skin`。旧地址安装的 source 以 `pi list` 为准。先撤回高级补丁，再移除扩展。

[安全说明](SECURITY.md) · [Linux 收录清单](linux/INVENTORY.md) · [Skills / MCP 推荐](docs/RECOMMENDATIONS.md) · [第三方许可](THIRD_PARTY_NOTICES.md)
