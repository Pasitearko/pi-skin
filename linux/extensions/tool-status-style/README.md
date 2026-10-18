# tool-status-style

只为工具框配置固定绿（正常/执行中 `#4ADE80`）/红（失败 `#F87171`），去掉工具正文背景及原生默认 CUSTOM Box 的背景。不修改总体主题、终端调色板、diff 加减色、assistant/thinking/skill 的共享颜色或注册 renderer 的背景。

TUI only；精确适配 Pi 1.3.0 与 ALPS 0.3.4。运行时 hook 在退出/卸载时按所有权还原。测试见 `tests/custom-background.mjs`，通过 Linux 测试启动器运行，避免依赖本机目录。

[Linux 配置说明](../../README.md)
