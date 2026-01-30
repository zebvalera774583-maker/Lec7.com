#!/bin/bash
set -e

echo "🚀 Starting deployment..."

cd ~/Lec7.com

echo "📥 Pulling latest code..."
# Пробуем HTTPS, если не работает - используем SSH
if ! git pull 2>&1 | grep -q "Could not resolve host"; then
  echo "✅ Git pull successful"
else
  echo "⚠️  HTTPS failed, trying SSH..."
  git remote set-url origin git@github.com:zebvalera774583-maker/Lec7.com.git || true
  git pull || echo "⚠️  Git pull failed, continuing with existing code"
fi

echo "🛑 Stopping containers..."
docker-compose down || true

echo "🔨 Building application..."
docker-compose build app

echo "🚀 Starting containers..."
docker-compose up -d

echo "📊 Running database migrations..."
docker-compose exec -T app npx prisma migrate deploy || echo "⚠️  Migrations skipped"

echo "✅ Deployment complete!"
docker-compose ps
