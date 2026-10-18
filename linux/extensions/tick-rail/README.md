# tick-rail

Linux 当前使用的右侧提问刻度条，与根目录历史版 conversation-timeline 分开保存。靠近右侧显示刻度，支持鼠标浏览/跳转与提问预览；`/rail on/off/status/list`，`Alt+[` / `Alt+]` / `Alt+J`。读取当前会话的本地布局，不包含或上传历史会话数据。

同时提供 subscription-usage 的 UI 共享行桥；认证/额度查询由独立上游插件负责，本扩展不携带账号。使用 Pi fullscreen 的私有绘制/鼠标接口，目前只在 Pi 1.3.0 验证；升级前重新测试，不保证其他版本。

[Linux 配置说明](../../README.md)
