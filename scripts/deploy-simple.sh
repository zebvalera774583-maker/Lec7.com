#!/bin/bash
set -e

echo "🚀 Starting deployment..."

cd ~/Lec7.com

echo "📥 Pulling latest code..."
# Проверяем, использует ли git HTTPS, если да - переключаем на SSH
git remote get-url origin | grep -q '^https' && git remote set-url origin git@github.com:zebvalera774583-maker/Lec7.com.git || true
git pull

echo "🛑 Stopping containers..."
docker-compose down || true

echo "🔨 Building application..."
docker-compose build app

echo "🚀 Starting containers..."
docker-compose up -d

echo "📊 Running database migrations..."
docker-compose exec -T postgres npx prisma migrate deploy || echo "⚠️  Migrations skipped"

echo "✅ Deployment complete!"
docker-compose ps
