#!/bin/bash
# Команды для выполнения на сервере Timeweb
# Скопируйте и выполните на сервере после подключения по SSH

echo "🚀 Начинаем настройку сервера Lec7..."

# 1. Обновляем систему
echo "📦 Обновляем систему..."
apt update && apt upgrade -y

# 2. Устанавливаем Docker
echo "🐳 Устанавливаем Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# 3. Устанавливаем Docker Compose
echo "📦 Устанавливаем Docker Compose..."
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# 4. Проверяем установку
echo "✅ Проверяем установку..."
docker --version
docker-compose --version

# 5. Клонируем проект
echo "📥 Клонируем проект с GitHub..."
cd ~
git clone https://github.com/zebvalera774583-maker/Lec7.com.git
cd Lec7.com

echo ""
echo "✅ Базовая настройка завершена!"
echo ""
echo "📝 Следующие шаги:"
echo "1. Создайте .env файл: nano .env"
echo "2. Запустите проект: docker-compose up -d --build"
echo "3. Примените миграции: docker-compose exec app npx prisma migrate deploy"
