# working-timer · Linux

本轮 Working / Completed / Failed / Cancelled 状态与计时，`agent_settled` 最终结算后只播放一次。Linux 用 `/usr/bin/pw-play`，音量为单个播放器 100%，不更改系统音量。`/sound-test` 可手工测试；文件缺失/播放失败不改变本轮结果。

本目录不分发音频。默认使用 `~/.local/share/pi/sounds/minecraft-exp-orb.wav`（兼容本机路径），也可用 `PI_COMPLETION_SOUND` 指定自备文件的绝对路径。Windows MCI 分支仅保留源码，此 Linux 包不含 Windows 音频资产。

详见 [Linux 安装、提示音及隐私说明](../../README.md)。
