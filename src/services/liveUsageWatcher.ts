import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { LiveUsage } from '../types';

export interface LiveUsageWatcherOptions {
  // Override file path (mainly for tests). Default: <CLAUDE_CONFIG_DIR|~/.claude>/claude-autoyes-live.json
  filePath?: string;
  onUpdate: (usage: LiveUsage) => void;
  log?: (msg: string) => void;
}

export function liveFilePath(): string {
  const dir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  return path.join(dir, 'claude-autoyes-live.json');
}

// Theo doi file snapshot ma media/statusline-bridge.cjs ghi ra, emit LiveUsage da
// parse. Dung fs.watchFile (poll) thay vi chokidar — zero dependency, va van bat
// duoc ca khi file CHUA ton tai (watchFile fire khi file xuat hien). Loi doc/parse
// bi bo qua (gia tri tot cuoi cung van o lai StatusBar) — file ghi atomic nen hiem
// khi doc trung luc dang ghi do.
export class LiveUsageWatcher {
  private watching = false;
  private readonly file: string;

  constructor(private readonly opts: LiveUsageWatcherOptions) {
    this.file = opts.filePath || liveFilePath();
  }

  start(): void {
    if (this.watching) return;
    // Pick up a snapshot left by a previous session right away.
    void this.read();

    fs.watchFile(this.file, { interval: 1000 }, (curr) => {
      // mtime/size = 0 nghia la file bi xoa / chua ton tai -> bo qua, giu gia tri cu.
      if (curr.mtimeMs === 0) return;
      void this.read();
    });
    this.watching = true;
    this.opts.log?.(`[live] watching ${this.file} (fs.watchFile, interval=1000ms)`);
  }

  private async read(): Promise<void> {
    let raw: string;
    try {
      raw = await fsp.readFile(this.file, 'utf8');
    } catch {
      return; // file missing yet — fine
    }
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    let obj: any;
    try {
      obj = JSON.parse(raw);
    } catch {
      return; // half-written / corrupt — keep last good
    }
    if (!obj || typeof obj.updatedAt !== 'number') return;
    this.opts.onUpdate(obj as LiveUsage);
  }

  async stop(): Promise<void> {
    if (!this.watching) return;
    fs.unwatchFile(this.file);
    this.watching = false;
  }
}
