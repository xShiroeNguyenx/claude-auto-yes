import * as vscode from 'vscode';
import { LiveUsage } from '../types';

// Live snapshot (5h/7d/ctx) chi tin cay neu duoc cap nhat gan day. Khi phien Claude
// Code idle, statusLine khong duoc goi -> du lieu cu dan; van hien gia tri cuoi nhung
// danh dau "(cu)" trong tooltip.
const LIVE_STALE_MS = 10 * 60 * 1000;

// O status bar hien so lieu live usage (5h/7d limit + context% + cost). Chi hien khi
// da co snapshot tu bridge; an di khi chua co du lieu. Day la ban rut gon tu
// claude-tracker/ui/statusBar.ts — da bo het phan token/team/backend.
export class LiveUsageStatusBar {
  private readonly item: vscode.StatusBarItem;
  private live: LiveUsage | null = null;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = 'claudeAutoYes.toggleLiveUsage';
  }

  // Goi boi LiveUsageWatcher moi khi bridge ghi snapshot moi.
  setLiveUsage(live: LiveUsage): void {
    this.live = live;
    this.render();
  }

  // Xoa phan live (vd khi nguoi dung tat Live Usage).
  clearLiveUsage(): void {
    this.live = null;
    this.render();
  }

  private render(): void {
    const seg = this.liveSegment();
    if (!seg) {
      // Chua co du lieu -> an o nay cho gon.
      this.item.hide();
      return;
    }
    this.item.text = seg;
    this.item.tooltip = this.buildTooltip();
    this.item.show();
  }

  private liveSegment(): string {
    const rl = this.live?.rateLimits;
    const seg: string[] = [];
    if (rl) {
      if (rl.fiveHourPct !== undefined) seg.push(`5h ${Math.round(rl.fiveHourPct)}%`);
      if (rl.sevenDayPct !== undefined) seg.push(`7d ${Math.round(rl.sevenDayPct)}%`);
    }
    if (this.live?.contextPct !== undefined) seg.push(`ctx ${Math.round(this.live.contextPct)}%`);
    return seg.length ? `$(pulse) ${seg.join(' · ')}` : '';
  }

  private buildTooltip(): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.supportThemeIcons = true;
    if (this.live) this.appendLiveSection(md, this.live);
    md.appendMarkdown(`_Bấm để bật/tắt Live Usage._`);
    return md;
  }

  private appendLiveSection(md: vscode.MarkdownString, live: LiveUsage): void {
    const rl = live.rateLimits;
    const modelSuffix = live.model ? ` · ${live.model}` : '';
    md.appendMarkdown(`**Live usage**${modelSuffix}\n\n`);
    if (rl) {
      md.appendMarkdown(`| Window | Used | Reset |\n|---|---:|---|\n`);
      if (rl.fiveHourPct !== undefined) {
        md.appendMarkdown(`| Session (5h) | ${Math.round(rl.fiveHourPct)}% | ${formatResetIn(rl.fiveHourResetsAt)} |\n`);
      }
      if (rl.sevenDayPct !== undefined) {
        md.appendMarkdown(`| Weekly (7d) | ${Math.round(rl.sevenDayPct)}% | ${formatResetIn(rl.sevenDayResetsAt)} |\n`);
      }
    } else {
      md.appendMarkdown(`_Đang chờ giới hạn (chỉ có với Pro/Max, sau phản hồi đầu tiên)._\n`);
    }
    if (live.contextPct !== undefined) md.appendMarkdown(`\nContext: **${Math.round(live.contextPct)}%**`);
    if (live.costUsd !== undefined) md.appendMarkdown(` · Cost: **$${live.costUsd.toFixed(2)}**`);
    const staleNote = Date.now() - live.updatedAt > LIVE_STALE_MS ? ' ⚠️ (cũ)' : '';
    md.appendMarkdown(`\n\n_Cập nhật ${formatAge(live.updatedAt)}${staleNote}_\n\n---\n\n`);
  }

  dispose(): void {
    this.item.dispose();
  }
}

// epoch seconds -> "tự reset trong" dạng ngắn.
function formatResetIn(epochSec?: number): string {
  if (epochSec === undefined) return '—';
  const secs = epochSec - Math.floor(Date.now() / 1000);
  if (secs <= 0) return 'sắp reset';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

function formatAge(updatedAtMs: number): string {
  const m = Math.round((Date.now() - updatedAtMs) / 60000);
  if (m < 1) return 'vừa xong';
  if (m < 60) return `${m} phút trước`;
  return `${Math.round(m / 60)} giờ trước`;
}
