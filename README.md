# WeChat Claude Code / Codex Bridge Notes

This repository records the local spike and implementation notes for extending a WeChat Claude Code bridge so the same WeChat entry can also route selected messages to Codex CLI.

Current working behavior:

- Normal WeChat messages go to Claude Code.
- Messages starting with `/codex` go to Codex CLI.
- Codex replies are returned to WeChat.
- Codex now sends lightweight progress feedback before the final answer.

Primary write-up:

- [WeChat Codex bridge implementation notes](docs/wechat-codex-bridge-2026-06-12.md)
