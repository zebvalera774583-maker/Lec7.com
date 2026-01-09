#!/bin/bash
set -e

echo "🚀 Starting deployment..."

cd ~/Lec7.com

echo "📥 Pulling latest code..."
git pull

echo "🛑 Stopping containers..."
docker-compose down

echo "🧹 Cleaning up Docker..."
docker system prune -af

echo "🔨 Building application..."
docker-compose build --no-cache app

echo "🚀 Starting containers..."
docker-compose up -d

echo "📊 Running database migrations..."
docker-compose exec -T postgres npx prisma migrate deploy || echo "⚠️  Migrations skipped (database might be empty)"

echo "✅ Deployment complete!"
docker-compose ps
