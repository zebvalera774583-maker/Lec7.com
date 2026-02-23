import { describe, it, expect } from 'vitest'
import { parseLineItemsFromText } from './parser'

describe('parseLineItemsFromText', () => {
  it('multiline: Яблоки 10, Огурцы 10к, Картофель 7кг', () => {
    const result = parseLineItemsFromText('Яблоки 10\nОгурцы 10к\nКартофель 7кг')
    expect(result).toEqual([
      { title: 'Яблоки', qty: '10', unit: undefined },
      { title: 'Огурцы', qty: '10', unit: 'kg' },
      { title: 'Картофель', qty: '7', unit: 'kg' },
    ])
  })

  it('comma-separated: яблоки 10к, груши 5', () => {
    const result = parseLineItemsFromText('яблоки 10к, груши 5')
    expect(result).toEqual([
      { title: 'яблоки', qty: '10', unit: 'kg' },
      { title: 'груши', qty: '5', unit: undefined },
    ])
  })

  it('semicolon-separated: молоко 2л; вода 500мл', () => {
    const result = parseLineItemsFromText('молоко 2л; вода 500мл')
    expect(result).toEqual([
      { title: 'молоко', qty: '2', unit: 'l' },
      { title: 'вода', qty: '500', unit: 'ml' },
    ])
  })

  it('пакеты 10 шт', () => {
    const result = parseLineItemsFromText('пакеты 10 шт')
    expect(result).toEqual([{ title: 'пакеты', qty: '10', unit: 'pcs' }])
  })

  it('кабель 10 к (unit к = kg)', () => {
    const result = parseLineItemsFromText('кабель 10 к')
    expect(result).toEqual([{ title: 'кабель', qty: '10', unit: 'kg' }])
  })

  it('empty input', () => {
    expect(parseLineItemsFromText('')).toEqual([])
    expect(parseLineItemsFromText('   ')).toEqual([])
  })

  it('no garbage: invalid lines produce no items', () => {
    const result = parseLineItemsFromText('просто текст без числа\nещё одна строка')
    expect(result).toEqual([])
  })

  it('\\r\\n normalized to \\n', () => {
    const result = parseLineItemsFromText('яблоки 10\r\nгруши 5')
    expect(result).toEqual([
      { title: 'яблоки', qty: '10', unit: undefined },
      { title: 'груши', qty: '5', unit: undefined },
    ])
  })
})
