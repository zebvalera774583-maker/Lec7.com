import { TelegramClient, sessions } from 'telegram'

const { StringSession } = sessions

export interface TelegramApiCredentials {
  apiId: number
  apiHash: string
}

/**
 * Читает TELEGRAM_API_ID и TELEGRAM_API_HASH из окружения.
 * @throws Error если переменные отсутствуют или api id некорректен
 */
export function getTelegramApiCredentials(): TelegramApiCredentials {
  const rawId = process.env.TELEGRAM_API_ID
  const apiHash = process.env.TELEGRAM_API_HASH?.trim()
  if (!rawId?.trim() || !apiHash) {
    throw new Error(
      'Не заданы TELEGRAM_API_ID и/или TELEGRAM_API_HASH. Получите их на https://my.telegram.org и пропишите в .env (см. .env.example).'
    )
  }
  const apiId = Number(String(rawId).trim())
  if (!Number.isSafeInteger(apiId) || apiId <= 0) {
    throw new Error('TELEGRAM_API_ID должен быть положительным целым числом.')
  }
  return { apiId, apiHash }
}

/**
 * Клиент GramJS с сессией из TELEGRAM_SESSION (или пустой строкой).
 * Не вызывается при старте HTTP-сервера — только когда вы сами импортируете и подключаете.
 */
export function createTelegramClient(): TelegramClient {
  const { apiId, apiHash } = getTelegramApiCredentials()
  const session = new StringSession(process.env.TELEGRAM_SESSION?.trim() ?? '')
  return new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
  })
}
