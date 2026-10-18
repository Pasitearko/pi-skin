# pi-skin · Linux / CachyOS / Kitty 个性化配置

[返回项目首页](../README.md) · [Windows / 原基础包](../README.md#快速安装基础包) · [安全说明](../SECURITY.md)

这里单独保存作者在 **CachyOS Linux + Kitty + Pi 1.3.0** 下使用的配置和本地组件。它不是整台电脑的备份，也不是把 Windows 配置原样套到 Linux。

- **原根目录基础包、Windows 截图、主题和补丁保持不变。** GitHub 仓库现名为 `Pasitearko/pi-skin`，旧地址会重定向；根目录安装仍对应原基础包，不会自动加载 `linux/`。原 npm 包名不变。
- Linux 版本是独立的本地 Pi package（`private: true`），目前只通过克隆仓库安装，不发布/覆盖原 npm 包。
- 不要同时加载原基础包、`linux/` 和 `~/.pi/agent/extensions/` 下的同名副本，否则会重复 widget、命令和运行时 hook。

完整的收录/排除清单与同步边界见 **[INVENTORY.md](INVENTORY.md)**。本次只整理 Linux，不修改 Windows 内容或重新发布原 npm 包。

## 目录与包含内容

```text
linux/
├── config/       脱敏后的外观设置、快捷键、Kitty 与可选 MCP 模板
├── compat/       独立可选的 MCP UI 噪声修复与回归测试
├── extensions/   当前 Linux 使用的 7 个本地组件及测试
├── patches/      固定版本 ALPS / quota 源码修改及 SHA-256 manifest
├── tools/        默认只检查的补丁工具、隔离测试启动器
└── tests/        Linux 包/加载器/配置/补丁安全检查
```

| 组件 | Linux 下的行为 |
|---|---|
| `weather-row` | 彩色单列 Nerd Font 图标；按晴/夜/云/雨/雪等天气切换，城市点击切换；15 分钟刷新 |
| `working-timer` | Working / Completed / Failed / Cancelled；最终 `agent_settled` 才响一次，不因普通工具报错、重试或历史恢复重复响；与额度共享行 |
| `message-timestamps` | 消息框本地时间戳 |
| `tick-rail` | 右侧提问刻度条、预览和跳转；`/rail on/off/status/list`，`Alt+[` / `Alt+]` / `Alt+J` |
| `frame-click-toggle` | 已有可折叠框的整框点击展开/收缩，拖选不切换；`/frame-clicks` |
| `clean-frame-copy` | 选区高亮/复制去掉 ALPS 装饰边框；包括多行输入框，保留代码缩进、空行、字面框线和 Unicode；`/clean-copy` |
| `tool-status-style` | 只对工具外框使用固定绿/红，移除工具背景与原生 CUSTOM 消息正文背景；保留其他消息与整体主题 |

工具正常/执行中外框为 `#4ADE80`，错误为 `#F87171`，不依赖终端 ANSI 绿色色槽。**代码 diff 加减行仍沿用原主题配色**，不会被这个组件改色。CUSTOM 只处理原生默认 Box，不抹掉注册 renderer 的自定义背景。

## 版本与限制

| 项目 | 当前验证版本 / 要求 |
|---|---|
| Pi | **1.3.0**；选区/整框点击/工具样式有精确版本保护，其余组件也仅验证此版本，升级后必须重新测试 |
| ALPS | **0.3.4**，renderer 18；高级布局需要下文 Linux 补丁 |
| subscription-usage | **1.3.1**；独立安装并自行登录，不附带任何账号或额度数据 |
| 终端 | Kitty；fullscreen、SGR mouse、真彩色；其他 Linux 终端未做实机验收 |
| 字体 | 推荐 Maple Mono NF CN 或覆盖相应 Nerd Font 图标的字体；可参考 `config/kitty-fonts.example.conf`，不含字体二进制 |
| 音频 | PipeWire 的 `/usr/bin/pw-play` + 自备可播放的音频文件 |
| Node | >= 22.19.0，建议 24 LTS；依赖版本由本目录 lockfile 固定 |

`config/settings.example.json` 是**外观字段示例，不是可覆盖整份 settings 的备份**。保留当前实际选择：thinking 展开、硬件光标、隐藏全屏滚动条、启用 codemode、ALPS 边框与动画、隐藏 ALPS elapsedTime。没有默认 provider/model、设备 ID、认证或私人路径；未固定主题，保留 Pi 的 `system` 行为。

## 安装 / 恢复

### 1. 克隆并选择 Linux 包

先退出 Pi，备份自己的配置，并停用同名扩展副本。**本机已经有这些组件时不需要再次安装**；本目录用于备份和迁移。

```sh
git clone https://github.com/Pasitearko/pi-skin.git
cd pi-skin
pi install npm:alps-pi@0.3.4
pi install npm:@specode/pi-subscription-usage@1.3.1
pi install ./linux
```

本地包从克隆路径加载，不会把源码复制进 `~/.pi/agent/extensions/`，因此不要移动/删除已注册的克隆目录。它不会自动修改终端、安装音频文件或导入账号。

### 2. 合并配置（手动，不覆盖账号）

将 `config/settings.example.json` 的外观叶子字段合并到 `~/.pi/agent/settings.json`，将 `config/keybindings.example.json` 合并到 `~/.pi/agent/keybindings.json`。先保留原件；已有的 provider、model、packages、其他扩展设置不要覆盖。

快捷键示例把 **Ctrl+F** 用于 Pi 全屏搜索，向右移动保留方向键。ALPS 快捷键属于 ALPS 的设置，不等于终端全局快捷键。

`config/packages.example.json` 另外记录了本机的 7 个上游插件及版本，**只是按需安装的清单，不会自动安装**：billion-context、imagegen、pi-mcp-adapter、pi-web-access、plannotator、ALPS、subscription-usage。它们各自需要自己的配置和授权。只有选择 pi-mcp-adapter 时才参考 `-builtin:mcp`，避免两个 MCP 实现重复加载；不用适配器时不要禁用内置 MCP。

### 可选：Kitty 输入与 MCP

- 字体片段：`config/kitty-fonts.example.conf`。输入片段：`config/kitty-input.example.conf`，在已有 Kitty include 之后手动合并。后者添加 **Ctrl+左键打开链接**（包括 Pi 捕获鼠标时），保留普通左键供 Pi/选区使用，并把 Ctrl+V 传给 Pi 处理图片粘贴；终端粘贴用 Ctrl+Shift+V。Kitty 默认 Ctrl+Shift+左键仍可用。
- `config/mcp-github.example.json`：使用 pi-mcp-adapter 时，可将其中的 github 项手动合并进 `~/.config/mcp/mcp.json`。示例用 PATH 中的 `github-mcp-server`，需自行安装/登录；`openUi: false` 取消 MCP App 表单，直接调用工具，**不扩大权限或自动授权操作**。
- `config/mcp-playwright.example.json`：按需合并进 `~/.pi/agent/mcp.json`，使用独立 Chrome 会话，不附带个人浏览器资料。
- 两份 MCP 文件只是模板，不要用它们覆盖整份已有配置；不需要对应插件时不要加入。修改后 `/reload`。插件 OAuth 认证按上游流程自行完成。
- 如需保留 MCP UI，同时使用沉浸式翻译，可阅读 [可选 UI 噪声修复](compat/mcp-ui-filter/README.md)。该补丁独立安装，不是默认外观补丁的一部分。

### 3. 可选：恢复底部布局等高级修改

必须从仓库根目录运行 **Linux 工具**，不要运行根目录的 Windows 历史补丁工具：

```sh
# 默认只检查版本、源文件 SHA-256 和补丁 SHA-256
node linux/tools/patches.mjs
# 全部检查通过后，明确写入并生成 undo receipt
node linux/tools/patches.mjs --apply
```

这些补丁保存本机实际的底部指标/`` 金额图标、tok/s 保存与模型切换保留、消息框适配、终端输出处理、额度共享桥等源码修改；Windows 专用文件链接分支保留其平台判断，不修改 Kitty 设置。

工具复用项目已有的路径边界、symlink 拒绝、逐文件哈希、先备份后写入和回滚逻辑，**使用本目录独立 manifest**。只接受固定上游版本的原文件或本 Linux 补丁版本；已有其他本地改动（包括旧 Windows 补丁）会拒绝覆盖。不要强制替换；先保存旧改动，再在干净的固定版本安装上应用。

可用 `--agent-dir /path/to/agent --modules /path/to/node_modules` 指定路径。恢复时使用工具打印的 receipt：

```sh
node linux/tools/patches.mjs --undo /path/to/patch-undo.json --apply
```

undo 同样拒绝覆盖后续变更；不会还原整份 settings。`personalization-undo/` 只保留在本机，不能上传。

最后重新启动 Pi 或 `/reload`。新版本升级后先验证，不要关闭版本保护强行适配。

## Linux 提示音

**不分发本机的游戏音效，也不包含任何 WAV。** 需要自己准备拥有使用权的音频。默认路径保持本机约定：

```text
~/.local/share/pi/sounds/minecraft-exp-orb.wav
```

该文件名只是兼容路径，不表示仓库提供该声音。发布副本还增加了可选环境变量，可以指向任意自备文件（绝对路径）：

```sh
export PI_COMPLETION_SOUND="$HOME/.local/share/pi/sounds/my-completion.wav"
pi
```

Fish 使用 `set -gx PI_COMPLETION_SOUND "$HOME/.local/share/pi/sounds/my-completion.wav"`。测试命令 `/sound-test`；每播放器音量 100%，**不修改系统音量、默认输出或路由**。没有 `pw-play`、文件缺失或播放失败时只提示失败，不影响本轮结果；不需要声音时可不加载 working-timer，或自行配置无声文件。源码保留 Windows MCI 分支，但此 Linux 包没有 Windows 音频资产，不替代原 Windows 包。

与本机源码相比，发布副本只增加音频路径环境变量，并修正测试的依赖定位和旧音量/平台断言；没有改动正在运行的本机组件。

## 天气、额度与隐私

- 默认城市为公开示例 **上海 / 斯特拉斯堡 / 东京**，不读取系统定位；启动时预取所有已配置城市，按 15 分钟边界更新，失败退避。
- 数据来源：[Open-Meteo](https://open-meteo.com/)。请求会把配置的坐标与源 IP 暴露给服务；遵守其[使用条款与署名要求](https://open-meteo.com/en/terms)。天气缓存位于 Pi agent 目录的 `cache/weather-cities-v1.json`，不在本仓库。
- 可用 `PI_WEATHER_LOCATIONS` 自定义 1–5 个城市，格式见[项目天气说明](../README.md#天气位置)；不要把住所坐标提交到 Git。移除/停用 weather-row 可停止自动请求。
- 额度查询与 OpenAI 登录由独立的 subscription-usage 上游插件负责，tick-rail/计时组件只接共享行和 UI；不附带认证和实际余额。
- 不上传原始 auth/models/MCP 配置及缓存、会话、web-search API 配置、cookies、设备 ID、音频、字体、截图、私有备份、node_modules，也不包含 Niri、蓝牙、PAM、应用配置等非 Pi 桌面设置。MCP 仅提供经过审阅、不含认证/私人路径的 example 模板。

## 验证

```sh
cd linux
npm ci --ignore-scripts
npm test
npm run check:privacy
```

测试仅给本目录 `node_modules` 的开发依赖应用 Linux 补丁，不碰实际 `~/.pi/agent`。覆盖 7 个扩展加载、配置字段白名单、补丁哈希与拒绝未知文件、天气、最终状态音频调度、真实 Pi/ALPS 多行输入复制，以及 CUSTOM 背景与工具框颜色。测试使用假网络/播放器/clipboard，不调用模型、不查询私人额度、不播放声音。

本次 Linux 本地通过：包/配置 6 项、天气 57 项、计时/音频 36 项、干净复制 24 个集成用例、CUSTOM/工具框 960 个渲染组合；另单独验证 MCP UI 噪声过滤 11 项，并在临时目录验证该补丁的 dry-run、应用、重复应用、冲突拒绝与逐字节撤回。可选 MCP UI 测试和隔离安装方法见其 README，不由默认 `npm test` 自动运行。自动化不等于跨终端实机验收；其他 Pi 版本不作保证。

卸载：`pi remove /absolute/path/to/pi-skin/linux`（以 `pi list` 显示的 source 为准），重启 Pi；如有高级补丁，先用 receipt 撤回。手工合并的设置由你保留或恢复。

原创代码遵循仓库 [MIT](../LICENSE)，修改的 ALPS / subscription-usage 保留上游 [许可说明](../THIRD_PARTY_NOTICES.md)。
