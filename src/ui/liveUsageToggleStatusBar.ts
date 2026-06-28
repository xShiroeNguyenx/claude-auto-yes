import * as vscode from 'vscode';

// Nut status bar LUON HIEN de bat/tat Live Usage (giong nut Auto-Yes). Cac so
// 5h/7d/context hien o o ben canh (LiveUsageStatusBar); nut nay chi la cong tac on/off.
export class LiveUsageToggleStatusBar {
  private readonly item: vscode.StatusBarItem;
  private enabled = false;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 98);
    this.item.command = 'claudeAutoYes.toggleLiveUsage';
    this.item.show();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.render();
  }

  private render(): void {
    if (this.enabled) {
      this.item.text = '$(pulse) Live: ON';
    } else {
      this.item.text = '$(circle-slash) Live: OFF';
    }
    this.item.tooltip = this.buildTooltip();
  }

  private buildTooltip(): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.supportThemeIcons = true;
    md.appendMarkdown(`**Live usage (status line)** — ${this.enabled ? 'ĐANG BẬT ✅' : 'đang TẮT'}\n\n`);
    md.appendMarkdown(
      `Gắn \`statusLine\` của Claude Code vào bridge để hiện 5h/7d limit + context%. ` +
        `Số liệu hiển thị ở ô bên cạnh.\n\n`,
    );
    md.appendMarkdown(`_Bấm để ${this.enabled ? 'TẮT' : 'BẬT'}._`);
    return md;
  }

  dispose(): void {
    this.item.dispose();
  }
}
