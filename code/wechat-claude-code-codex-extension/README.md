# Sanitized Codex Extension Files

This directory contains the key sanitized source files used to extend `wechat-claude-code` with a Codex CLI route.

These files are intentionally not a full copy of the local skill installation.

Excluded on purpose:

- `node_modules/`
- `dist/` build output
- WeChat account files
- bot tokens
- session files
- logs
- QR code images
- local user-specific absolute paths

The implementation pattern is:

```text
Normal WeChat text -> Claude Code
/codex <prompt>    -> Codex CLI
```

Files:

- `src/codex/provider.ts`: Codex CLI adapter using `codex exec --json`.
- `src/main.codex-snippet.ts`: the `sendToCodex` integration snippet for the daemon.
- `src/commands/router.codex-snippet.ts`: slash command routing changes.
- `src/session.codex-snippet.ts`: session shape changes for Codex thread IDs and provider labels.
- `src/tests/codex-attention.test.ts`: attention detection tests.
- `src/tests/codex-route.test.ts`: route behavior tests.

To apply this to a real checkout of the reference project, merge these snippets into the corresponding files in:

- https://github.com/Wechat-ggGitHub/wechat-claude-code

Then run:

```powershell
npm.cmd run build
npm.cmd test
```
