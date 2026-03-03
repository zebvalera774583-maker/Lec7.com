# Задание: Storage-модуль с драйверами GCS и S3

Сделай минимальные изменения, только чтобы avatar и photo начали грузиться в S3 при `STORAGE_DRIVER=s3`.

## Шаги

1. **Найди место upload аватара/фото** — по логам есть префикс `[GCS Upload Error]`, найди этот файл/функцию.

2. **Вынеси storage в модуль с 2 драйверами:**
   - `gcs` — как сейчас
   - `s3` — Yandex Object Storage через AWS SDK v3

3. **Выбор драйвера** по `process.env.STORAGE_DRIVER`: если `s3` → грузим в S3, иначе GCS.

4. **Для S3:**
   - `endpoint` = `S3_ENDPOINT`
   - `region` = `S3_REGION`
   - `credentials` = `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`
   - `bucket` = `S3_BUCKET`
   - `key` оставить как сейчас: `business-avatars/<businessId>/<timestamp>.jpg` (и аналогично для photos)
   - ACL: `public-read` или без ACL, если бакет уже публичный на чтение
   - URL формировать как `${S3_PUBLIC_BASE_URL}/${key}`

5. **Логи ошибок S3:** `[S3 Upload Error] { message, bucket, key }`

6. **Commit + push:** да. **Деплой:** нет.
