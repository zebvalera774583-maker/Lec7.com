import { extractSignals } from './parser.js'
import { appendTestSignal, type TestSignal } from '../testSignalsStore.js'

/** Не чаще одного полного цикла раз в 30 с (см. setInterval). */
export const CRAWL_INTERVAL_MS = 30_000

const URLS = [
  'https://pikabu.ru/search.php?q=доставка%20еды',
  'https://pikabu.ru/tag/%D0%94%D0%BE%D1%81%D1%82%D0%B0%D0%B2%D0%BA%D0%B0/hot',
  'https://www.avito.ru/rossiya?q=доставка+еды',
  'https://habr.com/ru/search/?q=доставка+еды&target_type=posts',
  'https://4pda.to/forum/index.php?act=search&source=all&query=доставка+еды',
  'https://old.reddit.com/r/russia/search?q=доставка+еды&restrict_sr=1',
  'https://ru.wikipedia.org/wiki/%D0%AF%D0%BD%D0%B4%D0%B5%D0%BA%D1%81.%D0%95%D0%B4%D0%B0',
  'https://vc.ru/search?query=доставка%20еды',
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
    if (res.status !== 200) {
      console.warn(`[web-hunter] HTTP ${res.status} ${url}`)
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
  for (const url of URLS) {
    console.log(`[web-hunter] fetch ${url}`)
    const html = await fetchPublicPage(url)

    const found = html ? extractSignals(html) : []
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
    console.log(`[web-hunter] signals: ${found.length} for ${url}`)
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
