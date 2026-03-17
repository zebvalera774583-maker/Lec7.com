import { describe, it, expect } from 'vitest'
import { segmentNeeds } from './segmentNeeds'

describe('segmentNeeds', () => {
  it('1) Лук 2кг\\nМорковь-\\nЧеснок 0,500 -> 3 items', () => {
    const r = segmentNeeds('Лук 2кг\nМорковь-\nЧеснок 0,500')
    expect(r).toHaveLength(3)
    expect(r[0].toLowerCase()).toMatch(/лук.*2/)
    expect(r[1].toLowerCase()).toMatch(/морковь-?/)
    expect(r[2].toLowerCase()).toMatch(/чеснок.*0[,.]5/)
  })

  it('2) картофель 1 кг лук репчатый 1 кг -> 2 items', () => {
    const r = segmentNeeds('картофель 1 кг лук репчатый 1 кг')
    expect(r).toHaveLength(2)
    expect(r[0]).toMatch(/картофель.*1.*кг/)
    expect(r[1]).toMatch(/лук.*репчатый.*1.*кг/)
  })

  it('3) Лук 2кг\\n\\nЧеснок 1 кг -> 2 items', () => {
    const r = segmentNeeds('Лук 2кг\n\nЧеснок 1 кг')
    expect(r).toHaveLength(2)
    expect(r[0].toLowerCase()).toMatch(/лук.*2/)
    expect(r[1].toLowerCase()).toMatch(/чеснок.*1.*кг/)
  })

  it('4) packed line with морковь- and чеснок 0,500 -> 4 items', () => {
    const r = segmentNeeds('картофель 1 кг лук репчатый 1 кг морковь- чеснок 0,500')
    expect(r).toHaveLength(4)
    expect(r[0]).toMatch(/картофель.*1.*кг/)
    expect(r[1]).toMatch(/лук.*репчатый.*1.*кг/)
    expect(r[2]).toMatch(/морковь-?/)
    expect(r[3].toLowerCase()).toMatch(/чеснок.*0[,.]5/)
  })

  it('5) 1 кг картофель -> 1 item', () => {
    const r = segmentNeeds('1 кг картофель')
    expect(r).toHaveLength(1)
    expect(r[0]).toMatch(/картофель.*1.*кг/)
  })

  it('6) картофель 1 кг 1 кг лук -> 2 items (typo removed)', () => {
    const r = segmentNeeds('картофель 1 кг 1 кг лук')
    expect(r).toHaveLength(2)
    expect(r[0]).toMatch(/картофель.*1.*кг/)
    expect(r[1]).toMatch(/^лук\s*$|^лук$/i)
  })

  it('; as separator', () => {
    const r = segmentNeeds('лук 1 кг; морковь 1 кг; чеснок 0,5')
    expect(r).toHaveLength(3)
  })

  it(', as separator (Orchestrator 2.1)', () => {
    const r = segmentNeeds('лук 2кг, морковь 1кг\nчеснок 0,500')
    expect(r).toHaveLength(3)
    expect(r[0].toLowerCase()).toMatch(/лук.*2/)
    expect(r[1].toLowerCase()).toMatch(/морковь.*1/)
    expect(r[2].toLowerCase()).toMatch(/чеснок.*0[,.]5/)
  })

  it('"Шампиньоны, 1 кг" → один сегмент (запятая перед qty+unit не режет)', () => {
    const r = segmentNeeds('Шампиньоны, 1 кг')
    expect(r).toHaveLength(1)
    expect(r[0].toLowerCase()).toMatch(/шампиньоны.*1.*кг/)
  })

  it('"Руккола в пачках 1шт 125гр" → один сегмент (не два)', () => {
    const r = segmentNeeds('Руккола в пачках 1шт 125гр')
    expect(r).toHaveLength(1)
    expect(r[0].toLowerCase()).toMatch(/руккола.*пачках.*1.*шт/)
  })

  it('"лук 1 кг, морковь 1 кг" → два сегмента', () => {
    const r = segmentNeeds('лук 1 кг, морковь 1 кг')
    expect(r).toHaveLength(2)
    expect(r[0].toLowerCase()).toMatch(/лук.*1.*кг/)
    expect(r[1].toLowerCase()).toMatch(/морковь.*1.*кг/)
  })

  it('"лук, морковь, чеснок 1 кг" → чеснок 1 кг не ломается', () => {
    const r = segmentNeeds('лук, морковь, чеснок 1 кг')
    expect(r.some((s) => /чеснок.*1.*кг/i.test(s))).toBe(true)
  })

  it('многострочная заявка: шапка + товары — только 4 сегмента', () => {
    const input = `Мк - 2; Войкова 4В, бар

Апельсины - 7 кг
Яблоки - 4 кг
Мята - 0,2 кг
Морковь мытая - 4 кг`
    const r = segmentNeeds(input)
    expect(r).toEqual([
      'Апельсины - 7 кг',
      'Яблоки - 4 кг',
      'Мята - 0,2 кг',
      'Морковь мытая - 4 кг',
    ])
  })

  it('Кейс 1: нет мусорных сегментов кг 7, ,2 0, к 4', () => {
    const input = `Мк - 2; Войкова 4В, бар

Апельсины - 7 кг
Яблоки - 4 кг
Мята - 0,2 кг
Морковь мытая - 4 кг`
    const r = segmentNeeds(input)
    expect(r).not.toContain('кг 7')
    expect(r).not.toContain('кг 4')
    expect(r).not.toContain(',2 0')
    expect(r).not.toContain('к 4')
    expect(r).not.toContain('Апельсины -')
    expect(r).toEqual([
      'Апельсины - 7 кг',
      'Яблоки - 4 кг',
      'Мята - 0,2 кг',
      'Морковь мытая - 4 кг',
    ])
  })

  it('Кейс 2: перенос единицы — Мята - 0,2\\nкг → один сегмент', () => {
    const input = `Мята - 0,2
кг`
    const r = segmentNeeds(input)
    expect(r).toEqual(['Мята - 0,2 кг'])
  })

  it('Кейс 3: много пробелов — Апельсины 7 кг один сегмент', () => {
    const input = 'Апельсины            7 кг'
    const r = segmentNeeds(input)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatch(/апельсины.*7.*кг/i)
  })

  it('Кейс 4: packed-line картофель 1 кг лук 2 кг → 2 сегмента', () => {
    const r = segmentNeeds('картофель 1 кг лук 2 кг')
    expect(r).toHaveLength(2)
    expect(r[0]).toMatch(/картофель.*1.*кг/i)
    expect(r[1]).toMatch(/лук.*2.*кг/i)
  })

  it('post-merge: Морковь мытая - + к 4 → Морковь мытая - 4 кг', () => {
    const input = `Мк - 2; Войкова 4В, бар

Апельсины - 7 кг
Яблоки - 4 кг
Мята - 0,2 кг
Морковь мытая -
к 4`
    const r = segmentNeeds(input)
    expect(r).toContain('Морковь мытая - 4 кг')
    expect(r).not.toContain('Морковь мытая -')
    expect(r).not.toContain('к 4')
    expect(r).toEqual([
      'Апельсины - 7 кг',
      'Яблоки - 4 кг',
      'Мята - 0,2 кг',
      'Морковь мытая - 4 кг',
    ])
  })
})
