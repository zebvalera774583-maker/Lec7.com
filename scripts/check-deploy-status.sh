#!/bin/bash
# Проверка статуса деплоя на сервере Timeweb
# Использование: ./scripts/check-deploy-status.sh

set -e

# Проверяем наличие переменных окружения
if [ -z "$TIMEWEB_HOST" ] || [ -z "$TIMEWEB_USER" ]; then
  echo "❌ Ошибка: Необходимо установить переменные окружения:"
  echo "   export TIMEWEB_HOST=your-server-ip"
  echo "   export TIMEWEB_USER=root"
  exit 1
fi

SSH_KEY="${TIMEWEB_SSH_KEY:-~/.ssh/id_rsa}"

echo "🔍 Checking deployment status on $TIMEWEB_USER@$TIMEWEB_HOST..."
echo ""

# Проверяем статус через SSH
ssh -i "$SSH_KEY" "$TIMEWEB_USER@$TIMEWEB_HOST" << 'ENDSSH'
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
ENDSSH

echo ""
echo "✅ Status check complete!"
