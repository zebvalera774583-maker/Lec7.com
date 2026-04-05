import http from 'node:http'

export interface TestSignal {
  receivedAt: string
  source: string
  chatId: string
  chatTitle: string
  username: string
  text: string
  messageLink: string
}

const PORT = Number(process.env.PORT) || 3847

const testSignals: TestSignal[] = []

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
  </style>
</head>
<body>
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
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
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
      testSignals.push(signal)
      res.writeHead(202, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ accepted: true, total: testSignals.length }))
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
})
