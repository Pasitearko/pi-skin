# 可选兼容补丁：过滤翻译扩展的 MCP UI 噪声

这是 **Linux 本机额外使用的兼容修复**，不是外观包的默认依赖，也不会修改 Windows 配置。只支持 `pi-mcp-adapter 5.3.2`；MIT 上游许可见 [LICENSE.upstream](LICENSE.upstream)。

## 作用

沉浸式翻译会向网页 frame 发送 `immersiveTranslate-messager-frame-bridge#...` 内部通信。适配器的 legacy UI 路径会把未知消息转换成 intent，从而误触发 Pi 对话。

- `host-html-template.ts`：在转换自定义事件前过滤这个命名空间。
- `ui-server.ts`：在记录消息、触发回调前再次过滤原始/已标准化的同类消息，兼容旧的已打开页面。
- 保留原有 source/origin/token 检查及正常表单、prompt、intent 和通知行为。它只是定向兼容修复，并不为其他自定义 intent 提供身份认证。
- `openUi: false` 是另一个独立选项，表示不声明 MCP App UI 支持、直接调用工具；**它不是审批开关**。参见 [GitHub 配置示例](../../config/mcp-github.example.json)：公开模板额外设 `approveTools: true`，要求 Pi 工具确认；`repo` OAuth scope 包含私人仓库与写权限，不需写入时添加 `--read-only`。未设工具确认时，禁用 UI 不会阻止已获账号权限的写操作。

## 检查 / 应用 / 撤回

先退出 Pi 或保存所有 MCP 表单草稿。从仓库根目录运行：

```sh
# 默认只检查；严格匹配版本及原始/已补丁文件的 SHA-256
node linux/tools/patches.mjs --mcp-ui-filter
# 只有检查通过后才显式应用，生成本机 undo receipt
node linux/tools/patches.mjs --mcp-ui-filter --apply
# 可指定隔离安装目录，用于测试，不接触实际 Pi
node linux/tools/patches.mjs --mcp-ui-filter --modules /path/to/node_modules
```

这份补丁使用独立 manifest，不会与 ALPS 外观补丁混合应用。任何未知版本、额外本地改动或 symlink 路径都会拒绝覆盖；重复应用是幂等的。它不会自动修改 MCP 配置。

撤回时使用应用命令打印的 receipt：

```sh
node linux/tools/patches.mjs --mcp-ui-filter --undo /path/to/patch-undo.json --apply
```

应用或撤回后在 Pi 执行 `/reload`，并重新打开需要使用的 UI。重新加载会关闭已打开的 MCP UI；先保存编辑。上游升级可能覆盖本地补丁，不自动重放旧补丁，先检查新版是否已修复。

`filter.patch` 是便于人工审阅的统一 diff；实际安装使用 `patches/manifest.json` 和带哈希校验的源码 payload，而不是无条件执行 patch。

## 隔离回归测试

在自行准备的、已应用补丁的 **隔离** `pi-mcp-adapter 5.3.2` 安装上运行。先在 `linux/` 执行 `npm ci --ignore-scripts`，以提供 jiti：

```sh
PI_MCP_ADAPTER_DIR=/path/to/isolated/node_modules/pi-mcp-adapter \
  node --test linux/compat/mcp-ui-filter/regression.test.mjs
```

11 项回归测试执行实际渲染的浏览器入口并启动 loopback UI 测试服务器，覆盖噪声拦截、正常事件与既有 source/origin/token 防线。不登录 GitHub，不提交 issue，不运行模型。测试脚本故意要求显式提供路径，不会默认操作你的插件安装。
