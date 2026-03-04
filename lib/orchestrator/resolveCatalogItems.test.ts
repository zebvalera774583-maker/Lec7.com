import { describe, it, expect } from 'vitest'
import { normalizeItemName } from './resolveCatalogItems'

describe('normalizeItemName', () => {
  it(', помидоры → помидоры', () => {
    expect(normalizeItemName(', помидоры')).toBe('помидоры')
  })

  it(' огурцы  → огурцы', () => {
    expect(normalizeItemName(' огурцы ')).toBe('огурцы')
  })

  it('помидоры, → помидоры', () => {
    expect(normalizeItemName('помидоры,')).toBe('помидоры')
  })

  it('соус-барбекю — дефис внутри сохраняется', () => {
    expect(normalizeItemName('соус-барбекю')).toBe('соус-барбекю')
  })

  it('сахар/песок — слэш внутри сохраняется', () => {
    expect(normalizeItemName('сахар/песок')).toBe('сахар/песок')
  })

  it('схлопнуть повторные пробелы', () => {
    expect(normalizeItemName('  огурцы   помидоры  ')).toBe('огурцы помидоры')
  })

  it('убрать ведущую и хвостовую пунктуацию', () => {
    expect(normalizeItemName('; "помидоры"!')).toBe('помидоры')
  })
})
