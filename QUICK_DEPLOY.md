# 🚀 Быстрый деплой Lec7

## Самый простой способ: Vercel (5 минут)

### 1. Подготовка
```bash
# Закоммитьте код
git add .
git commit -m "Ready for deploy"
git push
```

### 2. Деплой на Vercel
1. Зайдите на [vercel.com](https://vercel.com) и войдите через GitHub
2. Нажмите "Add New Project"
3. Выберите ваш репозиторий
4. Добавьте переменные окружения (см. ниже)
5. Нажмите "Deploy"

### 3. Переменные окружения для Vercel
```
DATABASE_URL=postgresql://user:pass@host:5432/dbname
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
JWT_SECRET=длинный-случайный-ключ-минимум-32-символа
OPENAI_API_KEY=sk-...
S3_ENDPOINT=https://s3.timeweb.com
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=lec7-storage
S3_REGION=ru-1
S3_PUBLIC_URL=https://your-bucket.s3.timeweb.com
```

### 4. После деплоя
```bash
# Примените миграции (через Vercel CLI или вручную)
npx vercel env pull .env.local
npx prisma migrate deploy
```

---

## Деплой на VPS (Timeweb/любой)

### 1. Подключитесь к серверу
```bash
ssh user@your-server-ip
```

### 2. Установите Docker (если нет)
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 3. Клонируйте проект
```bash
git clone <your-repo-url>
cd Lec7.com
```

### 4. Создайте .env файл
```bash
nano .env
```
Скопируйте переменные из примера выше, заменив значения.

### 5. Запустите
```bash
# Запуск
./scripts/deploy.sh

# Или вручную:
docker-compose up -d --build
docker-compose exec app npx prisma migrate deploy
```

### 6. Настройте домен (опционально)
```bash
# Установите Nginx
sudo apt install nginx

# Создайте конфиг
sudo nano /etc/nginx/sites-available/lec7
```

Добавьте:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/lec7 /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# SSL сертификат
sudo certbot --nginx -d your-domain.com
```

---

## ✅ Проверка работы

1. Откройте в браузере: `https://your-domain.com`
2. Проверьте API: `https://your-domain.com/api/auth/login` (должна быть ошибка, но не 500)
3. Проверьте логи: `docker-compose logs -f app`

---

## 🔄 Обновление

### Vercel:
Автоматически при push в main

### VPS:
```bash
git pull
./scripts/deploy.sh
```

---

## 📞 Нужна помощь?

- Полная инструкция: см. `DEPLOY.md`
- Настройка проекта: см. `SETUP.md`
- Проблемы: проверьте логи `docker-compose logs app`
