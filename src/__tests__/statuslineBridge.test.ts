import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Bridge la file .cjs trong media/ (khong qua tsc). Test bang cach chay that voi
// CLAUDE_CONFIG_DIR tro vao 1 thu muc tam -> khong dung vao ~/.claude that.
const BRIDGE = path.resolve(process.cwd(), 'media', 'statusline-bridge.cjs');

let tmpDir: string;
let liveFile: string;

function runBridge(stdin: string): string {
  return execFileSync('node', [BRIDGE], {
    input: stdin,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_CONFIG_DIR: tmpDir },
  });
}

function readLive(): any {
  return JSON.parse(fs.readFileSync(liveFile, 'utf8'));
}

describe('statusline-bridge', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cay-bridge-'));
    liveFile = path.join(tmpDir, 'claude-autoyes-live.json');
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes rate_limits + context + cost and prints a status line', () => {
    const input = JSON.stringify({
      model: { display_name: 'Opus 4.8' },
      rate_limits: {
        five_hour: { used_percentage: 75, resets_at: 1738425600 },
        seven_day: { used_percentage: 10.4, resets_at: 1738857600 },
      },
      context_window: { used_percentage: 83 },
      cost: { total_cost_usd: 0.42 },
    });
    const out = runBridge(input);

    expect(out).toContain('5h:75%');
    expect(out).toContain('7d:10%'); // rounded
    expect(out).toContain('ctx:83%');

    const live = readLive();
    expect(live.model).toBe('Opus 4.8');
    expect(live.rateLimits.fiveHourPct).toBe(75);
    expect(live.rateLimits.fiveHourResetsAt).toBe(1738425600);
    expect(live.rateLimits.sevenDayPct).toBe(10.4);
    expect(live.rateLimits.sevenDayResetsAt).toBe(1738857600);
    expect(live.contextPct).toBe(83);
    expect(live.costUsd).toBe(0.42);
    expect(typeof live.updatedAt).toBe('number');
  });

  it('omits rateLimits when rate_limits is absent (e.g. before first response)', () => {
    const input = JSON.stringify({
      model: { display_name: 'Sonnet 4.6' },
      context_window: { used_percentage: 12 },
    });
    const out = runBridge(input);

    expect(out).toContain('Sonnet 4.6');
    expect(out).toContain('ctx:12%');
    expect(out).not.toContain('5h:');

    const live = readLive();
    expect(live.rateLimits).toBeUndefined();
    expect(live.contextPct).toBe(12);
  });

  it('does not crash on malformed JSON and prints a fallback', () => {
    const out = runBridge('{not valid json');
    expect(out).toBe('Claude');
    // Khong ghi file khi input hong
    expect(fs.existsSync(liveFile)).toBe(false);
  });

  it('does not crash on empty stdin', () => {
    const out = runBridge('');
    expect(out).toBe('Claude');
  });
});
