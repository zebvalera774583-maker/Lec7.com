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
})
