# Скрипт для загрузки проекта на GitHub
# Запустите в PowerShell: .\upload-to-github.ps1

Write-Host "🚀 Загрузка Lec7 на GitHub..." -ForegroundColor Green
Write-Host ""

# Проверяем, инициализирован ли Git
if (Test-Path .git) {
    Write-Host "✅ Git уже инициализирован" -ForegroundColor Green
} else {
    Write-Host "📦 Инициализируем Git..." -ForegroundColor Yellow
    git init
}

# Добавляем все файлы
Write-Host "📝 Добавляем файлы..." -ForegroundColor Yellow
git add .

# Проверяем, есть ли коммиты
$hasCommits = git log --oneline -1 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "💾 Создаём первый коммит..." -ForegroundColor Yellow
    git commit -m "Initial commit: Lec7 v1 ready for deploy"
} else {
    Write-Host "✅ Коммиты уже есть" -ForegroundColor Green
}

# Проверяем, есть ли remote
$hasRemote = git remote -v 2>$null
if ($LASTEXITCODE -ne 0 -or $hasRemote -eq "") {
    Write-Host ""
    Write-Host "⚠️  ВАЖНО: Нужно добавить удалённый репозиторий!" -ForegroundColor Red
    Write-Host ""
    Write-Host "1. Создайте репозиторий на GitHub:" -ForegroundColor Yellow
    Write-Host "   - Зайдите на https://github.com" -ForegroundColor Cyan
    Write-Host "   - Нажмите 'New repository'" -ForegroundColor Cyan
    Write-Host "   - Название: lec7 (или любое другое)" -ForegroundColor Cyan
    Write-Host "   - Выберите Private" -ForegroundColor Cyan
    Write-Host "   - НЕ добавляйте README, .gitignore, лицензию" -ForegroundColor Cyan
    Write-Host "   - Нажмите 'Create repository'" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "2. Затем выполните команду:" -ForegroundColor Yellow
    Write-Host "   git remote add origin https://github.com/YOUR_USERNAME/lec7.git" -ForegroundColor Cyan
    Write-Host "   (замените YOUR_USERNAME на ваш GitHub username)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. Загрузите код:" -ForegroundColor Yellow
    Write-Host "   git branch -M main" -ForegroundColor Cyan
    Write-Host "   git push -u origin main" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host "✅ Удалённый репозиторий настроен" -ForegroundColor Green
    Write-Host ""
    Write-Host "📤 Загружаем код на GitHub..." -ForegroundColor Yellow
    git branch -M main
    git push -u origin main
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Готово! Код загружен на GitHub!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📖 Следующий шаг: см. TIMEWEB_DEPLOY.md" -ForegroundColor Cyan
    } else {
        Write-Host ""
        Write-Host "❌ Ошибка при загрузке. Проверьте:" -ForegroundColor Red
        Write-Host "   - Правильность URL репозитория" -ForegroundColor Yellow
        Write-Host "   - Авторизацию на GitHub (используйте Personal Access Token)" -ForegroundColor Yellow
    }
}

Write-Host ""
