import { describe, it, expect } from 'vitest'
import { sanitizeTitle } from './sanitizeTitle'

describe('sanitizeTitle', () => {
  it('"Грибы шампиньоны," → "Грибы шампиньоны"', () => {
    expect(sanitizeTitle('Грибы шампиньоны,')).toBe('Грибы шампиньоны')
  })

  it('"Шампиньоны -" → "Шампиньоны"', () => {
    expect(sanitizeTitle('Шампиньоны -')).toBe('Шампиньоны')
  })

  it('"Товар..." → "Товар"', () => {
    expect(sanitizeTitle('Товар...')).toBe('Товар')
  })

  it('"Товар" → "Товар" (без изменений)', () => {
    expect(sanitizeTitle('Товар')).toBe('Товар')
  })

  it('"Грибы шампиньоны. " → "Грибы шампиньоны"', () => {
    expect(sanitizeTitle('Грибы шампиньоны. ')).toBe('Грибы шампиньоны')
  })

  it('пустая строка → ""', () => {
    expect(sanitizeTitle('')).toBe('')
  })
})
