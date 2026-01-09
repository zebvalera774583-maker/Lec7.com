#!/bin/bash
# Автоматическое создание .env файла

cat > .env << 'EOF'
DATABASE_URL=postgresql://lec7:Lec7Pass2024@postgres:5432/lec7?schema=public
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

echo "✅ .env файл создан!"
