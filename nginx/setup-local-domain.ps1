# PowerShell Script: Setup Local Domain Access
# Requires Administrator Privileges

Write-Host "Setting up local domain access for qsmcgogo.nowcoder.com" -ForegroundColor Green
Write-Host ""

# Check if running as administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "Error: Please run this script as Administrator" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator', then execute this script" -ForegroundColor Yellow
    Read-Host "Press any key to exit"
    exit 1
}

Write-Host "Administrator privileges detected, continuing configuration..." -ForegroundColor Green

# Backup original hosts file
$hostsPath = "C:\Windows\System32\drivers\etc\hosts"
$backupPath = "C:\Windows\System32\drivers\etc\hosts.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"

Write-Host "Backing up original hosts file to: $backupPath" -ForegroundColor Yellow
Copy-Item $hostsPath $backupPath

# Check if domain resolution already exists
$hostsContent = Get-Content $hostsPath
$domainExists = $hostsContent | Where-Object { $_ -like "*qsmcgogo.nowcoder.com*" }

if ($domainExists) {
    Write-Host "Domain resolution already exists, skipping addition" -ForegroundColor Yellow
} else {
    Write-Host "Adding domain resolution..." -ForegroundColor Yellow
    Add-Content $hostsPath "127.0.0.1 qsmcgogo.nowcoder.com"
}

Write-Host ""
Write-Host "Configuration completed!" -ForegroundColor Green
Write-Host ""
Write-Host "You can now access the application at:" -ForegroundColor Cyan
Write-Host "  http://qsmcgogo.nowcoder.com:8000" -ForegroundColor White
Write-Host "  http://localhost:8000" -ForegroundColor White
Write-Host ""
Write-Host "Note: You need to start the Node.js server first" -ForegroundColor Yellow
Write-Host "  node simple-server.js" -ForegroundColor White
Write-Host ""
Write-Host "To restore original configuration, run:" -ForegroundColor Yellow
Write-Host "  .\restore-hosts.ps1" -ForegroundColor White
Write-Host ""

# Test domain resolution
Write-Host "Testing domain resolution..." -ForegroundColor Yellow
try {
    $result = [System.Net.Dns]::GetHostAddresses("qsmcgogo.nowcoder.com")
    Write-Host "Domain resolution successful: $($result[0].IPAddressToString)" -ForegroundColor Green
} catch {
    Write-Host "Domain resolution failed, please check configuration" -ForegroundColor Red
}

Read-Host "Press any key to exit"