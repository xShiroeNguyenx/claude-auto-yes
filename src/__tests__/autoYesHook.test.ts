import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const HOOK = path.resolve(process.cwd(), 'media', 'auto-yes-hook.cjs');

let tmpDir: string;
let flagFile: string;

function runHook(toolInput: object, toolName = 'Bash'): string {
  return execFileSync('node', [HOOK], {
    input: JSON.stringify({ tool_name: toolName, tool_input: toolInput }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_CONFIG_DIR: tmpDir },
  });
}

function setFlag(obj: object): void {
  fs.writeFileSync(flagFile, JSON.stringify(obj), 'utf8');
}

function inHours(h: number): string {
  return new Date(Date.now() + h * 3600_000).toISOString();
}

function decisionOf(out: string): string | null {
  if (!out.trim()) return null;
  return JSON.parse(out).hookSpecificOutput.permissionDecision;
}

describe('auto-yes-hook', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cay-autoyes-'));
    flagFile = path.join(tmpDir, 'auto-yes.json');
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('defers (no output) when no flag file exists', () => {
    expect(decisionOf(runHook({ command: 'npm test' }))).toBeNull();
  });

  it('defers when flag is disabled', () => {
    setFlag({ enabled: false, expiresAt: inHours(24) });
    expect(decisionOf(runHook({ command: 'npm test' }))).toBeNull();
  });

  it('allows a safe command when enabled and not expired', () => {
    setFlag({ enabled: true, expiresAt: inHours(24) });
    expect(decisionOf(runHook({ command: 'npm test' }))).toBe('allow');
    expect(decisionOf(runHook({ command: 'php artisan migrate' }, 'PowerShell'))).toBe('allow');
  });

  it('asks for git commit/push/tag even when enabled', () => {
    setFlag({ enabled: true, expiresAt: inHours(24) });
    expect(decisionOf(runHook({ command: 'git commit -m x' }))).toBe('ask');
    expect(decisionOf(runHook({ command: 'git push origin main' }))).toBe('ask');
  });

  it('denies destructive commands', () => {
    setFlag({ enabled: true, expiresAt: inHours(24) });
    expect(decisionOf(runHook({ command: 'rm -rf /tmp/x' }))).toBe('deny');
    expect(decisionOf(runHook({ command: 'git push --force origin main' }))).toBe('deny');
    expect(decisionOf(runHook({ command: 'Remove-Item dist -Recurse -Force' }, 'PowerShell'))).toBe('deny');
  });

  it('asks for edits to sensitive paths', () => {
    setFlag({ enabled: true, expiresAt: inHours(24) });
    expect(decisionOf(runHook({ file_path: 'd:/proj/.env' }, 'Edit'))).toBe('ask');
  });

  it('honors extraBlock from the flag file', () => {
    setFlag({ enabled: true, expiresAt: inHours(24), extraBlock: ['docker\\s+system\\s+prune'] });
    expect(decisionOf(runHook({ command: 'docker system prune -a' }))).toBe('deny');
  });

  it('defers when the flag is expired', () => {
    setFlag({ enabled: true, expiresAt: inHours(-1) });
    expect(decisionOf(runHook({ command: 'npm test' }))).toBeNull();
  });

  it('does not crash on malformed flag file', () => {
    fs.writeFileSync(flagFile, '{bad json', 'utf8');
    expect(decisionOf(runHook({ command: 'npm test' }))).toBeNull();
  });
});
