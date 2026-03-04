import { describe, it, expect } from 'vitest'
import { parseMaxRequestToRows, preprocessForParse } from './parseMaxRequest'

describe('preprocessForParse', () => {
  it('огурец-2кг → огурец 2 кг', () => {
    expect(preprocessForParse('огурец-2кг')).toBe('огурец 2 кг')
  })

  it('огурец–2кг (en dash) → огурец 2 кг', () => {
    expect(preprocessForParse('огурец–2кг')).toBe('огурец 2 кг')
  })

  it('огурец—2кг (em dash) → огурец 2 кг', () => {
    expect(preprocessForParse('огурец—2кг')).toBe('огурец 2 кг')
  })

  it('огурец-2 кг → огурец 2 кг', () => {
    expect(preprocessForParse('огурец-2 кг')).toBe('огурец 2 кг')
  })

  it('огурец 2кг → огурец 2 кг', () => {
    expect(preprocessForParse('огурец 2кг')).toBe('огурец 2 кг')
  })

  it('помидоры 5шт, молоко 1л', () => {
    expect(preprocessForParse('помидоры 5шт, молоко 1л')).toBe('помидоры 5 шт, молоко 1 л')
  })
})

describe('parseMaxRequestToRows', () => {
  it('огурец-2кг → одна позиция', () => {
    const result = parseMaxRequestToRows('', 'огурец-2кг')
    expect(result).toEqual([{ name: 'огурец', quantity: '2', unit: 'кг' }])
  })

  it('огурец–2кг (en dash)', () => {
    const result = parseMaxRequestToRows('', 'огурец–2кг')
    expect(result).toEqual([{ name: 'огурец', quantity: '2', unit: 'кг' }])
  })

  it('огурец 2кг', () => {
    const result = parseMaxRequestToRows('', 'огурец 2кг')
    expect(result).toEqual([{ name: 'огурец', quantity: '2', unit: 'кг' }])
  })

  it('Картофель-5кг Лук 2кг', () => {
    const result = parseMaxRequestToRows('', 'Картофель-5кг Лук 2кг')
    expect(result).toEqual([
      { name: 'Картофель', quantity: '5', unit: 'кг' },
      { name: 'Лук', quantity: '2', unit: 'кг' },
    ])
  })
})
