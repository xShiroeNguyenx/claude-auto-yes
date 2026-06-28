#!/usr/bin/env node
/*
 * uninstall.cjs — Go cau hinh auto-yes khoi ~/.claude/settings.json (an toan, co backup).
 *
 *   node scripts/uninstall.cjs            # go hook auto-yes (giu lai deny rule cho an toan)
 *   node scripts/uninstall.cjs --all      # go ca hook lan 6 deny rule do auto-yes them
 *
 * KHONG dung toi cac hook khac (vd pixel-agents) hay deny rule ban tu them.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const SETTINGS = path.join(CONFIG_DIR, 'settings.json');
const REMOVE_ALL = process.argv.includes('--all');

const WANT_DENY = [
  'Bash(rm -rf *)',
  'Bash(git push --force *)',
  'Bash(git reset --hard *)',
  'PowerShell(Remove-Item * -Recurse -Force *)',
  'Edit(.git/**)',
  'Edit(.claude/**)',
];

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

if (!fs.existsSync(SETTINGS)) {
  console.log('Khong thay settings.json -> khong co gi de go.');
  process.exit(0);
}

let raw = fs.readFileSync(SETTINGS, 'utf8');
const hadBom = raw.charCodeAt(0) === 0xfeff;
if (hadBom) raw = raw.slice(1);
const j = JSON.parse(raw);

const bak = `${SETTINGS}.bak-${stamp()}`;
fs.writeFileSync(bak, raw, 'utf8');

// Go entry hook co tham chieu auto-yes.cjs
let removedHooks = 0;
if (j.hooks && Array.isArray(j.hooks.PreToolUse)) {
  const before = j.hooks.PreToolUse.length;
  j.hooks.PreToolUse = j.hooks.PreToolUse.filter(
    (e) => !JSON.stringify(e).includes('auto-yes.cjs')
  );
  removedHooks = before - j.hooks.PreToolUse.length;
}

// (Tuy chon) go deny rule do auto-yes them
let removedDeny = 0;
if (REMOVE_ALL && j.permissions && Array.isArray(j.permissions.deny)) {
  const before = j.permissions.deny.length;
  j.permissions.deny = j.permissions.deny.filter((r) => !WANT_DENY.includes(r));
  removedDeny = before - j.permissions.deny.length;
}

fs.writeFileSync(SETTINGS, JSON.stringify(j, null, 2) + '\n', 'utf8');

console.log('=== Go auto-yes: OK ===');
console.log('Backup:          ', bak);
console.log('Go hook auto-yes:', removedHooks);
console.log('Go deny rule:    ', REMOVE_ALL ? removedDeny : '(giu lai - dung --all de go ca deny)');
console.log('');
console.log('=> Co the xoa thu cong file co/log: ' + path.join(CONFIG_DIR, 'auto-yes.json') + ' va auto-yes.log');
