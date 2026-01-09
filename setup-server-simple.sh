#!/bin/bash
# Простой скрипт для настройки сервера
# Скопируйте и выполните на сервере

echo "🚀 Настройка сервера Lec7..."

# Обновляем систему
apt update && apt upgrade -y

# Устанавливаем Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Устанавливаем Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Проверяем
docker --version
docker-compose --version

# Клонируем проект
cd ~
git clone https://github.com/zebvalera774583-maker/Lec7.com.git
cd Lec7.com

echo "✅ Готово! Теперь создайте .env файл: nano .env"
