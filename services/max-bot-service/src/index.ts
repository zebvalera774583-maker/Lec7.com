import 'dotenv/config'
import express from 'express'
import axios from 'axios'
import { Bot } from '@maxhub/max-bot-api'

const PORT = 3005
const MAX_BOT_TOKEN = process.env.MAX_BOT_TOKEN
const LEC7_BASE_URL = (process.env.LEC7_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const LEC7_MAX_SECRET = process.env.LEC7_MAX_SECRET || ''

if (!MAX_BOT_TOKEN) {
  console.error('MAX_BOT_TOKEN is required')
  process.exit(1)
}

const app = express()
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.listen(PORT, () => {
  console.log(`max-bot-service listening on port ${PORT}`)
})

const bot = new Bot(MAX_BOT_TOKEN)

bot.on('message_created', async (ctx: any) => {
  const text = ctx.message?.body?.text
  if (!text || typeof text !== 'string') return

  const chatId = ctx.chatId ?? ctx.chat?.chat_id ?? ctx.message?.recipient?.chat_id
  const userId = ctx.user?.user_id ?? ctx.message?.sender?.user_id
  const messageId = ctx.messageId ?? ctx.message?.body?.mid
  const ts = ctx.message?.created_at ?? new Date().toISOString()

  console.log('[MAX incoming]', { chatId, userId, text: text.slice(0, 50) })

  try {
    const { data } = await axios.post<{ replyText: string }>(
      `${LEC7_BASE_URL}/api/integrations/max/incoming`,
      { chatId, userId, text, messageId, ts },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-LEC7-MAX-SECRET': LEC7_MAX_SECRET,
        },
        timeout: 15000,
      }
    )

    const replyText = data?.replyText ?? 'Спасибо, заявка принята'
    await ctx.reply(replyText)
    console.log('[MAX outgoing]', { chatId, replyText: replyText.slice(0, 50) })
  } catch (err: any) {
    const msg = err?.response?.data?.error ?? err?.message ?? 'Ошибка'
    console.error('[MAX error]', msg)
    await ctx.reply('Произошла ошибка. Попробуйте позже.')
  }
})

bot.catch((err) => {
  console.error('[MAX bot error]', err)
  process.exit(1)
})

bot.start()
