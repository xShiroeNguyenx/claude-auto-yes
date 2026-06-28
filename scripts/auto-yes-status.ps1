<#
.SYNOPSIS
    Xem trang thai auto-yes + thoi gian con lai + log gan day.
.EXAMPLE
    .\auto-yes-status.ps1
    .\auto-yes-status.ps1 -Tail 50
#>
[CmdletBinding()]
param(
    [int]$Tail = 20
)

$configDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME ".claude" }
$flagPath = Join-Path $configDir "auto-yes.json"
$logPath = Join-Path $configDir "auto-yes.log"

Write-Host "=== Auto-yes status ===" -ForegroundColor Cyan

if (-not (Test-Path $flagPath)) {
    Write-Host "Trang thai: TAT (khong co file co)" -ForegroundColor DarkGray
} else {
    $flag = $null
    try {
        $flag = Get-Content $flagPath -Raw | ConvertFrom-Json
    } catch {
        Write-Host "Trang thai: KHONG DOC DUOC file co (JSON hong) -> hook se defer (hoi tay)." -ForegroundColor Red
    }

    if ($flag) {
        if (-not $flag.enabled) {
            Write-Host "Trang thai: TAT (enabled=false)" -ForegroundColor DarkGray
        } elseif ($flag.expiresAt) {
            $exp = [datetime]::Parse($flag.expiresAt).ToUniversalTime()
            $now = (Get-Date).ToUniversalTime()
            if ($now -gt $exp) {
                Write-Host "Trang thai: HET HAN luc $($flag.expiresAt) -> hook se defer (hoi tay)." -ForegroundColor Yellow
            } else {
                $remain = $exp - $now
                $localExp = [datetime]::Parse($flag.expiresAt).ToLocalTime().ToString("yyyy-MM-dd HH:mm:ss")
                Write-Host "Trang thai: BAT [ON]" -ForegroundColor Green
                Write-Host "Het han:    $localExp (gio may)"
                Write-Host ("Con lai:    {0}d {1}h {2}m" -f $remain.Days, $remain.Hours, $remain.Minutes)
            }
        } else {
            Write-Host "Trang thai: BAT [ON] (khong dat han)" -ForegroundColor Green
        }
        if ($flag -and $flag.note) { Write-Host "Ghi chu:    $($flag.note)" }
    }
}

Write-Host ""
Write-Host "--- $Tail dong log gan nhat ($logPath) ---" -ForegroundColor Cyan
if (Test-Path $logPath) {
    Get-Content $logPath -Tail $Tail
} else {
    Write-Host "(chua co log)" -ForegroundColor DarkGray
}
