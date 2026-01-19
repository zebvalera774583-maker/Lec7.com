# Локальный деплой через SSH (для PowerShell/Windows)
# Использование: .\scripts\deploy-local.ps1

param(
    [string]$Host = $env:TIMEWEB_HOST,
    [string]$User = $env:TIMEWEB_USER,
    [string]$SshKey = $env:TIMEWEB_SSH_KEY
)

# Проверяем наличие переменных окружения
if (-not $Host -or -not $User -or -not $SshKey) {
    Write-Host "❌ Ошибка: Необходимо установить переменные окружения:" -ForegroundColor Red
    Write-Host "   `$env:TIMEWEB_HOST = 'your-server-ip'"
    Write-Host "   `$env:TIMEWEB_USER = 'root'"
    Write-Host "   `$env:TIMEWEB_SSH_KEY = 'C:\Users\YourUser\.ssh\your-key'"
    Write-Host ""
    Write-Host "Или передайте параметры:"
    Write-Host "   .\scripts\deploy-local.ps1 -Host 'your-ip' -User 'root' -SshKey 'path\to\key'"
    exit 1
}

Write-Host "🚀 Starting deployment to ${User}@${Host}..." -ForegroundColor Cyan

# Команды для выполнения на сервере
$deployScript = @"
echo "🚀 Starting deployment..."

cd ~/Lec7.com || {
  echo "⚠️  Project directory not found, cloning..."
  cd ~
  git clone https://github.com/zebvalera774583-maker/Lec7.com.git
  cd Lec7.com
}

echo "📥 Pulling latest code..."
git pull || {
  echo "⚠️  Git pull failed, trying to reset..."
  git fetch origin
  git reset --hard origin/main
}

chmod +x scripts/deploy.sh scripts/deploy-simple.sh 2>/dev/null || true

if [ -f scripts/deploy-simple.sh ]; then
  echo "📦 Using deploy-simple.sh script..."
  bash scripts/deploy-simple.sh
elif [ -f scripts/deploy.sh ]; then
  echo "📦 Using deploy.sh script..."
  bash scripts/deploy.sh
else
  echo "📦 Running deployment commands..."
  docker-compose down || true
  docker-compose build app
  docker-compose up -d
  sleep 15
  docker-compose exec -T app npx prisma migrate deploy || echo "⚠️  Migrations skipped"
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Container status:"
docker-compose ps
echo ""
echo "📋 App logs (last 20 lines):"
docker-compose logs --tail=20 app || echo "⚠️  App not running"
"@

# Выполняем через SSH
if (Test-Path $SshKey) {
    ssh -i $SshKey "${User}@${Host}" $deployScript
} else {
    Write-Host "⚠️  SSH key not found at: $SshKey" -ForegroundColor Yellow
    Write-Host "Trying without key (will use default SSH config)..." -ForegroundColor Yellow
    ssh "${User}@${Host}" $deployScript
}

Write-Host ""
Write-Host "✅ Local deployment completed!" -ForegroundColor Green
