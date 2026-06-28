#!/usr/bin/env node
/*
 * install.cjs — Merge cau hinh auto-yes vao ~/.claude/settings.json (idempotent, an toan).
 *
 *   node scripts/install.cjs
 *
 * - Tu backup settings.json -> settings.json.bak-<timestamp>
 * - Them permissions.deny (lop phong thu thu 2) neu chua co
 * - Append hook PreToolUse tro toi hooks/auto-yes.cjs (khong dung cac hook san co)
 * - Tu tinh duong dan tuyet doi cua hook theo vi tri repo (chay lai duoc sau khi di chuyen repo)
 * Chay lai nhieu lan KHONG tao trung lap.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const SETTINGS = path.join(CONFIG_DIR, 'settings.json');
const HOOK_PATH = path.resolve(__dirname, '..', 'hooks', 'auto-yes.cjs');
const HOOK_CMD = `node "${HOOK_PATH}"`;

const WANT_DENY = [
  'Bash(rm -rf *)',
  'Bash(git push --force *)',
  'Bash(git reset --hard *)',
  'PowerShell(Remove-Item * -Recurse -Force *)',
  'Edit(.git/**)',
  'Edit(.claude/**)',
];

function stamp() {
  // YYYYMMDD-HHMMSS theo gio may
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

if (!fs.existsSync(HOOK_PATH)) {
  console.error(`[LOI] Khong thay hook: ${HOOK_PATH}`);
  process.exit(1);
}

// Neu may chua co ~/.claude/settings.json (user moi) -> tao moi tu {}
let raw = '{}';
let isNew = true;
if (fs.existsSync(SETTINGS)) {
  raw = fs.readFileSync(SETTINGS, 'utf8');
  isNew = false;
} else {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}
const hadBom = raw.charCodeAt(0) === 0xfeff;
if (hadBom) raw = raw.slice(1);

let j;
try {
  j = JSON.parse(raw);
} catch (e) {
  console.error('[LOI] settings.json khong parse duoc, dung lai de tranh hong file:', e.message);
  process.exit(1);
}

// Backup truoc khi sua (chi khi da co file san)
let bak = '(khong - file moi tao)';
if (!isNew) {
  bak = `${SETTINGS}.bak-${stamp()}`;
  fs.writeFileSync(bak, raw, 'utf8');
}

// 1) permissions.deny (them, khong xoa cai dang co)
j.permissions = j.permissions || {};
const deny = Array.isArray(j.permissions.deny) ? j.permissions.deny : [];
let addedDeny = 0;
for (const r of WANT_DENY) {
  if (!deny.includes(r)) { deny.push(r); addedDeny++; }
}
j.permissions.deny = deny;

// 2) hooks.PreToolUse (append, idempotent)
j.hooks = j.hooks || {};
j.hooks.PreToolUse = Array.isArray(j.hooks.PreToolUse) ? j.hooks.PreToolUse : [];
const already = JSON.stringify(j.hooks.PreToolUse).includes('auto-yes.cjs');
if (!already) {
  j.hooks.PreToolUse.push({
    matcher: '*',
    hooks: [{ type: 'command', command: HOOK_CMD, timeout: 10 }],
  });
}

fs.writeFileSync(SETTINGS, JSON.stringify(j, null, 2) + '\n', 'utf8');

console.log('=== Cai dat auto-yes: OK ===');
console.log('Settings:          ', SETTINGS, isNew ? '(tao moi)' : '');
console.log('Backup:            ', bak);
console.log('Hook:              ', HOOK_CMD);
console.log('Them deny rule:    ', addedDeny, '(tong deny:', j.permissions.deny.length + ')');
console.log('Hook auto-yes:     ', already ? 'da co tu truoc (khong them lai)' : 'da them moi');
console.log('Tong PreToolUse:   ', j.hooks.PreToolUse.length);
console.log('');
console.log('=> Khoi dong lai Claude Code 1 lan de nap hook. Sau do bat/tat bang scripts/auto-yes-*.ps1');
