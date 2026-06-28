#!/usr/bin/env node
/*
 * auto-yes-hook.cjs — PreToolUse hook cho Claude Code (do extension Claude Auto-Yes cài).
 *
 * Khi file cờ <CONFIG_DIR>/auto-yes.json đang BẬT và còn hạn:
 *   - Lệnh trong BLOCK_PATTERNS  -> permissionDecision "deny"  (chặn hẳn)
 *   - Lệnh trong CONFIRM_PATTERNS-> permissionDecision "ask"   (vẫn hiện dialog)
 *   - Còn lại                    -> permissionDecision "allow" (tự Yes)
 * Khi cờ TẮT / hết hạn / thiếu file / có bất kỳ lỗi nào:
 *   - KHÔNG in gì, exit 0  => Claude Code hỏi như bình thường (fail-safe).
 *
 * Nguyên tắc: KHÔNG BAO GIỜ tự "allow" khi gặp lỗi. Node thuần, không dependency.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

// Thu muc cau hinh Claude: ton trong CLAUDE_CONFIG_DIR neu user dat, mac dinh ~/.claude
const CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const FLAG_FILE = path.join(CONFIG_DIR, 'auto-yes.json');
const LOG_FILE = path.join(CONFIG_DIR, 'auto-yes.log');

// ---- Danh sách quy tắc (sửa thoải mái) ------------------------------------

// BLOCK: lệnh huỷ diệt / không thể hoàn tác -> luôn chặn hẳn.
const BLOCK_PATTERNS = [
  // Xoá đệ quy (bash + PowerShell)
  /\brm\s+-\w*r\w*f/i,                       // rm -rf, rm -Rf...
  /\brm\s+-\w*f\w*r/i,                       // rm -fr
  /\brm\s+-r\b[\s\S]*-f\b/i,                 // rm -r ... -f
  /\brm\s+-f\b[\s\S]*-r\b/i,                 // rm -f ... -r
  /-Recurse\b[\s\S]*-Force\b/i,             // Remove-Item -Recurse -Force
  /-Force\b[\s\S]*-Recurse\b/i,             // Remove-Item -Force -Recurse
  /\b(rmdir|rd)\b[\s\S]*\/s\b/i,            // rmdir /s
  /\bdel\b[\s\S]*\/(s|q)\b/i,               // del /s , del /q
  // Format / phân vùng đĩa
  /\bformat\s+([a-z]:|\/)/i,                 // format c:  (tránh nhầm "npm run format")
  /\bdiskpart\b/i,
  /\bmkfs\w*/i,
  /\bFormat-Volume\b/i,
  /\bClear-Disk\b/i,
  // Git phá lịch sử / đẩy mạnh
  /git\s+push\b[\s\S]*(--force|--force-with-lease|\s-f\b)/i,
  /git\s+push\b[\s\S]*--tags\b/i,
  /git\s+reset\s+--hard\b/i,
  /git\s+rebase\b/i,
  /git\s+filter-branch\b/i,
  /git\s+clean\s+-\w*f/i,
  /git\s+update-ref\s+-d\b/i,
  // Publish / release ra ngoài
  /\b(npm|yarn|pnpm)\s+publish\b/i,
  /\bgh\s+release\b/i,
  // Hệ thống
  /\bshutdown\b/i,
  /\bStop-Computer\b/i,
  /\bRestart-Computer\b/i,
  /\breg\s+delete\b/i,
  /\bSet-ExecutionPolicy\b/i,
  // Tải rồi thực thi
  /(curl|wget)\b[\s\S]*\|\s*(sudo\s+)?(ba)?sh\b/i,
  /(iwr|Invoke-WebRequest|curl)\b[\s\S]*\|\s*(iex|Invoke-Expression)/i,
  /\b(iex|Invoke-Expression)\b/i,
];

// CONFIRM: vẫn hiện dialog dù auto-yes đang bật (tôn trọng CLAUDE.md).
const CONFIRM_PATTERNS = [
  /git\s+commit\b/i,
  /git\s+push\b/i,
  /git\s+tag\b/i,
];

// CONFIRM theo đường dẫn (cho Edit/Write/MultiEdit/NotebookEdit).
const CONFIRM_PATH_PATTERNS = [
  /(^|[\\/])\.env(\.|$)/i,
  /[\\/]\.git[\\/]/i,
  /[\\/]\.claude[\\/]/i,
  /credential/i,
  /id_rsa/i,
  /\.pem$/i,
  /secret/i,
];

// ---------------------------------------------------------------------------

function out(decision, reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
      permissionDecisionReason: reason,
    },
  }));
}

function logLine(entry) {
  try {
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
  } catch (_) {
    /* logging không được phép làm hỏng hook */
  }
}

function matchAny(patterns, text) {
  for (const re of patterns) {
    if (re.test(text)) return re.source;
  }
  return null;
}

// Loại BOM ở đầu chuỗi (file do PowerShell ghi có thể kèm UTF-8 BOM).
function stripBom(s) {
  return s && s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function main() {
  // 1) Đọc input từ stdin. Lỗi -> defer.
  let raw;
  try {
    raw = fs.readFileSync(0, 'utf8');
  } catch (_) {
    return; // defer
  }

  let input;
  try {
    input = JSON.parse(stripBom(raw));
  } catch (_) {
    return; // defer
  }

  // 2) Đọc file cờ. Thiếu / lỗi -> defer.
  let flag;
  try {
    flag = JSON.parse(stripBom(fs.readFileSync(FLAG_FILE, 'utf8')));
  } catch (_) {
    return; // chưa bật -> defer
  }

  if (!flag || flag.enabled !== true) return; // defer

  // 3) Kiểm tra hết hạn.
  if (flag.expiresAt) {
    const exp = Date.parse(flag.expiresAt);
    if (!Number.isNaN(exp) && Date.now() > exp) {
      logLine({ ts: new Date().toISOString(), decision: 'defer', rule: 'expired' });
      return; // hết hạn -> defer
    }
  }

  const toolName = input.tool_name || '';
  const ti = input.tool_input || {};
  const command = typeof ti.command === 'string' ? ti.command : '';
  const filePath =
    (typeof ti.file_path === 'string' && ti.file_path) ||
    (typeof ti.notebook_path === 'string' && ti.notebook_path) ||
    '';

  // Cho phép sentinel mở rộng danh sách mà không cần sửa code.
  const extraBlock = Array.isArray(flag.extraBlock) ? flag.extraBlock : [];
  const extraConfirm = Array.isArray(flag.extraConfirm) ? flag.extraConfirm : [];
  const toRe = (s) => { try { return new RegExp(s, 'i'); } catch (_) { return null; } };
  const blockList = BLOCK_PATTERNS.concat(extraBlock.map(toRe).filter(Boolean));
  const confirmList = CONFIRM_PATTERNS.concat(extraConfirm.map(toRe).filter(Boolean));

  const subject = command || filePath;
  const expNote = flag.expiresAt ? ` (hết hạn ${flag.expiresAt})` : '';
  const base = {
    ts: new Date().toISOString(),
    tool: toolName,
    command: command || undefined,
    path: filePath || undefined,
  };

  // 4) BLOCK
  if (command) {
    const hit = matchAny(blockList, command);
    if (hit) {
      out('deny', `auto-yes: lệnh nguy hiểm bị chặn (rule: ${hit})`);
      logLine({ ...base, decision: 'deny', rule: hit });
      return;
    }
  }

  // 5) CONFIRM (theo lệnh hoặc theo đường dẫn)
  if (command) {
    const hit = matchAny(confirmList, command);
    if (hit) {
      out('ask', `auto-yes: cần xác nhận tay (rule: ${hit})`);
      logLine({ ...base, decision: 'ask', rule: hit });
      return;
    }
  }
  if (filePath) {
    const hit = matchAny(CONFIRM_PATH_PATTERNS, filePath);
    if (hit) {
      out('ask', `auto-yes: đường dẫn nhạy cảm, cần xác nhận tay (rule: ${hit})`);
      logLine({ ...base, decision: 'ask', rule: hit });
      return;
    }
  }

  // 6) ALLOW
  out('allow', `auto-yes ON${expNote}`);
  logLine({ ...base, decision: 'allow', rule: subject ? 'default-allow' : 'allow-no-subject' });
}

try {
  main();
} catch (_) {
  // Bất kỳ lỗi ngoài dự kiến nào -> không in gì -> defer (an toàn).
  process.exit(0);
}
