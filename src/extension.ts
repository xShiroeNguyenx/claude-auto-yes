import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import { AutoYesController } from './services/autoYesController';
import { StatuslineInstaller } from './services/statuslineInstaller';
import { LiveUsageWatcher } from './services/liveUsageWatcher';
import { AutoYesStatusBar } from './ui/autoYesStatusBar';
import { LiveUsageToggleStatusBar } from './ui/liveUsageToggleStatusBar';
import { LiveUsageStatusBar } from './ui/liveUsageStatusBar';

let disposed = false;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const out = vscode.window.createOutputChannel('Claude Auto-Yes');
  context.subscriptions.push(out);
  const log = (m: string) => out.appendLine(`[${new Date().toISOString()}] ${m}`);

  // globalStorage la noi dat ban copy ON DINH cua hook + bridge.
  await vscode.workspace.fs.createDirectory(context.globalStorageUri);

  const config = () => vscode.workspace.getConfiguration('claudeAutoYes');

  // ---- Auto-Yes ------------------------------------------------------------
  const autoYes = new AutoYesController(context, log);
  const autoYesBar = new AutoYesStatusBar(autoYes);
  autoYesBar.start();
  context.subscriptions.push({ dispose: () => autoYesBar.dispose() });
  if (autoYes.isHookInstalled()) {
    // Cap nhat ban copy hook phong khi extension vua duoc update.
    void autoYes.refreshHookCopy().catch((e) => log(`[auto-yes] refreshHookCopy failed: ${e}`));
  }

  // ---- Live Usage (status line) -------------------------------------------
  const liveInstaller = new StatuslineInstaller(context, log);
  const liveToggleBar = new LiveUsageToggleStatusBar();
  const liveNumbersBar = new LiveUsageStatusBar();
  liveToggleBar.setEnabled(liveInstaller.isEnabled());
  context.subscriptions.push({ dispose: () => liveToggleBar.dispose() });
  context.subscriptions.push({ dispose: () => liveNumbersBar.dispose() });

  let liveWatcher: LiveUsageWatcher | null = null;
  const startLiveWatcher = () => {
    if (liveWatcher) return;
    liveWatcher = new LiveUsageWatcher({ onUpdate: (u) => liveNumbersBar.setLiveUsage(u), log });
    liveWatcher.start();
  };
  const stopLiveWatcher = async () => {
    await liveWatcher?.stop();
    liveWatcher = null;
  };
  const enableLive = async (): Promise<string | null> => {
    const { backup } = await liveInstaller.enable();
    startLiveWatcher();
    liveToggleBar.setEnabled(true);
    return backup;
  };
  const disableLive = async (): Promise<void> => {
    await liveInstaller.disable();
    await stopLiveWatcher();
    liveNumbersBar.clearLiveUsage();
    liveToggleBar.setEnabled(false);
  };
  if (liveInstaller.isEnabled()) {
    void liveInstaller.refreshBridge().catch((e) => log(`[live] refreshBridge failed: ${e}`));
    startLiveWatcher();
  }

  // ---- Commands ------------------------------------------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeAutoYes.toggleAutoYes', async () => {
      try {
        if (autoYes.state().on) {
          await autoYes.disable();
          vscode.window.showInformationMessage('Auto-Yes: ĐÃ TẮT.');
        } else {
          const hours = config().get<number>('autoYes.hours') ?? 24;
          const { firstInstall } = await autoYes.enable(hours);
          const note = firstInstall
            ? ' Lần đầu: đã đăng ký hook — mở lại phiên Claude Code để có hiệu lực.'
            : '';
          vscode.window.showInformationMessage(`Auto-Yes: ĐÃ BẬT ${hours}h.${note}`);
        }
        autoYesBar.refresh();
      } catch (e: any) {
        vscode.window.showErrorMessage(`Toggle Auto-Yes thất bại: ${e?.message ?? e}`);
      }
    }),
    vscode.commands.registerCommand('claudeAutoYes.uninstallAutoYesHook', async () => {
      try {
        await autoYes.uninstallHook();
        autoYesBar.refresh();
        vscode.window.showInformationMessage('Auto-Yes: đã gỡ hook khỏi settings.json.');
      } catch (e: any) {
        vscode.window.showErrorMessage(`Gỡ Auto-Yes hook thất bại: ${e?.message ?? e}`);
      }
    }),
    vscode.commands.registerCommand('claudeAutoYes.showAutoYesLog', async () => {
      const logPath = path.join(
        process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'),
        'auto-yes.log',
      );
      try {
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(logPath));
        await vscode.window.showTextDocument(doc, { preview: false });
      } catch {
        vscode.window.showInformationMessage(`Chưa có log: ${logPath} (sẽ tạo sau quyết định auto-yes đầu tiên).`);
      }
    }),
    vscode.commands.registerCommand('claudeAutoYes.enableLiveUsage', async () => {
      try {
        const backup = await enableLive();
        const tail = backup ? ` (backup: ${backup})` : '';
        vscode.window.showInformationMessage(
          `Claude Auto-Yes: Live Usage đã bật. Mở lại phiên Claude Code để status line nạp lại.${tail}`,
        );
      } catch (e: any) {
        vscode.window.showErrorMessage(`Enable Live Usage thất bại: ${e?.message ?? e}`);
      }
    }),
    vscode.commands.registerCommand('claudeAutoYes.disableLiveUsage', async () => {
      try {
        await disableLive();
        vscode.window.showInformationMessage('Claude Auto-Yes: Live Usage đã tắt.');
      } catch (e: any) {
        vscode.window.showErrorMessage(`Disable Live Usage thất bại: ${e?.message ?? e}`);
      }
    }),
    vscode.commands.registerCommand('claudeAutoYes.toggleLiveUsage', async () => {
      try {
        if (liveInstaller.isEnabled()) {
          await disableLive();
          vscode.window.showInformationMessage('Claude Auto-Yes: Live Usage đã tắt.');
        } else {
          const backup = await enableLive();
          const tail = backup ? ` (backup: ${backup})` : '';
          vscode.window.showInformationMessage(
            `Claude Auto-Yes: Live Usage đã bật. Mở lại phiên Claude Code để status line nạp lại.${tail}`,
          );
        }
      } catch (e: any) {
        vscode.window.showErrorMessage(`Toggle Live Usage thất bại: ${e?.message ?? e}`);
      }
    }),
  );

  context.subscriptions.push({
    dispose: async () => {
      if (disposed) return;
      disposed = true;
      await stopLiveWatcher();
    },
  });

  log('claude-auto-yes activated');
}

export function deactivate(): void {
  // disposables handle cleanup
}
