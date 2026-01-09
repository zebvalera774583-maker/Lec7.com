# Настройка Docker прокси для Timeweb

Timeweb предоставил прокси-сервер: `https://dockerhub.timeweb.cloud/`

## Команды для выполнения на сервере:

### 1. Настройка Docker daemon для использования прокси

```bash
mkdir -p /etc/docker
cat > /etc/docker/daemon.json << 'EOF'
{
  "registry-mirrors": ["https://dockerhub.timeweb.cloud"]
}
EOF
```

### 2. Перезапуск Docker

```bash
systemctl restart docker
```

### 3. Проверка настройки

```bash
docker info | grep -A 5 "Registry Mirrors"
```

Должно показать: `https://dockerhub.timeweb.cloud`

### 4. Теперь запускаем проект

```bash
cd ~/Lec7.com
docker-compose pull
docker-compose up -d --build
```

---

## Или одной командой:

```bash
mkdir -p /etc/docker && cat > /etc/docker/daemon.json << 'EOF'
{
  "registry-mirrors": ["https://dockerhub.timeweb.cloud"]
}
EOF
systemctl restart docker && sleep 5 && cd ~/Lec7.com && docker-compose pull && docker-compose up -d --build && sleep 20 && docker-compose exec -T app npx prisma db push && echo "✅ ГОТОВО! http://194.87.104.179:3000"
```
