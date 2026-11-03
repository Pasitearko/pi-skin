# frame-click-toggle

已有可折叠 ALPS 框的细线边框、标题和正文均可单击。`/frame-clicks on|off|status`。拖选、修饰键、链接和交互按钮优先。未知 Pi/ALPS 私有布局保守回退。

仅适配 Pi 1.5.0 / ALPS 0.3.4（renderer 18）；其他 Pi 版本不安装 hook，保留原生行为。

命中检测只读最后显示的几何，不提前渲染 1.5.0 的待处理工具参数；真实展开动作仍调用 Pi 原生 setter。CUSTOM 读取原生 `_expanded` 状态；空标签隐藏 THINK 不产生可点击框，多段 THINK 保持独立切换。25 项回归同时覆盖与选区去框组合的真实拖选。

完整安装、版本限制、可选高级补丁和安全说明见 [项目 README](../../README.md)。本扩展不会导入作者的账号、会话或配置。
