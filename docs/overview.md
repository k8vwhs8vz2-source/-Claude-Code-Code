# Overview

本项目记录一次微信桥接改造：在已经可用的 **WeChat -> Claude Code** 桥基础上，增加 **WeChat -> Codex CLI** 的访问能力。

最终交互方式：

```text
普通微信消息       -> Claude Code
/codex <你的问题> -> Codex CLI
```

当前状态：MVP 已完成，可日常试用。

## 参考来源

主要参考项目：

- [Wechat-ggGitHub/wechat-claude-code](https://github.com/Wechat-ggGitHub/wechat-claude-code)

从原项目借鉴的核心体验：

- 微信端应知道电脑端正在处理。
- 输出要适合手机阅读。
- 不把工具调用、内部日志、原始 JSON、命令噪声推给用户。
- 只推送进度、关键提醒、最终结果和必要文件。

## 为什么不用两个微信入口

早期设想是：

```text
微信 bot A -> Claude Code
微信 bot B -> Codex CLI
```

短期没有采用，因为用户实际只有一个已验证的 ClawBot / OpenClaw 微信入口。为了减少微信侧变量，当前选择在同一个入口里用 `/codex` 分流。

## 当前边界

已完成：

```text
普通消息 -> Claude Code
/codex ... -> Codex CLI
Codex 最终回复 -> 微信
Codex 即时反馈 -> 微信
Codex 长时间无结果提醒 -> 微信
桥内疑似审批/权限等待提醒 -> 微信
```

未完成：

```text
Codex 桌面端单独任务的全局审批提醒
Claude Code 桌面端单独任务的全局审批提醒
Windows 后台守护/开机自启/防重复进程
Codex 更细粒度 JSONL 状态翻译
```
