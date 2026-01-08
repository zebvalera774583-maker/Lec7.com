# Инструкции по деплою Lec7

## Вариант 1: Vercel (Самый простой) ⚡

### Преимущества:
- Автоматический деплой из Git
- Бесплатный план для старта
- Встроенный CI/CD
- Автоматические SSL сертификаты

### Шаги:

1. **Подготовка репозитория**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. **Деплой на Vercel**
   - Зайдите на [vercel.com](https://vercel.com)
   - Импортируйте ваш репозиторий
   - Настройте переменные окружения:
     ```
     DATABASE_URL=postgresql://...
     NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
     JWT_SECRET=your-secret
     OPENAI_API_KEY=sk-...
     S3_ENDPOINT=...
     S3_ACCESS_KEY_ID=...
     S3_SECRET_ACCESS_KEY=...
     S3_BUCKET_NAME=...
     S3_REGION=...
     S3_PUBLIC_URL=...
     ```
   - Нажмите Deploy

3. **Настройка базы данных**
   - Используйте Vercel Postgres или внешний PostgreSQL
   - После деплоя выполните миграции:
     ```bash
     npx prisma migrate deploy
     ```

### ⚠️ Важно для Vercel:
- PostgreSQL должен быть доступен из интернета
- S3 должен быть публично доступен или использовать presigned URLs

---

## Вариант 2: VPS с Docker (Timeweb/любой VPS) 🐳

### Преимущества:
- Полный контроль
- Можно использовать Timeweb VPS
- Дешевле на больших нагрузках

### Шаги:

1. **Подготовка сервера**
   ```bash
   # Установите Docker и Docker Compose
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh
   
   # Установите Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

2. **Клонирование проекта**
   ```bash
   git clone <your-repo-url>
   cd Lec7.com
   ```

3. **Настройка переменных окружения**
   ```bash
   # Создайте .env файл
   nano .env
   ```
   
   Добавьте:
   ```env
   DATABASE_URL=postgresql://lec7:your_password@postgres:5432/lec7?schema=public
   NEXT_PUBLIC_APP_URL=https://your-domain.com
   JWT_SECRET=your-super-secret-jwt-key
   OPENAI_API_KEY=sk-your-openai-api-key
   S3_ENDPOINT=https://s3.timeweb.com
   S3_ACCESS_KEY_ID=your-access-key-id
   S3_SECRET_ACCESS_KEY=your-secret-access-key
   S3_BUCKET_NAME=lec7-storage
   S3_REGION=ru-1
   S3_PUBLIC_URL=https://your-bucket.s3.timeweb.com
   ```

4. **Запуск**
   ```bash
   # Соберите и запустите контейнеры
   docker-compose up -d --build
   
   # Примените миграции
   docker-compose exec app npx prisma migrate deploy
   ```

5. **Настройка Nginx (опционально, для домена)**
   
   Создайте `/etc/nginx/sites-available/lec7`:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
   
   ```bash
   sudo ln -s /etc/nginx/sites-available/lec7 /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

6. **SSL сертификат (Let's Encrypt)**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

---

## Вариант 3: Timeweb Cloud (Рекомендуется для России) 🇷🇺

### Преимущества:
- Российский хостинг
- Хорошая поддержка
- Интеграция с Timeweb S3

### Шаги:

1. **Создайте VPS в Timeweb**
   - Минимум 2GB RAM, 2 CPU
   - Ubuntu 22.04 или новее

2. **Подключитесь по SSH и выполните шаги из Варианта 2**

3. **Настройте Timeweb S3**
   - Создайте бакет в панели Timeweb
   - Используйте эндпоинт: `https://s3.timeweb.com`
   - Настройте публичный доступ для портфолио

---

## Проверка после деплоя ✅

1. **Проверьте главную страницу**
   ```
   https://your-domain.com
   ```

2. **Проверьте API**
   ```bash
   curl https://your-domain.com/api/auth/login
   ```

3. **Проверьте базу данных**
   ```bash
   docker-compose exec app npx prisma studio
   # или
   npx prisma studio
   ```

4. **Проверьте логи**
   ```bash
   docker-compose logs -f app
   ```

---

## Обновление проекта 🔄

### Vercel:
- Автоматически при push в main ветку

### VPS/Docker:
```bash
git pull
docker-compose up -d --build
docker-compose exec app npx prisma migrate deploy
```

---

## Мониторинг и логи 📊

### Docker:
```bash
# Логи приложения
docker-compose logs -f app

# Логи базы данных
docker-compose logs -f postgres

# Статус контейнеров
docker-compose ps
```

### Vercel:
- Логи доступны в панели Vercel
- Метрики в реальном времени

---

## Резервное копирование 💾

### База данных:
```bash
# Создать бэкап
docker-compose exec postgres pg_dump -U lec7 lec7 > backup_$(date +%Y%m%d).sql

# Восстановить
docker-compose exec -T postgres psql -U lec7 lec7 < backup_20240101.sql
```

### Автоматический бэкап (cron):
```bash
# Добавьте в crontab
0 2 * * * docker-compose exec postgres pg_dump -U lec7 lec7 > /backups/lec7_$(date +\%Y\%m\%d).sql
```

---

## Безопасность 🔒

1. **Измените пароли по умолчанию**
   - JWT_SECRET - используйте длинный случайный ключ
   - DATABASE_URL - сильный пароль для БД

2. **Настройте firewall**
   ```bash
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

3. **Регулярно обновляйте зависимости**
   ```bash
   npm audit fix
   docker-compose build --no-cache
   ```

---

## Troubleshooting 🔧

### Проблема: Приложение не запускается
```bash
# Проверьте логи
docker-compose logs app

# Проверьте переменные окружения
docker-compose exec app env | grep DATABASE_URL
```

### Проблема: База данных недоступна
```bash
# Проверьте статус PostgreSQL
docker-compose ps postgres

# Проверьте подключение
docker-compose exec app npx prisma db push
```

### Проблема: S3 загрузка не работает
- Проверьте переменные S3_* в .env
- Убедитесь, что бакет существует
- Проверьте права доступа к бакету

---

## Рекомендации по выбору 🎯

- **Для быстрого старта**: Vercel
- **Для российского рынка**: Timeweb VPS
- **Для масштабирования**: VPS с Docker + отдельный PostgreSQL
- **Для production**: VPS + Nginx + SSL + мониторинг
