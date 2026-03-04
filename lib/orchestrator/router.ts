/**
 * AI Orchestrator Router — MVP skeleton
 * См. docs/ai-orchestrator-spec.md
 *
 * Router = intent detection + action chain.
 * LLM определяет intent (пока заглушка), код выполняет цепочку действий.
 */

export interface ClassificationResult {
  intent: string
  entities: Record<string, unknown>
}

/** Заглушка для LLM классификации. Позже — вызов LLM. */
export function classifyIntentStub(_message: string): ClassificationResult {
  return {
    intent: 'unknown',
    entities: {},
  }
}

/** Таблица intent -> цепочка actions. Позже: ingestTextNeeds, resolveCatalogItems, ... */
export const INTENT_CHAINS: Record<string, string[]> = {
  unknown: [],
  // create_needs: ['ingestTextNeeds', 'resolveCatalogItems', 'createNeedsDraft'],
  // compare_prices: ['compareSupplierPrices'],
  // send_requests: ['generateAndSendRequests'],
}

/** Ответ для unknown intent */
export const UNKNOWN_RESPONSE =
  'Я пока умею: создать потребность из текста / сравнить цены / отправить заявки. Напиши «на завтра: …».'
