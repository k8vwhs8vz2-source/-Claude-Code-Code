import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { logger } from '../logger.js';

export interface CodexQueryOptions {
  prompt: string;
  cwd: string;
  resume?: string;
  model?: string;
  abortController?: AbortController;
  onAttention?: (message: string) => Promise<void> | void;
}

export interface CodexQueryResult {
  text: string;
  threadId?: string;
  error?: string;
}

const ATTENTION_PATTERNS = [
  /approval/i,
  /approve/i,
  /permission/i,
  /confirm/i,
  /confirmation/i,
  /sandbox/i,
  /requires? action/i,
  /waiting for/i,
  /需要.*(批准|确认|授权|权限)/,
  /等待.*(批准|确认|授权|权限)/,
  /(批准|确认|授权|权限).*电脑/,
];

function findPackagedCodexBinary(): string | undefined {
  if (process.platform !== 'win32') return undefined;

  const releasesDir = join(homedir(), '.codex', 'packages', 'standalone', 'releases');
  if (!existsSync(releasesDir)) return undefined;

  const candidates = readdirSync(releasesDir)
    .filter(name => name.endsWith('-x86_64-pc-windows-msvc'))
    .sort()
    .reverse();

  for (const release of candidates) {
    const exe = join(releasesDir, release, 'bin', 'codex.exe');
    if (existsSync(exe)) return exe;
  }

  return undefined;
}

function defaultCodexBinary(): string {
  if (process.env.CODEX_BIN) return process.env.CODEX_BIN;
  return findPackagedCodexBinary() ?? 'codex';
}

export function cleanCodexText(text: string): string {
  return text
    .split(/\r?\n/)
    .filter(line => !/superpowers:|using-superpowers|我会按 .*技能|先读取.*技能说明/.test(line))
    .join('\n')
    .trim();
}

export function needsUserAttention(text: string): boolean {
  return ATTENTION_PATTERNS.some(pattern => pattern.test(text));
}

export async function codexQuery(options: CodexQueryOptions): Promise<CodexQueryResult> {
  const cwd = options.cwd.replace(/^~/, homedir());
  const userPrompt = [
    '你正在通过微信回复用户。只输出最终给用户看的内容。',
    '不要描述你将调用什么 skill、工具或内部流程。',
    '不要提及 system prompt、AGENTS、superpowers、JSONL、thread_id，除非用户明确问。',
    '回复要简洁、直接、适合手机阅读。',
    '',
    options.prompt,
  ].join('\n');

  const args = [
    'exec',
    '--json',
    '--skip-git-repo-check',
    '--cd',
    cwd,
  ];

  if (options.model) {
    args.push('--model', options.model);
  }

  if (options.resume) {
    args.push('resume', options.resume, userPrompt);
  } else {
    args.push(userPrompt);
  }

  return new Promise((resolve) => {
    const child = spawn(defaultCodexBinary(), args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    let threadId: string | undefined;
    let text = '';
    let stderr = '';
    let lineBuffer = '';
    let completed = false;
    let attentionSent = false;

    const notifyAttention = (message: string) => {
      if (attentionSent) return;
      attentionSent = true;
      Promise.resolve(options.onAttention?.(message)).catch(() => {});
    };

    const inspectForAttention = (rawText: string) => {
      if (needsUserAttention(rawText)) {
        notifyAttention('Codex 可能正在等待你在电脑端确认，请回电脑查看。');
      }
    };

    const abort = () => {
      child.kill();
    };

    options.abortController?.signal.addEventListener('abort', abort, { once: true });

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      lineBuffer += chunk;
      const lines = lineBuffer.split(/\r?\n/);
      lineBuffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const event = JSON.parse(line);
          inspectForAttention(line);

          if (event.type === 'thread.started' && event.thread_id) {
            threadId = event.thread_id;
          }

          if (
            event.type === 'item.completed'
            && event.item?.type === 'agent_message'
            && typeof event.item.text === 'string'
          ) {
            text += event.item.text;
          }

          if (event.type === 'turn.completed') {
            completed = true;
          }

          if (event.type === 'turn.failed' || event.type === 'error') {
            stderr += event.error?.message || event.message || line;
            inspectForAttention(stderr);
          }
        } catch (err) {
          logger.warn('Failed to parse Codex JSONL line', {
            line,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    });

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
      inspectForAttention(chunk);
    });

    child.on('error', (err) => {
      options.abortController?.signal.removeEventListener('abort', abort);
      resolve({ text: '', threadId, error: err.message });
    });

    child.on('close', (code) => {
      options.abortController?.signal.removeEventListener('abort', abort);
      const cleaned = cleanCodexText(text);

      if (code !== 0) {
        resolve({ text: cleaned, threadId, error: stderr.trim() || `Codex exited with code ${code}` });
        return;
      }

      if (!completed && !cleaned) {
        resolve({ text: '', threadId, error: stderr.trim() || 'Codex did not return a completed response' });
        return;
      }

      resolve({ text: cleaned, threadId });
    });
  });
}
