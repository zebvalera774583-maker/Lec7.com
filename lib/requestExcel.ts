import ExcelJS from 'exceljs'

export interface RequestExcelItem {
  name: string
  quantity: string
  unit: string
  price: number
  sum: number
}

export interface BuildRequestXlsxParams {
  senderName: string
  senderSlug: string
  recipientName?: string | null
  category: string | null
  total: number | null
  items: RequestExcelItem[]
  createdAt: Date
}

export async function buildRequestXlsx(params: BuildRequestXlsxParams): Promise<{ filename: string; buffer: Buffer }> {
  const { senderName, senderSlug, recipientName, category, total, items, createdAt } = params

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Заявка', { views: [{ state: 'frozen', ySplit: 5 }] })

  const dateStr = createdAt.toLocaleString('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  })

  sheet.getCell('A1').value = 'Заявка'
  sheet.getCell('A1').font = { bold: true, size: 14 }
  sheet.getCell('A2').value = `${senderName} / ${senderSlug}`
  sheet.getCell('A3').value = dateStr
  if (recipientName || category) {
    sheet.getCell('A4').value = [recipientName, category].filter(Boolean).join(' · ') || ''
  }

  const headerRow = 6
  const headers = ['№', 'Наименование', 'Ед', 'Кол-во', 'Цена', 'Сумма']
  headers.forEach((h, i) => {
    const cell = sheet.getCell(headerRow, i + 1)
    cell.value = h
    cell.font = { bold: true }
  })

  items.forEach((row, idx) => {
    const r = headerRow + 1 + idx
    sheet.getCell(r, 1).value = idx + 1
    sheet.getCell(r, 2).value = row.name
    sheet.getCell(r, 3).value = row.unit
    sheet.getCell(r, 4).value = row.quantity
    sheet.getCell(r, 5).value = row.price
    sheet.getCell(r, 5).numFmt = '#,##0.00'
    sheet.getCell(r, 6).value = row.sum
    sheet.getCell(r, 6).numFmt = '#,##0.00'
  })

  const dataEndRow = headerRow + items.length
  if (total != null && Number.isFinite(total)) {
    const totalRow = dataEndRow + 1
    sheet.getCell(totalRow, 1).value = 'ИТОГО'
    sheet.getCell(totalRow, 1).font = { bold: true }
    sheet.getCell(totalRow, 6).value = total
    sheet.getCell(totalRow, 6).numFmt = '#,##0.00'
    sheet.getCell(totalRow, 6).font = { bold: true }
  }

  const lastCol = 6
  const lastRow = dataEndRow + (total != null && Number.isFinite(total) ? 1 : 0)
  for (let c = 1; c <= lastCol; c++) {
    let maxLen = 10
    for (let r = 1; r <= lastRow; r++) {
      const v = sheet.getCell(r, c).value
      const len = v != null ? String(v).length : 0
      if (len > maxLen) maxLen = Math.min(len, 50)
    }
    sheet.getColumn(c).width = maxLen + 1
  }

  sheet.views = [{ state: 'frozen', ySplit: headerRow, activeCell: 'A7' }]

  const buf = await workbook.xlsx.writeBuffer()
  const buffer = Buffer.isBuffer(buf) ? buf : Buffer.from(buf as ArrayBuffer)
  const safeSlug = (senderSlug || 'request').replace(/[^\w\u0400-\u04FF-]/g, '_').slice(0, 30)
  const filename = `zayavka_${safeSlug}_${createdAt.getTime()}.xlsx`

  return { filename, buffer }
}
