<#
.SYNOPSIS
    Bat auto-yes cho Claude Code trong N gio.
.EXAMPLE
    .\auto-yes-on.ps1                 # bat 24 gio
    .\auto-yes-on.ps1 -Hours 72       # bat 3 ngay
    .\auto-yes-on.ps1 -Hours 8 -Note "deploy webike"
#>
[CmdletBinding()]
param(
    [double]$Hours = 24,
    [string]$Note = ""
)

$configDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME ".claude" }
$flagPath = Join-Path $configDir "auto-yes.json"
$flagDir = Split-Path $flagPath -Parent
if (-not (Test-Path $flagDir)) { New-Item -ItemType Directory -Force -Path $flagDir | Out-Null }

$expires = (Get-Date).ToUniversalTime().AddHours($Hours)
$expiresIso = $expires.ToString("yyyy-MM-ddTHH:mm:ssZ")

$obj = [ordered]@{
    enabled   = $true
    expiresAt = $expiresIso
    note      = $Note
}
$json = $obj | ConvertTo-Json

# Ghi UTF-8 KHONG BOM de Node JSON.parse doc duoc chac chan.
[System.IO.File]::WriteAllText($flagPath, $json, (New-Object System.Text.UTF8Encoding($false)))

$localExp = $expires.ToLocalTime().ToString("yyyy-MM-dd HH:mm:ss")
Write-Host "[ON] Auto-yes DA BAT." -ForegroundColor Green
Write-Host "     Het han luc: $localExp (gio may) / $expiresIso (UTC)"
if ($Note) { Write-Host "     Ghi chu: $Note" }
Write-Host "     File co: $flagPath"
Write-Host "     Co hieu luc ngay o lan Claude chay tool ke tiep (khong can restart)."
