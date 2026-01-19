# Проверка статуса деплоя на сервере Timeweb (PowerShell)
# Использование: .\scripts\check-deploy-status.ps1

param(
    [string]$Host = $env:TIMEWEB_HOST,
    [string]$User = $env:TIMEWEB_USER,
    [string]$SshKey = $env:TIMEWEB_SSH_KEY
)

# Проверяем наличие переменных окружения
if (-not $Host -or -not $User) {
    Write-Host "❌ Ошибка: Необходимо установить переменные окружения:" -ForegroundColor Red
    Write-Host "   `$env:TIMEWEB_HOST = 'your-server-ip'"
    Write-Host "   `$env:TIMEWEB_USER = 'root'"
    Write-Host ""
    Write-Host "Или передайте параметры:"
    Write-Host "   .\scripts\check-deploy-status.ps1 -Host 'your-ip' -User 'root' -SshKey 'path\to\key'"
    exit 1
}

if (-not $SshKey) {
    $SshKey = "$env:USERPROFILE\.ssh\id_rsa"
}

Write-Host "🔍 Checking deployment status on ${User}@${Host}..." -ForegroundColor Cyan
Write-Host ""

# Команды для проверки статуса
$checkScript = @"
echo "📊 Container Status:"
echo "==================="
cd ~/Lec7.com 2>/dev/null && docker-compose ps || echo "⚠️  Project directory not found"

echo ""
echo "📋 Recent App Logs (last 30 lines):"
echo "===================================="
cd ~/Lec7.com 2>/dev/null && docker-compose logs --tail=30 app || echo "⚠️  App logs not available"

echo ""
echo "📅 Last Git Commit:"
echo "=================="
cd ~/Lec7.com 2>/dev/null && git log -1 --oneline || echo "⚠️  Git info not available"

echo ""
echo "💾 Disk Usage:"
echo "============="
df -h / | tail -1

echo ""
echo "🐳 Docker System Info:"
echo "======================"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
"@

# Выполняем через SSH
if (Test-Path $SshKey) {
    ssh -i $SshKey "${User}@${Host}" $checkScript
} else {
    Write-Host "⚠️  SSH key not found at: $SshKey" -ForegroundColor Yellow
    Write-Host "Trying without key (will use default SSH config)..." -ForegroundColor Yellow
    ssh "${User}@${Host}" $checkScript
}

Write-Host ""
Write-Host "✅ Status check complete!" -ForegroundColor Green
