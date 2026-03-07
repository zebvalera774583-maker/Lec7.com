import { describe, it, expect } from 'vitest'
import { normalizeTokens, buildTokenIndex, tokenMatchCatalog } from './tokenMatchCatalog'

describe('tokenMatchCatalog', () => {
  describe('normalizeTokens', () => {
    it('lowercase and split', () => {
      // "красный" > 5 chars → stemmed to "красн"
      expect([...normalizeTokens('Лук красный')].sort()).toEqual(['красн', 'лук'])
    })
    it('ё → е', () => {
      expect([...normalizeTokens('мёд')]).toContain('мед')
    })
    it('removes stop-words', () => {
      expect([...normalizeTokens('лук 2 кг')]).not.toContain('кг')
      expect([...normalizeTokens('лук кг')].sort()).toEqual(['лук'])
    })
    it('strips punctuation', () => {
      // "розовые" > 5 chars → stemmed to "розов"
      expect([...normalizeTokens('помидоры, розовые!')].sort()).toEqual(['помидоры', 'розов'])
    })
  })

  describe('tokenMatchCatalog', () => {
    const catalog = [
      { canonicalName: 'Лук красный', synonyms: ['лук репчатый'] },
      { canonicalName: 'Помидоры розовые', synonyms: ['томаты розовые'] },
      { canonicalName: 'Айсберг', synonyms: ['салат айсберг'] },
      { canonicalName: 'Морковь', synonyms: ['морк'] },
    ]
    const tokenIndex = buildTokenIndex(catalog)

    it('matches "помидоры розовые" to canonical', () => {
      const r = tokenMatchCatalog('помидоры розовые', tokenIndex)
      expect(r).not.toBeNull()
      expect(r!.canonicalName).toBe('Помидоры розовые')
      expect(r!.matchScore).toBeGreaterThanOrEqual(0.6)
    })
    it('matches "салат айсберг" to Айсберг', () => {
      const r = tokenMatchCatalog('салат айсберг', tokenIndex)
      expect(r).not.toBeNull()
      expect(r!.canonicalName).toBe('Айсберг')
    })
    it('matches "лук красный" to canonical', () => {
      const r = tokenMatchCatalog('лук красный', tokenIndex)
      expect(r).not.toBeNull()
      expect(r!.canonicalName).toBe('Лук красный')
    })
    it('returns null for "ООО Блины" (no catalog match)', () => {
      const r = tokenMatchCatalog('ООО Блины юга', tokenIndex)
      expect(r).toBeNull()
    })
    it('matches "морковь" to Морковь', () => {
      const r = tokenMatchCatalog('морковь', tokenIndex)
      expect(r).not.toBeNull()
      expect(r!.canonicalName).toBe('Морковь')
    })
    it('matches typo "броколи" to Брокколи (1-char edit)', () => {
      const catalogWithBroccoli = [
        ...catalog,
        { canonicalName: 'Брокколи', synonyms: [] },
      ]
      const idx = buildTokenIndex(catalogWithBroccoli)
      const r = tokenMatchCatalog('броколи', idx)
      expect(r).not.toBeNull()
      expect(r!.canonicalName).toBe('Брокколи')
    })
  })
})
