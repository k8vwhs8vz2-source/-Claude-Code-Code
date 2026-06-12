# Troubleshooting

本文记录本次桥接改造中实际遇到的问题和处理方式。

## 1. 本机没有 Codex CLI

现象：无法运行 `codex exec`。

解决：安装官方 Codex CLI，并确认：

```powershell
codex exec --help
codex exec --json --skip-git-repo-check --cd <cwd> "ping"
```

## 2. WindowsApps 的 codex.exe 不可用

现象：某些 PATH / WindowsApps 路径返回：

```text
Access is denied
```

解决：桥接层不要依赖 WindowsApps 路径。优先使用：

```text
CODEX_BIN 环境变量
或 <USER_HOME>\.codex\packages\standalone\releases\<version>\bin\codex.exe
```

## 3. Codex 输出内部流程噪声

现象：最终回复里出现 skill / superpowers / 内部流程说明。

解决：

- prompt 中要求只输出最终给用户看的内容。
- `cleanCodexText()` 过滤已观察到的内部 chatter。

## 4. /codex 被当成未知 skill

现象：微信返回：

```text
未找到 skill: codex 输入 /skills 查看可用列表
```

原因：旧桥进程还在跑，或者新代码没有重启生效。

解决：

- 编译新版本。
- 重启桥。
- 清理旧桥进程。

## 5. 同一条消息先报错再成功

现象：微信里一条错误回复后又出现正常回复。

根因：两个 `node.exe` 桥进程同时轮询同一个微信账号。

解决：只停止确认过的旧桥 PID，不要执行：

```powershell
Stop-Process -Name node
```

因为 Codex Desktop 也使用 Node。

## 6. PowerShell npm start 被执行策略拦截

现象：

```text
npm.ps1 cannot be loaded because running scripts is disabled on this system
```

解决：使用：

```powershell
npm.cmd start
```
