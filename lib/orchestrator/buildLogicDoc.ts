/**
 * Генерация документации логики бота для админки.
 * Данные берутся из кода — при изменении логики страница обновляется автоматически.
 */

import { ORCHESTRATOR_CONFIG } from './config'

export interface BotLogicDoc {
  version: string
  updatedAt: string
  pipeline: { step: number; name: string; description: string }[]
  config: Record<string, number | string>
  decisionRules: { order: number; when: string; then: string; reason: string }[]
  tests: { label: string; command: string }[]
}

export function buildBotLogicDoc(): BotLogicDoc {
  return {
    version: '2.1',
    updatedAt: new Date().toISOString().slice(0, 10),

    pipeline: [
      { step: 1, name: 'segmentNeeds', description: 'Разбиение по \\n, ;, запятая. Запятая перед qty+unit НЕ режет ("Шампиньоны, 1 кг" → один сегмент). Лимиты: 2000 символов, 50 сегментов.' },
      { step: 2, name: 'parseSegment + sanitizeTitle', description: 'Извлечение title, quantity, unit, hasDashTerminated. sanitizeTitle(name) — удаление хвостовой пунктуации (,.;:-–—). 500г → 0.5 кг.' },
      { step: 3, name: 'preNormalizer', description: 'lowercase, ё→е, удаление скобок и кавычек.' },
      { step: 4, name: 'resolveCatalogItems', description: '1) alias (catalog) 2) alias (learned) 3) token fuzzy match. После канонизации: sanitizeTitle(canonicalName) перед items и clarification.' },
      { step: 5, name: 'extractFeatures', description: 'hasQty, hasUnit, wordCount, hasLegalForm, hasAddressWord, matchScore...' },
      { step: 6, name: 'decisionEngine', description: 'Таблица правил: company → address → high → medium → clarification → comment.' },
      { step: 7, name: 'confidenceLadder', description: '≥0.85 HIGH, 0.6–0.85 MEDIUM, 0.3–0.6 LOW, <0.3 NONE.' },
      { step: 8, name: 'learningLoop', description: 'token match + score≥0.8 → сохранить alias в BotLearnedAlias.' },
    ],

    config: {
      tokenMatchThreshold: ORCHESTRATOR_CONFIG.tokenMatchThreshold,
      highConfidenceThreshold: ORCHESTRATOR_CONFIG.highConfidenceThreshold,
      mediumConfidenceThreshold: ORCHESTRATOR_CONFIG.mediumConfidenceThreshold,
      learningThreshold: ORCHESTRATOR_CONFIG.learningThreshold,
      maxAliasPerCanonical: ORCHESTRATOR_CONFIG.maxAliasPerCanonical,
      maxMessageLength: ORCHESTRATOR_CONFIG.maxMessageLength,
      maxSegments: ORCHESTRATOR_CONFIG.maxSegments,
      learnedAliasTtlDays: ORCHESTRATOR_CONFIG.learnedAliasTtlDays,
    },

    decisionRules: [
      { order: 1, when: 'hasLegalForm=true', then: 'COMMENT', reason: 'COMMENT_LEGAL_FORM' },
      { order: 2, when: 'hasAddressWord=true', then: 'COMMENT', reason: 'COMMENT_ADDRESS' },
      { order: 3, when: 'matchScore ≥ 0.85', then: 'ITEM_AUTO', reason: 'HIGH_MATCH' },
      { order: 4, when: 'matchScore ≥ 0.6', then: 'проверка clarification', reason: 'MEDIUM_MATCH' },
      { order: 5, when: '!hasQty', then: 'ASK_QTY', reason: 'MISSING_QTY' },
      { order: 6, when: 'hasDashTerminated', then: 'ASK_QTY', reason: 'DASH_TERMINATED' },
      { order: 7, when: '!hasUnit, wordCount≤3', then: 'ITEM_ASK_UNIT', reason: 'SAFEGUARD' },
      { order: 8, when: '!hasUnit', then: 'ASK_UNIT', reason: 'MISSING_UNIT' },
      { order: 9, when: 'wordCount>6, matchScore<0.6', then: 'COMMENT', reason: 'LONG_LOW_SCORE' },
    ],

    tests: [
      { label: 'sanitizeTitle', command: 'npm test -- lib/orchestrator/sanitizeTitle' },
      { label: 'Orchestrator (segmentNeeds, tokenMatch, nonItemFilter, resolveCatalogItems)', command: 'npm test -- lib/orchestrator' },
      { label: 'Bot handleBotEvent', command: 'npm test -- lib/bot-core/handleBotEvent' },
      { label: 'Все тесты', command: 'npm test' },
    ],
  }
}
