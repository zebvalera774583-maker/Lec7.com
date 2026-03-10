/**
 * Логика уточнения позиций до создания заявки (MAX бот).
 * Использует Master Catalog (requiresClarification) и getItemsNeedingQuestion.
 */

import { buildCatalogMaps, getClarificationMap, getItemsNeedingQuestion } from '@/lib/summary-pipeline'
import type { CatalogMaps } from '@/lib/summary-pipeline'

export type ClarificationItem = { title: string; qty: string; unit: string }

/** Парсинг question: убрать ?, разделить по запятой, trim. Варианты для кнопок. */
export function parseClarificationOptions(question: string): string[] {
  const s = (question || '').replace(/\?/g, '').trim()
  if (!s) return []
  return s.split(',').map((x) => x.trim()).filter(Boolean)
}

/** Результат: индексы и map индекс → question */
export function findIndicesNeedingClarification(
  items: ClarificationItem[],
  catalogMaps: CatalogMaps,
  clarificationMap: Map<string, string>
): { indices: number[]; questionByIndex: Map<number, string> } {
  const requestItems = items.map((it) => ({ name: (it.title || '').trim() })).filter((it) => it.name.length > 0)
  const needing = getItemsNeedingQuestion(requestItems, catalogMaps, clarificationMap)
  const nameToQuestion = new Map(needing.map((n) => [n.itemName, n.question]))
  const indices: number[] = []
  const questionByIndex = new Map<number, string>()
  for (let i = 0; i < items.length; i++) {
    const name = (items[i].title || '').trim()
    const q = name ? nameToQuestion.get(name) : null
    if (q) {
      indices.push(i)
      questionByIndex.set(i, q)
    }
  }
  return { indices, questionByIndex }
}

/** Загрузить catalogMaps и clarificationMap одним батчем (без N+1). */
export async function loadClarificationMaps(): Promise<{
  catalogMaps: CatalogMaps
  clarificationMap: Map<string, string>
}> {
  const [catalogMaps, clarificationMap] = await Promise.all([buildCatalogMaps(), getClarificationMap()])
  return { catalogMaps, clarificationMap }
}
