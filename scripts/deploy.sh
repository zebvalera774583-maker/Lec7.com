#!/bin/bash
set -e

echo "🚀 Starting deployment..."

cd ~/Lec7.com

echo "📥 Pulling latest code..."
git pull

echo "🛑 Stopping containers..."
docker-compose down

echo "🔨 Building application..."
docker-compose build app

echo "🚀 Starting containers..."
docker-compose up -d

echo "📊 Running database migrations..."
docker-compose exec -T postgres npx prisma migrate deploy || echo "⚠️  Migrations skipped (database might be empty)"

echo "✅ Deployment complete!"
docker-compose ps
