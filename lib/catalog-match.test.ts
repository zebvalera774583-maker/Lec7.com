import { describe, it, expect, vi, beforeEach } from 'vitest'
import { matchToCatalogSync } from './catalog-match'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

describe('matchToCatalogSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exact match of full phrase', () => {
    const map = new Map([
      ['айсберг салат', 'id1'],
      ['айсберг', 'id2'],
    ])
    expect(matchToCatalogSync(map, 'Айсберг салат')).toBe(true)
  })

  it('matches first word when exact not found (айсберг салат -> айсберг)', () => {
    const map = new Map([['айсберг', 'id1']])
    expect(matchToCatalogSync(map, 'Айсберг салат')).toBe(true)
  })

  it('"Айсберг салат 3 шт" does NOT match "Лист салата" via synonym "салат"', () => {
    const map = new Map([
      ['лист салата', 'id1'],
      ['салат', 'id1'],
    ])
    expect(matchToCatalogSync(map, 'Айсберг салат')).toBe(false)
  })

  it('single word matches when in catalog', () => {
    const map = new Map([['салат', 'id1']])
    expect(matchToCatalogSync(map, 'салат')).toBe(true)
  })

  it('n-gram "томат черри" matches before single "томат"', () => {
    const map = new Map([
      ['томат черри', 'id1'],
      ['томат', 'id2'],
    ])
    expect(matchToCatalogSync(map, 'томат черри красный')).toBe(true)
  })
})
