#!/bin/bash
# Обёртка: запуск деплоя из корня репозитория
cd "$(dirname "$0")"
exec bash ./scripts/deploy-simple.sh
