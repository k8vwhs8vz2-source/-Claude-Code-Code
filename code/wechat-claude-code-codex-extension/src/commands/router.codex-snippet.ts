// Snippet for src/commands/router.ts
// Add codexPrompt to CommandResult and route /codex to the Codex provider.

export interface CommandResult {
  reply?: string;
  handled: boolean;
  claudePrompt?: string;
  codexPrompt?: string;
  sendFile?: string;
}

// Inside routeCommand(ctx), after parsing cmd and args:

switch (cmd) {
  case 'codex':
    if (!args) {
      return { reply: '用法: /codex <要发给 Codex 的内容>', handled: true };
    }
    return { handled: true, codexPrompt: args };

  case 'claude':
    if (!args) {
      return { reply: '用法: /claude <要发给 Claude Code 的内容>', handled: true };
    }
    return { handled: true, claudePrompt: args };
}
