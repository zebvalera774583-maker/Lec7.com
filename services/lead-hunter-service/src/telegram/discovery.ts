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

const JOIN_ALLOW_KEYWORDS = ['чат', 'обсуждение', 'форум', 'help', 'помощь']
const JOIN_BLOCK_KEYWORDS = ['новости', 'news', 'tv', 'канал']

function shouldAllowJoinByTitle(title: string): boolean {
  const normalized = title.trim().toLowerCase()
  if (!normalized) return false
  const hasAllowWord = JOIN_ALLOW_KEYWORDS.some((word) => normalized.includes(word))
  const hasBlockWord = JOIN_BLOCK_KEYWORDS.some((word) => normalized.includes(word))
  return hasAllowWord && !hasBlockWord
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

function labelChannel(ch: Api.Channel): { title: string; username: string } {
  const title = ch.title ? String(ch.title) : ''
  const username = ch.username ? String(ch.username) : ''
  return { title, username }
}

/** Публичный канал или супергруппа / гигагруппа (все в TL как Channel). */
function isChannelOrSupergroup(ch: Api.Channel): boolean {
  return Boolean(ch.broadcast || ch.megagroup || ch.gigagroup)
}

/**
 * Глобальный поиск через messages.SearchGlobal, опционально вступление в каналы/супергруппы.
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

    try {
      const result = await client.invoke(
        new Api.messages.SearchGlobal({
          q: query,
          filter: new Api.InputMessagesFilterEmpty(),
          minDate: 0,
          maxDate: 0,
          offsetRate: 0,
          offsetPeer: new Api.InputPeerEmpty(),
          offsetId: 0,
          limit: perQueryLimit,
        })
      )

      if (result instanceof Api.messages.MessagesNotModified) {
        continue
      }

      console.log('[telegram-discovery] global search used')

      if (!('chats' in result) || !result.chats?.length) {
        continue
      }

      const seen = new Set<string>()

      for (const ent of result.chats) {
        if (!(ent instanceof Api.Channel)) continue
        if (!isChannelOrSupergroup(ent)) continue

        const dedupeKey = String(utils.getPeerId(ent))
        if (seen.has(dedupeKey)) continue
        if (seen.size >= perQueryLimit) break
        seen.add(dedupeKey)

        const { title, username } = labelChannel(ent)
        const chatId = String(utils.getPeerId(ent))

        let joinStatus: TelegramChatDiscoveryRow['joinStatus']
        let joinedAt = ''
        if (!autoJoin) {
          joinStatus = 'skipped'
        } else {
          const allowJoin = shouldAllowJoinByTitle(title)
          const printableTitle = title || username || chatId
          if (!allowJoin) {
            console.log(`[JOIN FILTER] skipped: ${printableTitle}`)
            joinStatus = 'skipped'
          } else {
            console.log(`[JOIN FILTER] allowed: ${printableTitle}`)
            const jr = await tryJoinPublicChannel(client, ent)
            joinStatus = jr
            if (jr === 'joined') {
              joinedAt = new Date().toISOString()
            }
            if (jr === 'failed') failedJoins += 1
          }
        }

        rows.push({
          title,
          username,
          chatId,
          query,
          joinStatus,
          joinedAt,
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
