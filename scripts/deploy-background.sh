#!/bin/bash
set -e

LOG_FILE="/tmp/deploy.log"
PID_FILE="/tmp/deploy.pid"

# Проверяем, не запущен ли уже деплой
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE")
  if ps -p "$OLD_PID" > /dev/null 2>&1; then
    echo "⚠️  Deployment already in progress (PID: $OLD_PID)"
    exit 1
  fi
fi

# Запускаем деплой в фоне
nohup bash -c "
  echo '🚀 Starting deployment...' > $LOG_FILE
  cd ~/Lec7.com
  echo '📥 Pulling latest code...' >> $LOG_FILE
  git pull >> $LOG_FILE 2>&1
  echo '🛑 Stopping containers...' >> $LOG_FILE
  docker-compose down >> $LOG_FILE 2>&1
  echo '🔨 Building application...' >> $LOG_FILE
  docker-compose build app >> $LOG_FILE 2>&1
  echo '🚀 Starting containers...' >> $LOG_FILE
  docker-compose up -d >> $LOG_FILE 2>&1
  echo '📊 Running migrations...' >> $LOG_FILE
  docker-compose exec -T postgres npx prisma migrate deploy >> $LOG_FILE 2>&1 || echo '⚠️  Migrations skipped' >> $LOG_FILE
  echo '✅ Deployment complete!' >> $LOG_FILE
  docker-compose ps >> $LOG_FILE 2>&1
  rm -f $PID_FILE
" > /dev/null 2>&1 &

# Сохраняем PID
echo $! > "$PID_FILE"
echo "✅ Deployment started in background (PID: $!)"
echo "📋 Check logs: tail -f $LOG_FILE"
