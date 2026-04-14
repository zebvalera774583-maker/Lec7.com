import 'dotenv/config'
import http from 'node:http'
import { NewMessage, type NewMessageEvent } from 'telegram/events/index.js'
import { appendTestSignal, getTestSignals, type TestSignal } from './testSignalsStore.js'
import { getTelegramChats } from './telegramChatsStore.js'
import { startCrawler } from './web-hunter/crawler.js'
import { createTelegramClient } from './telegram/client.js'
import { runTelegramDiscovery } from './telegram/discovery.js'
import { logLastTelegramMessagesOnStartup } from './telegram/startupHistoryDebug.js'

export type { TestSignal }

const PORT = Number(process.env.PORT) || 3847

function isTelegramEnvReady(): boolean {
  const id = process.env.TELEGRAM_API_ID?.trim()
  const hash = process.env.TELEGRAM_API_HASH?.trim()
  const session = process.env.TELEGRAM_SESSION?.trim()
  return Boolean(id && hash && session)
}

async function startTelegramSidecar(): Promise<void> {
  if (!isTelegramEnvReady()) {
    console.log('[telegram] skipped: missing env')
    return
  }

  console.log('[telegram] connecting...')
  let client
  try {
    client = createTelegramClient()
  } catch (e) {
    console.error('[telegram] failed to create client:', e instanceof Error ? e.message : e)
    return
  }

  try {
    await client.connect()
    if (!client.connected) {
      console.error('[telegram] not connected after connect()')
      return
    }
    console.log('[DISCOVERY] start')
    await runTelegramDiscovery(client)
    console.log('[DISCOVERY] done')
    const me = await client.getMe()
    console.log('[telegram] connected')
    await logLastTelegramMessagesOnStartup(client)
    const name = [me.firstName, me.lastName].filter(Boolean).join(' ').trim()
    const username = me.username ? `@${me.username}` : '—'
    console.log(`[telegram] account: ${name || '(no name)'} · ${username}`)

    client.addEventHandler(
      async (event: NewMessageEvent) => {
        const message = event.message
        console.log('[telegram-debug] incoming')
        console.log('  chatId=', message.chatId)
        console.log('  senderId=', message.senderId)
        console.log('  text=', message.message || '(no text)')

        const text = (message.message || '').toLowerCase()
        const keywords = [
          'где заказать',
          'доставка еды',
          'посоветуйте доставку',
          'хочу заказать еду',
          'пицца доставка',
        ]
        if (!keywords.some((k) => text.includes(k))) return

        console.log('[telegram-hunter] hit')
        console.log(`  chatId=${message.chatId}`)
        console.log(`  senderId=${message.senderId}`)
        console.log(`  text=${JSON.stringify(message.message || '')}`)

        appendTestSignal({
          receivedAt: new Date().toISOString(),
          source: 'telegram',
          chatId: String(message.chatId),
          chatTitle: '',
          username: String(message.senderId ?? ''),
          text,
          messageLink: '',
        })
      },
      new NewMessage({})
    )
  } catch (e) {
    console.error('[telegram] error:', e instanceof Error ? e.message : e)
    try {
      await client.disconnect()
    } catch {
      /* ignore */
    }
  }
}

function escapeHtml(s: string | null | undefined): string {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function renderIndexHtml(): string {
  const testSignals = getTestSignals()
  const serverTime = new Date().toISOString()
  const count = testSignals.length
  const last20 = testSignals.slice(-20).reverse()
  const rows =
    last20
      .map(
        (s) => `<tr>
  <td>${escapeHtml(s.receivedAt)}</td>
  <td>${escapeHtml(s.source)}</td>
  <td>${escapeHtml(s.chatId)}</td>
  <td>${escapeHtml(s.chatTitle)}</td>
  <td>${escapeHtml(s.username)}</td>
  <td><pre style="margin:0;white-space:pre-wrap;max-width:24rem">${escapeHtml(s.text)}</pre></td>
  <td>${s.messageLink ? `<a href="${escapeHtml(s.messageLink)}" rel="noopener">${escapeHtml(s.messageLink)}</a>` : '—'}</td>
</tr>`
      )
      .join('\n') || ''

  const telegramChats = getTelegramChats()
  const telegramRows =
    telegramChats
      .map(
        (c) => `<tr>
  <td>${escapeHtml(c.title)}</td>
  <td>${escapeHtml(c.username)}</td>
  <td>${escapeHtml(c.chatId)}</td>
  <td>${escapeHtml(c.query)}</td>
  <td>${escapeHtml(c.joinStatus)}</td>
  <td>${escapeHtml(c.joinedAt)}</td>
</tr>`
      )
      .join('\n') || ''

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>lead-hunter-service — panel</title>
  <style>
    body { font-family: system-ui, Segoe UI, sans-serif; margin: 1.25rem; line-height: 1.45; color: #1a1a1a; }
    h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
    .meta { margin: 0 0 1rem; color: #444; }
    .ok { color: #0a7; font-weight: 600; }
    table { border-collapse: collapse; width: 100%; max-width: 100%; font-size:13px; }
    th, td { border: 1px solid #ccc; padding: 0.35rem 0.5rem; vertical-align: top; text-align: left; }
    th { background: #f4f4f4; }
    code { background: #f0f0f0; padding: 0.1rem 0.35rem; }
    .tech-topbar {
      display: flex; align-items: center; gap: 0.5rem; margin: 0 0 0.75rem;
      padding: 0.35rem 0; border-bottom: 1px solid #e0e0e0;
    }
    .hamburger {
      display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
      min-height: 2.75rem; padding: 0.35rem 0.75rem; border: 1px solid #888; border-radius: 8px;
      background: #fff; cursor: pointer; font: inherit; color: #111;
      box-shadow: 0 1px 2px rgba(0,0,0,.08);
    }
    .hamburger:hover { background: #f3f3f3; }
    .hamburger-icon { display: flex; flex-direction: column; justify-content: center; gap: 4px; width: 1.35rem; flex-shrink: 0; }
    .hamburger-icon .bar { display: block; height: 3px; width: 100%; background: #111; border-radius: 1px; }
    .hamburger-text { font-size: 0.95rem; font-weight: 600; letter-spacing: 0.02em; }
    .tech-drawer-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 999;
    }
    .tech-drawer-backdrop[hidden] { display: none; }
    .tech-drawer {
      position: fixed; top: 0; left: 0; height: 100%; width: min(24rem, 92vw);
      max-width: 100%; background: #fff; box-shadow: 4px 0 20px rgba(0,0,0,.12);
      z-index: 1000; transform: translateX(-100%); transition: transform .2s ease;
      overflow: auto; box-sizing: border-box;
    }
    body.drawer-open .tech-drawer { transform: translateX(0); }
    .tech-drawer-inner { padding: 1rem 1rem 2rem; }
    .tech-drawer-title { font-size: 1.1rem; margin: 0 0 0.75rem; }
    .tg-table-scroll {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      width: 100%;
      max-width: 100%;
      margin: 0 -0.25rem;
      padding: 0 0.25rem;
    }
    .tech-drawer .tg-table {
      font-size: 12px;
      width: max-content;
      min-width: 100%;
      max-width: none;
    }
    .tech-drawer .tg-table th,
    .tech-drawer .tg-table td { white-space: nowrap; }
  </style>
</head>
<body>
  <div class="tech-topbar">
    <button type="button" class="hamburger" id="tech-menu-btn" aria-expanded="false" aria-controls="tech-drawer" title="Открыть меню">
      <span class="hamburger-icon" aria-hidden="true"><span class="bar"></span><span class="bar"></span><span class="bar"></span></span>
      <span class="hamburger-text">Меню</span>
    </button>
  </div>
  <div id="tech-drawer-backdrop" class="tech-drawer-backdrop" hidden></div>
  <aside id="tech-drawer" class="tech-drawer" aria-hidden="true">
    <div class="tech-drawer-inner">
      <h2 class="tech-drawer-title">Telegram Chats</h2>
      <div class="tg-table-scroll">
      <table class="tg-table">
        <thead>
          <tr>
            <th>title</th><th>username</th><th>chatId</th><th>query</th><th>joinStatus</th><th>joinedAt</th>
          </tr>
        </thead>
        <tbody>
          ${telegramRows || '<tr><td colspan="6">Нет данных по Telegram chats</td></tr>'}
        </tbody>
      </table>
      </div>
    </div>
  </aside>

  <h1>lead-hunter-service</h1>
  <p class="meta">Статус: <span class="ok">OK</span> · Порт: <code>${PORT}</code> · Время сервера: <code>${escapeHtml(serverTime)}</code></p>
  <p class="meta">Тестовых сигналов (<code>/ingest/test</code>): <strong>${count}</strong></p>
  <p class="meta">Последние 20:</p>
  <table>
    <thead>
      <tr>
        <th>receivedAt</th><th>source</th><th>chatId</th><th>chatTitle</th><th>username</th><th>text</th><th>messageLink</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="7">Нет сигналов</td></tr>'}
    </tbody>
  </table>
  <script>
(function () {
  var btn = document.getElementById('tech-menu-btn')
  var drawer = document.getElementById('tech-drawer')
  var backdrop = document.getElementById('tech-drawer-backdrop')
  if (!btn || !drawer || !backdrop) return
  function openDrawer() {
    document.body.classList.add('drawer-open')
    drawer.setAttribute('aria-hidden', 'false')
    btn.setAttribute('aria-expanded', 'true')
    backdrop.hidden = false
  }
  function closeDrawer() {
    document.body.classList.remove('drawer-open')
    drawer.setAttribute('aria-hidden', 'true')
    btn.setAttribute('aria-expanded', 'false')
    backdrop.hidden = true
  }
  function toggle() {
    if (document.body.classList.contains('drawer-open')) closeDrawer()
    else openDrawer()
  }
  btn.addEventListener('click', function (e) { e.stopPropagation(); toggle() })
  backdrop.addEventListener('click', closeDrawer)
})()
  </script>
</body>
</html>`
}

function parseIngestBody(raw: string): Record<string, unknown> {
  if (!raw.trim()) return {}
  return JSON.parse(raw) as Record<string, unknown>
}

const server = http.createServer(async (req, res) => {
  const host = req.headers.host ?? 'localhost'
  const url = new URL(req.url ?? '/', `http://${host}`)
  const path = url.pathname

  try {
    if (req.method === 'GET' && path === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ status: 'ok', service: 'lead-hunter-service' }))
      return
    }

    if (req.method === 'GET' && path === '/') {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
      })
      res.end(renderIndexHtml())
      return
    }

    if (req.method === 'POST' && path === '/ingest/test') {
      const raw = await readBody(req)
      let body: Record<string, unknown> = {}
      try {
        body = parseIngestBody(raw)
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ error: 'Invalid JSON body' }))
        return
      }

      const signal: TestSignal = {
        receivedAt: new Date().toISOString(),
        source: String(body.source ?? ''),
        chatId: String(body.chatId ?? ''),
        chatTitle: String(body.chatTitle ?? ''),
        username: String(body.username ?? ''),
        text: String(body.text ?? ''),
        messageLink: String(body.messageLink ?? ''),
      }
      appendTestSignal(signal)
      res.writeHead(202, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ accepted: true, total: getTestSignals().length }))
      return
    }

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: 'Not found' }))
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'Internal error' }))
  }
})

server.listen(PORT, () => {
  console.log(`lead-hunter-service listening on http://localhost:${PORT}/`)
  startCrawler()
  void startTelegramSidecar()
})
