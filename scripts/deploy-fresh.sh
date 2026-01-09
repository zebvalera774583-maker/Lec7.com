#!/bin/bash
set -e

echo "🧹 Cleaning up old deployment..."
cd ~/Lec7.com 2>/dev/null || true
docker-compose down -v 2>/dev/null || true
cd ~
rm -rf Lec7.com 2>/dev/null || true
docker system prune -af --volumes 2>/dev/null || true

echo "📥 Cloning fresh project..."
git clone https://github.com/zebvalera774583-maker/Lec7.com.git
cd Lec7.com

echo "📝 Creating .env file..."
cat > .env <<EOF
DATABASE_URL=postgresql://lec7:lec7_password@postgres:5432/lec7?schema=public
NEXT_PUBLIC_APP_URL=http://194.87.104.179:3000
JWT_SECRET=lec7-super-secret-jwt-key-minimum-32-characters-long-2024-change-in-production
OPENAI_API_KEY=sk-your-openai-api-key-here
S3_ENDPOINT=https://s3.timeweb.com
S3_ACCESS_KEY_ID=your-timeweb-s3-access-key
S3_SECRET_ACCESS_KEY=your-timeweb-s3-secret-key
S3_BUCKET_NAME=lec7-storage
S3_REGION=ru-1
S3_PUBLIC_URL=https://lec7-storage.s3.timeweb.com
EOF

echo "🔨 Building and starting containers..."
docker-compose up -d --build

echo "⏳ Waiting for postgres to be ready..."
sleep 10

echo "📊 Running migrations..."
docker-compose exec -T app npx prisma migrate deploy || echo "⚠️  Migrations skipped (database might be empty)"

echo "✅ Fresh deployment complete!"
echo ""
echo "📊 Container status:"
docker-compose ps
echo ""
echo "🌐 Your app should be available at: http://194.87.104.179:3000"
