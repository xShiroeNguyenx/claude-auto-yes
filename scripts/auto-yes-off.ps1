<#
.SYNOPSIS
    Tat auto-yes cho Claude Code (xoa file co).
.EXAMPLE
    .\auto-yes-off.ps1
#>
[CmdletBinding()]
param()

$configDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME ".claude" }
$flagPath = Join-Path $configDir "auto-yes.json"

if (Test-Path $flagPath) {
    Remove-Item $flagPath -Force
    Write-Host "[OFF] Auto-yes DA TAT (da xoa file co)." -ForegroundColor Yellow
} else {
    Write-Host "[OFF] Auto-yes von da TAT (khong co file co)." -ForegroundColor DarkGray
}
Write-Host "      Claude Code se hoi xac nhan nhu binh thuong tu lan tool ke tiep."
