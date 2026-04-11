import type { TelegramClient } from 'telegram'
import { Api, utils } from 'telegram'
import { replaceTelegramChats, type TelegramChatDiscoveryRow } from '../telegramChatsStore.js'

function parseDiscoveryQueries(): string[] {
  const raw = process.env.TELEGRAM_DISCOVERY_QUERIES?.trim()
  if (!raw) return []
  return raw.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean)
}

function discoveryLimit(): number {
  const n = Number(process.env.TELEGRAM_DISCOVERY_LIMIT)
  if (!Number.isFinite(n) || n <= 0) return 20
  return Math.min(100, Math.floor(n))
}

function autoJoinEnabled(): boolean {
  return process.env.TELEGRAM_AUTO_JOIN?.trim().toLowerCase() === 'true'
}

function isRpcLike(err: unknown): err is { errorMessage?: string } {
  return typeof err === 'object' && err !== null && 'errorMessage' in err
}

async function tryJoinPublicChannel(
  client: TelegramClient,
  channel: Api.Channel
): Promise<'joined' | 'already_joined' | 'failed'> {
  try {
    await client.invoke(
      new Api.channels.JoinChannel({
        channel: await client.getInputEntity(channel),
      })
    )
    return 'joined'
  } catch (e) {
    const msg = isRpcLike(e) ? String(e.errorMessage ?? '') : e instanceof Error ? e.message : ''
    if (msg.includes('USER_ALREADY_PARTICIPANT') || msg.includes('USER_ALREADY')) return 'already_joined'
    return 'failed'
  }
}

function labelChatEntity(entity: Api.TypeChat | Api.Channel): { title: string; username: string } {
  const title = 'title' in entity && entity.title ? String(entity.title) : ''
  const username = 'username' in entity && entity.username ? String(entity.username) : ''
  return { title, username }
}

/**
 * Глобальный поиск по запросам, опционально вступление в публичные каналы/супергруппы.
 * Вызывается один раз после подключения клиента.
 */
export async function runTelegramDiscovery(client: TelegramClient): Promise<void> {
  const queries = parseDiscoveryQueries()
  const perQueryLimit = discoveryLimit()
  const autoJoin = autoJoinEnabled()

  console.log(`[telegram-targets] configured: ${queries.length}`)

  if (queries.length === 0) {
    replaceTelegramChats([])
    console.log('[telegram-targets] resolved: 0')
    console.log('[telegram-targets] failed: 0')
    return
  }

  const rows: TelegramChatDiscoveryRow[] = []
  let failedJoins = 0

  for (const query of queries) {
    console.log(`[telegram-discovery] query: ${query}`)
    const seen = new Set<string>()
    const batchLimit = Math.min(100, Math.max(perQueryLimit * 3, 20))

    try {
      for await (const msg of client.iterMessages(undefined, { search: query, limit: batchLimit })) {
        const peerId = msg.peerId
        if (!peerId) continue
        if (peerId instanceof Api.PeerUser) continue

        const dedupeKey = String(utils.getPeerId(peerId))
        if (seen.has(dedupeKey)) continue
        seen.add(dedupeKey)
        if (seen.size > perQueryLimit) break

        let ent: Api.TypeUser | Api.TypeChat
        try {
          ent = (await client.getEntity(peerId)) as Api.TypeUser | Api.TypeChat
        } catch {
          continue
        }

        if (ent instanceof Api.User) continue

        const { title, username } =
          ent instanceof Api.Channel || ent instanceof Api.Chat ? labelChatEntity(ent) : { title: '', username: '' }

        const chatId = String(utils.getPeerId(peerId))

        let joinStatus: TelegramChatDiscoveryRow['joinStatus']
        if (!autoJoin) {
          joinStatus = 'skipped'
        } else if (ent instanceof Api.Channel) {
          const jr = await tryJoinPublicChannel(client, ent)
          joinStatus = jr
          if (jr === 'failed') failedJoins += 1
        } else {
          joinStatus = 'skipped'
        }

        rows.push({
          title,
          username,
          chatId,
          query,
          joinStatus,
        })
      }
    } catch (e) {
      console.error('[telegram-discovery] error:', e instanceof Error ? e.message : e)
    }
  }

  replaceTelegramChats(rows)
  console.log(`[telegram-targets] resolved: ${rows.length}`)
  console.log(`[telegram-targets] failed: ${failedJoins}`)
}
