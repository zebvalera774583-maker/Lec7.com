#!/bin/bash
# Локальный деплой через SSH (для использования из Cursor/терминала)
# Использование: ./scripts/deploy-local.sh

set -e

# Проверяем наличие переменных окружения
if [ -z "$TIMEWEB_HOST" ] || [ -z "$TIMEWEB_USER" ] || [ -z "$TIMEWEB_SSH_KEY" ]; then
  echo "❌ Ошибка: Необходимо установить переменные окружения:"
  echo "   export TIMEWEB_HOST=your-server-ip"
  echo "   export TIMEWEB_USER=root"
  echo "   export TIMEWEB_SSH_KEY=~/.ssh/your-key"
  echo ""
  echo "Или создайте файл .env.deploy с этими значениями"
  exit 1
fi

echo "🚀 Starting deployment to $TIMEWEB_USER@$TIMEWEB_HOST..."

# Выполняем деплой через SSH
ssh -i "$TIMEWEB_SSH_KEY" "$TIMEWEB_USER@$TIMEWEB_HOST" << 'ENDSSH'
  echo "🚀 Starting deployment..."
  
  # Переходим в директорию проекта
  cd ~/Lec7.com || {
    echo "⚠️  Project directory not found, cloning..."
    cd ~
    git clone https://github.com/zebvalera774583-maker/Lec7.com.git
    cd Lec7.com
  }
  
  # Обновляем код
  echo "📥 Pulling latest code..."
  git pull || {
    echo "⚠️  Git pull failed, trying to reset..."
    git fetch origin
    git reset --hard origin/main
  }
  
  # Убеждаемся, что скрипт деплоя исполняемый
  chmod +x scripts/deploy.sh scripts/deploy-simple.sh 2>/dev/null || true
  
  # Используем скрипт деплоя
  if [ -f scripts/deploy-simple.sh ]; then
    echo "📦 Using deploy-simple.sh script..."
    bash scripts/deploy-simple.sh
  elif [ -f scripts/deploy.sh ]; then
    echo "📦 Using deploy.sh script..."
    bash scripts/deploy.sh
  else
    echo "📦 Running deployment commands..."
    
    # Останавливаем контейнеры
    echo "🛑 Stopping containers..."
    docker-compose down || true
    
    # Собираем и запускаем
    echo "🔨 Building and starting containers..."
    docker-compose build app
    docker-compose up -d
    
    # Ждём запуска БД
    echo "⏳ Waiting for database..."
    sleep 15
    
    # Применяем миграции
    echo "📊 Running database migrations..."
    docker-compose exec -T app npx prisma migrate deploy || echo "⚠️  Migrations skipped"
  fi
  
  # Показываем статус
  echo ""
  echo "✅ Deployment complete!"
  echo ""
  echo "📊 Container status:"
  docker-compose ps
  echo ""
  echo "📋 App logs (last 20 lines):"
  docker-compose logs --tail=20 app || echo "⚠️  App not running"
ENDSSH

echo ""
echo "✅ Local deployment completed!"
