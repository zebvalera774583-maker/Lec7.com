import { describe, it, expect } from 'vitest'
import { isDoubtfulSegment, isGarbageSegment, isLikelyNonItem } from './nonItemFilter'

describe('isLikelyNonItem', () => {
  it('Rule A: high score → item', () => {
    const r = isLikelyNonItem('ООО Блины', 0.8, { name: 'ООО Блины', quantity: '', unit: '' })
    expect(r.isNonItem).toBe(false)
  })

  it('Rule B: company pattern → comment', () => {
    const r = isLikelyNonItem('ООО Блины юга навагинская 7 кухня', 0, {
      name: 'ООО Блины', quantity: '', unit: '',
    })
    expect(r.isNonItem).toBe(true)
    expect(r.reason).toBe('company')
  })

  it('Rule C: service words (кухня, бар) → comment', () => {
    const r = isLikelyNonItem('кафе марина кухня', 0.1, {
      name: 'кафе марина', quantity: '', unit: '',
    })
    expect(r.isNonItem).toBe(true)
    expect(r.reason).toBe('service')
  })

  it('Rule D: address pattern (навагинская 7) + low score → comment', () => {
    const r = isLikelyNonItem('навагинская 7 кухня', 0.1, {
      name: 'навагинская', quantity: '7', unit: '',
    })
    expect(r.isNonItem).toBe(true)
    expect(r.reason).toBe('address')
  })

  it('normal item with high score → item', () => {
    const r = isLikelyNonItem('Лук красный 1 кг', 0.9, {
      name: 'Лук красный', quantity: '1', unit: 'кг',
    })
    expect(r.isNonItem).toBe(false)
  })

  it('морковь- with score ≥ 0.6 → item', () => {
    const r = isLikelyNonItem('Морковь-', 0.7, {
      name: 'Морковь', quantity: '', unit: '',
    })
    expect(r.isNonItem).toBe(false)
  })

  it('лук 2 (short item) → item', () => {
    const r = isLikelyNonItem('лук 2', 0.8, {
      name: 'лук', quantity: '2', unit: '',
    })
    expect(r.isNonItem).toBe(false)
  })

  it('long line with low score → comment', () => {
    const r = isLikelyNonItem('какая-то очень длинная строка с кучей слов без смысла', 0.2, {
      name: 'какая-то', quantity: '', unit: '',
    })
    expect(r.isNonItem).toBe(true)
    expect(r.reason).toBe('long_low_score')
  })
})

describe('isGarbageSegment', () => {
  it('Мк - → garbage', () => {
    expect(isGarbageSegment('Мк -', { name: 'Мк', quantity: '', unit: '' })).toBe(true)
  })
  it('Войкова 4В → garbage', () => {
    expect(isGarbageSegment('Войкова 4В', { name: 'Войкова', quantity: '4', unit: '' })).toBe(true)
  })
  it('бар → garbage', () => {
    expect(isGarbageSegment('бар', { name: 'бар', quantity: '', unit: '' })).toBe(true)
  })
  it('кг 7 → garbage', () => {
    expect(isGarbageSegment('кг 7', { name: 'кг', quantity: '7', unit: '' })).toBe(true)
  })
  it(',2 0 → garbage', () => {
    expect(isGarbageSegment(',2 0', { name: '', quantity: '0', unit: '' })).toBe(true)
  })
  it(':10 → garbage', () => {
    expect(isGarbageSegment(':10', { name: '', quantity: '10', unit: '' })).toBe(true)
  })
  it(':1 → garbage', () => {
    expect(isGarbageSegment(':1', { name: '', quantity: '1', unit: '' })).toBe(true)
  })
  it('Апельсины - 7 кг → not garbage', () => {
    expect(isGarbageSegment('Апельсины - 7 кг', { name: 'Апельсины', quantity: '7', unit: 'кг' })).toBe(false)
  })
  it('Морковь- → not garbage (dash-terminated)', () => {
    expect(isGarbageSegment('Морковь-', { name: 'Морковь', quantity: '', unit: '' })).toBe(false)
  })
})

describe('isDoubtfulSegment', () => {
  it('Апельсины - 7 кг → not doubtful', () => {
    expect(
      isDoubtfulSegment('Апельсины - 7 кг', { name: 'Апельсины', quantity: '7', unit: 'кг' }, { canonicalName: 'Апельсины', matchType: 'alias' })
    ).toBe(false)
  })
  it('кг 7 → doubtful (unit as name)', () => {
    expect(isDoubtfulSegment('кг 7', { name: 'кг', quantity: '7', unit: '' }, { canonicalName: 'Грибы шампиньоны', matchType: 'token' })).toBe(true)
  })
  it('Апельсины + canonical Кумкват (no overlap) → doubtful', () => {
    expect(
      isDoubtfulSegment('Апельсины - 7 кг', { name: 'Апельсины', quantity: '7', unit: 'кг' }, { canonicalName: 'Кумкват', matchType: 'token' })
    ).toBe(true)
  })
  it('Шампиньоны + canonical Грибы шампиньоны (overlap) → not doubtful', () => {
    expect(
      isDoubtfulSegment('Шампиньоны 1 кг', { name: 'Шампиньоны', quantity: '1', unit: 'кг' }, { canonicalName: 'Грибы шампиньоны', matchType: 'token' })
    ).toBe(false)
  })
  it('segment too short → doubtful', () => {
    expect(isDoubtfulSegment('Мк', { name: 'Мк', quantity: '2', unit: '' }, { canonicalName: 'Мк', matchType: 'alias' })).toBe(true)
  })
  it('no quantity → doubtful', () => {
    expect(
      isDoubtfulSegment('Лук красный', { name: 'Лук красный', quantity: '', unit: '' }, { canonicalName: 'Лук красный', matchType: 'alias' })
    ).toBe(true)
  })
  it('Морковь- (dash-terminated, no qty) → not doubtful', () => {
    expect(
      isDoubtfulSegment('Морковь-', { name: 'Морковь', quantity: '', unit: '' }, { canonicalName: 'Морковь', matchType: 'alias' }, { hasDashTerminated: true })
    ).toBe(false)
  })
})
