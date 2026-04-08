import { extractSignals } from './parser.js'
import { appendTestSignal, type TestSignal } from '../testSignalsStore.js'

/** Не чаще одного полного цикла раз в 30 с (см. setInterval). */
export const CRAWL_INTERVAL_MS = 30_000

/** Временно: публичные страницы поисковых выдач по ключевым темам. */
const SEED_URLS: string[] = [
  'https://www.google.com/search?q=%D0%B3%D0%B4%D0%B5+%D0%B7%D0%B0%D0%BA%D0%B0%D0%B7%D0%B0%D1%82%D1%8C+%D0%B5%D0%B4%D1%83',
  'https://www.bing.com/search?q=%D0%B4%D0%BE%D1%81%D1%82%D0%B0%D0%B2%D0%BA%D0%B0+%D0%BF%D0%B8%D1%86%D1%86%D1%8B',
  'https://yandex.ru/search/?text=%D0%B3%D0%B4%D0%B5+%D0%B7%D0%B0%D0%BA%D0%B0%D0%B7%D0%B0%D1%82%D1%8C+%D0%B5%D0%B4%D1%83',
]

const DEFAULT_UA =
  'Mozilla/5.0 (compatible; lead-hunter-service/0.1; +https://lek7.com) (public pages only)'

async function fetchPublicPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'User-Agent': DEFAULT_UA,
      },
      redirect: 'follow',
    })
    if (!res.ok) {
      console.warn(`[web-hunter] HTTP ${res.status} for ${url.slice(0, 80)}`)
      return null
    }
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.includes('text/html') && !ct.includes('application/xhtml')) {
      console.warn(`[web-hunter] skip non-html: ${ct}`)
      return null
    }
    return await res.text()
  } catch (e) {
    console.warn('[web-hunter] fetch error:', e instanceof Error ? e.message : e)
    return null
  }
}

async function crawlOnce(): Promise<void> {
  for (const url of SEED_URLS) {
    const html = await fetchPublicPage(url)
    if (!html) continue

    const found = extractSignals(html)
    for (const item of found) {
      const signal: TestSignal = {
        receivedAt: new Date().toISOString(),
        source: 'web',
        chatId: '',
        chatTitle: url,
        username: '',
        text: item.text,
        messageLink: url,
      }
      appendTestSignal(signal)
    }
    if (found.length > 0) {
      console.log(`[web-hunter] ${found.length} signal(s) from ${url.slice(0, 60)}…`)
    }
  }
}

/**
 * Периодический обход публичных URL. Не использует браузер, только fetch.
 * Первый проход через 3 с после старта, далее каждые {@link CRAWL_INTERVAL_MS} мс.
 */
export function startCrawler(): void {
  const run = (): void => {
    void crawlOnce().catch((e) => console.error('[web-hunter] crawlOnce', e))
  }
  setTimeout(run, 3000)
  setInterval(run, CRAWL_INTERVAL_MS)
}
