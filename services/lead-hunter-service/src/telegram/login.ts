import 'dotenv/config'
import { TelegramClient, sessions } from 'telegram'
import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { getTelegramApiCredentials } from './client.js'

const { StringSession } = sessions

async function main(): Promise<void> {
  let creds
  try {
    creds = getTelegramApiCredentials()
  } catch (e) {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
    return
  }

  const rl = readline.createInterface({ input, output })
  const ask = (q: string): Promise<string> => rl.question(q)

  const session = new StringSession('')
  const client = new TelegramClient(session, creds.apiId, creds.apiHash, {
    connectionRetries: 5,
  })

  try {
    await client.start({
      phoneNumber: async () =>
        (await ask('Номер телефона (международный формат, напр. +79991234567): ')).trim(),
      phoneCode: async () => (await ask('Код из Telegram / SMS: ')).trim(),
      password: async () =>
        (
          await ask(
            'Пароль двухфакторной аутентификации (если не включён — оставьте пустым и нажмите Enter): '
          )
        ).trim(),
      onError: (err) => console.error('[telegram]', err),
    })

    const sessionString = session.save()
    console.log('\n--- TELEGRAM_SESSION (скопируйте в .env) ---\n')
    console.log(sessionString)
    console.log('\n--- конец ---\n')
  } finally {
    await client.disconnect()
    rl.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
