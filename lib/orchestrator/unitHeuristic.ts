/**
 * Эвристика единиц измерения.
 * Если unit отсутствует — НЕ ставить "шт" по умолчанию, применять эвристику.
 */

export type HeuristicConfidence = 'HIGH' | 'MEDIUM' | 'LOW'

/** Продукты, которые обычно продаются по весу (contains match, lowercase) */
const WEIGHT_DEFAULT_TITLES = new Set([
  'лук', 'чеснок', 'морковь', 'морк', 'картофель', 'картошк', 'капуст', 'свекл', 'редис',
  'помидор', 'томат', 'огурец', 'перец', 'баклажан', 'кабачок', 'тыква', 'редис',
  'яблок', 'груш', 'апельсин', 'лимон', 'банан', 'киви', 'манго', 'авокадо',
  'мясо', 'куриц', 'говядин', 'свинин', 'фарш', 'колбас', 'сыр', 'творог',
  'мука', 'сахар', 'соль', 'рис', 'гречк', 'макарон', 'крупа', 'масло',
  'молоко', 'сметан', 'кефир', 'йогурт', 'сливк',
  'зелен', 'салат', 'укроп', 'петрушк', 'базилик', 'сельдерей',
  'орех', 'изюм', 'кураг', 'чернослив', 'мед',
])

/** Продукты, которые обычно штучные (contains match, lowercase) */
const PIECE_DEFAULT_TITLES = new Set([
  'яйц', 'булочк', 'батон', 'хлеб', 'буханк', 'лимоны', 'лимон ', 'яблоки', 'груши',
  'огурцы', 'помидоры', 'пакет', 'упаковк', 'уп ', 'коробк', 'ящик', 'банк',
  'бутылк', 'бутыл ', 'банка', 'банки',
])

function isWeightProduct(title: string): boolean {
  const t = title.toLowerCase().trim()
  for (const w of WEIGHT_DEFAULT_TITLES) {
    if (t.includes(w)) return true
  }
  return false
}

function isPieceProduct(title: string): boolean {
  const t = title.toLowerCase().trim()
  for (const p of PIECE_DEFAULT_TITLES) {
    if (t.includes(p)) return true
  }
  return false
}

function hasFractionalQty(qty: string): boolean {
  const n = qty.replace(',', '.').trim()
  return /\.\d+/.test(n) || n.includes('.')
}

export interface UnitHeuristicResult {
  unit: string
  confidence: HeuristicConfidence
}

/**
 * Применить эвристику единицы измерения.
 * unit пустой/отсутствует — определяем по title и qty.
 */
export function applyUnitHeuristic(
  title: string,
  qty: string,
  unit?: string
): UnitHeuristicResult {
  const normalizedQty = (qty || '').replace(',', '.').trim()
  const qtyNum = parseFloat(normalizedQty)
  if (unit && unit.length > 0) {
    const u = unit.toLowerCase()
    if (u === 'шт' && !Number.isNaN(qtyNum) && qtyNum > 0 && qtyNum < 1) {
      return { unit: 'г', confidence: 'HIGH' }
    }
    return { unit: u, confidence: 'HIGH' }
  }

  const weightProduct = isWeightProduct(title)
  const pieceProduct = isPieceProduct(title)
  const fractional = hasFractionalQty(normalizedQty)

  // Дробное qty — сильный сигнал веса (кроме штучных исключений)
  if (fractional && !pieceProduct) {
    return { unit: 'kg', confidence: 'HIGH' }
  }

  if (weightProduct && !pieceProduct) {
    return { unit: 'kg', confidence: fractional ? 'HIGH' : 'MEDIUM' }
  }

  if (pieceProduct && !weightProduct) {
    return { unit: 'шт', confidence: 'MEDIUM' }
  }

  if (pieceProduct && weightProduct) {
    // Конфликт: в обоих списках — дробное qty склоняет к весу
    return { unit: fractional ? 'kg' : 'шт', confidence: 'MEDIUM' }
  }

  return { unit: '', confidence: 'LOW' }
}
