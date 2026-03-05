import { describe, it, expect } from 'vitest'
import { isLikelyNonItem } from './nonItemFilter'

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
