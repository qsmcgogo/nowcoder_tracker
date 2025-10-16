# PowerShell Script: Restore Original Hosts File Configuration
# Requires Administrator Privileges

Write-Host "Restoring original hosts file configuration" -ForegroundColor Green
Write-Host ""

# Check if running as administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "Error: Please run this script as Administrator" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator', then execute this script" -ForegroundColor Yellow
    Read-Host "Press any key to exit"
    exit 1
}

Write-Host "Administrator privileges detected, continuing restoration..." -ForegroundColor Green

# Find the latest backup file
$hostsDir = "C:\Windows\System32\drivers\etc"
$backupFiles = Get-ChildItem -Path $hostsDir -Filter "hosts.backup.*" | Sort-Object LastWriteTime -Descending

if ($backupFiles.Count -gt 0) {
    $latestBackup = $backupFiles[0]
    Write-Host "Found backup file: $($latestBackup.Name)" -ForegroundColor Yellow
    Write-Host "Restoring hosts file..." -ForegroundColor Yellow
    
    Copy-Item $latestBackup.FullName "C:\Windows\System32\drivers\etc\hosts" -Force
    Write-Host "Restoration completed!" -ForegroundColor Green
} else {
    Write-Host "No backup files found, cannot restore" -ForegroundColor Red
}

Write-Host ""
Read-Host "Press any key to exit"