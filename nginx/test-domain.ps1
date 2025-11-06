# PowerShell Script: Test Domain Configuration

Write-Host "Testing domain configuration for qsmcgogo.nowcoder.com" -ForegroundColor Green
Write-Host ""

# Test DNS resolution
Write-Host "1. Testing DNS resolution..." -ForegroundColor Yellow
try {
    $result = [System.Net.Dns]::GetHostAddresses("qsmcgogo.nowcoder.com")
    Write-Host "   DNS resolution successful: $($result[0].IPAddressToString)" -ForegroundColor Green
} catch {
    Write-Host "   DNS resolution failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Please run setup-local-domain.ps1 first to configure local domain" -ForegroundColor Yellow
}

Write-Host ""

# Test HTTP connections
Write-Host "2. Testing HTTP connections..." -ForegroundColor Yellow
$urls = @(
    "http://localhost:8000",
    "http://qsmcgogo.nowcoder.com:8000"
)

foreach ($url in $urls) {
    try {
        $response = Invoke-WebRequest -Uri $url -TimeoutSec 5 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "   $url - Connection successful (Status: $($response.StatusCode))" -ForegroundColor Green
        } else {
            Write-Host "   $url - Connection failed (Status: $($response.StatusCode))" -ForegroundColor Red
        }
    } catch {
        Write-Host "   $url - Connection failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""

# Test health check endpoint
Write-Host "3. Testing health check endpoint..." -ForegroundColor Yellow
$healthUrls = @(
    "http://localhost:8000/health",
    "http://qsmcgogo.nowcoder.com:8000/health"
)

foreach ($url in $healthUrls) {
    try {
        $response = Invoke-WebRequest -Uri $url -TimeoutSec 5 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "   $url - Health check passed" -ForegroundColor Green
            Write-Host "   Response content: $($response.Content)" -ForegroundColor Gray
        } else {
            Write-Host "   $url - Health check failed (Status: $($response.StatusCode))" -ForegroundColor Red
        }
    } catch {
        Write-Host "   $url - Health check failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""

# Test static file access
Write-Host "4. Testing static file access..." -ForegroundColor Yellow
$staticUrls = @(
    "http://localhost:8000/styles.css",
    "http://qsmcgogo.nowcoder.com:8000/styles.css"
)

foreach ($url in $staticUrls) {
    try {
        $response = Invoke-WebRequest -Uri $url -TimeoutSec 5 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "   $url - Static file access successful" -ForegroundColor Green
        } else {
            Write-Host "   $url - Static file access failed (Status: $($response.StatusCode))" -ForegroundColor Red
        }
    } catch {
        Write-Host "   $url - Static file access failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Testing completed!" -ForegroundColor Green
Write-Host ""
Write-Host "If all tests pass, domain configuration is successful!" -ForegroundColor Cyan
Write-Host "You can now access the application at:" -ForegroundColor Cyan
Write-Host "  http://qsmcgogo.nowcoder.com:8000" -ForegroundColor White
Write-Host "  http://localhost:8000" -ForegroundColor White