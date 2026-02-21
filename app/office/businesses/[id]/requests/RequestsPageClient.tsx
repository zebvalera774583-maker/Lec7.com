'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'

const STORAGE_KEY_PREFIX = 'lec7_request_created_'

interface RequestsPageClientProps {
  businessId: string
}

interface Row {
  [key: string]: string
}

interface SummaryItem {
  name: string
  quantity: string
  unit: string
  offers: Record<string, number>
  analogues?: Record<string, { name: string; price: number }[]>
}

interface Counterparty {
  id: string
  legalName: string
}

interface IncomingRequestItem {
  id: string
  name: string
  quantity: string
  unit: string
  price: number
  sum: number
}

interface IncomingRequestRow {
  id: string
  senderBusinessId: string
  senderLegalName: string
  category: string | null
  total: number | null
  status: string
  createdAt: string
  items: IncomingRequestItem[]
}

const REQUEST_COLUMNS = [
  { id: 'name', title: 'Наименование', kind: 'text' as const },
  { id: 'quantity', title: 'Количество', kind: 'number' as const },
  { id: 'unit', title: 'Ед. изм.', kind: 'text' as const },
]

const DEFAULT_CATEGORY = 'Свежая плодоовощная продукция'
const OWN_PRICE_ID = '__OWN_PRICE__'
const isPartnerCounterparty = (c: Counterparty) => c.id !== OWN_PRICE_ID

const REQUEST_CARD_STYLE: { maxWidth: string; padding: string; border: string; borderRadius: string; boxShadow: string; cursor: string; textAlign: 'left' } = {
  maxWidth: '22em',
  padding: '1rem 1.25rem',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  cursor: 'pointer',
  textAlign: 'left',
}

function formatPrice(value: number): string {
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function formatRequestDate(d: Date): string {
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function RequestsPageClient({ businessId }: RequestsPageClientProps) {
  const [showCreateBlock, setShowCreateBlock] = useState(true)
  const [viewMode, setViewMode] = useState<'form' | 'summary' | 'created' | 'requestDetail'>('form')
  const [selectedCounterpartyId, setSelectedCounterpartyId] = useState<string | null>(null)
  const [createdRequest, setCreatedRequest] = useState<{
    category: string
    createdAt: Date
    counterpartyCards: { id: string; legalName: string }[]
  } | null>(null)
  const [rows, setRows] = useState<Row[]>([{}])
  const [summaryData, setSummaryData] = useState<{ items: SummaryItem[]; counterparties: Counterparty[] } | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [appliedAnalogue, setAppliedAnalogue] = useState<Record<string, Record<string, { name: string; price: number }>>>({})
  const [useForRequest, setUseForRequest] = useState<Record<string, boolean>>({})
  const [menuOpenCardId, setMenuOpenCardId] = useState<'summary' | string | null>(null)
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequestRow[]>([])
  const [incomingLoading, setIncomingLoading] = useState(false)
  const [selectedIncomingId, setSelectedIncomingId] = useState<string | null>(null)
  const [sendStatus, setSendStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const [sendingCounterpartyId, setSendingCounterpartyId] = useState<string | null>(null)
  const [sendingAll, setSendingAll] = useState(false)
  const [viewSection, setViewSection] = useState<'create' | 'incoming'>('incoming')
  const lastRowRef = useRef<HTMLInputElement>(null)
  const allCheckboxRef = useRef<HTMLInputElement>(null)
  const menuContainerRef = useRef<HTMLDivElement>(null)

  const storageKey = `${STORAGE_KEY_PREFIX}${businessId}`

  const saveCreatedToStorage = (cr: typeof createdRequest, sd: typeof summaryData, aa: typeof appliedAnalogue) => {
    if (typeof window === 'undefined' || !cr || !sd) return
    try {
      const payload = {
        createdRequest: { ...cr, createdAt: cr.createdAt.toISOString() },
        summaryData: sd,
        appliedAnalogue: aa,
      }
      window.localStorage.setItem(storageKey, JSON.stringify(payload))
    } catch (_) {}
  }

  const clearCreatedFromStorage = () => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.removeItem(storageKey)
    } catch (_) {}
  }

  const downloadSummaryAsExcel = () => {
    if (!summaryData || !createdRequest) return
    setMenuOpenCardId(null)
    const partners = summaryData.counterparties.filter(isPartnerCounterparty)
    const sumByCounterparty: Record<string, number> = {}
    summaryData.counterparties.forEach((c) => { sumByCounterparty[c.id] = 0 })
    summaryData.items.forEach((item, idx) => {
      const itemKey = String(idx)
      const qty = Math.max(0, parseFloat(String(item.quantity).replace(',', '.')) || 0)
      let rowMin: number | null = null
      partners.forEach((c) => {
        const exact = item.offers[c.id]
        const applied = appliedAnalogue[itemKey]?.[c.id]?.price
        const p = exact ?? applied ?? null
        if (p != null && (rowMin == null || p < rowMin)) rowMin = p
      })
      partners.forEach((c) => {
        const exact = item.offers[c.id]
        const applied = appliedAnalogue[itemKey]?.[c.id]?.price
        const p = exact ?? applied ?? null
        if (p != null && rowMin != null && Math.abs(p - rowMin) < 1e-6) sumByCounterparty[c.id] += p * qty
      })
      if (item.offers[OWN_PRICE_ID] != null) {
        const qtyNum = Math.max(0, parseFloat(String(item.quantity).replace(',', '.')) || 0)
        sumByCounterparty[OWN_PRICE_ID] += item.offers[OWN_PRICE_ID] * qtyNum
      }
    })
    const rowTotals = summaryData.items.map((item, idx) => {
      const itemKey = String(idx)
      const qty = Math.max(0, parseFloat(String(item.quantity).replace(',', '.')) || 0)
      let rowMin: number | null = null
      partners.forEach((c) => {
        const exact = item.offers[c.id]
        const applied = appliedAnalogue[itemKey]?.[c.id]?.price
        const p = exact ?? applied ?? null
        if (p != null && (rowMin == null || p < rowMin)) rowMin = p
      })
      return rowMin != null ? rowMin * qty : 0
    })
    const totalMinSum = rowTotals.reduce((a, b) => a + b, 0)
    const headerRow = ['№', 'Наименование', 'Кол-во', 'Ед.', ...summaryData.counterparties.map((c) => c.legalName), 'Итоговая сумма']
    const dataRows = summaryData.items.map((item, idx) => {
      const itemKey = String(idx)
      const effectivePrices = summaryData.counterparties.map((c) => {
        const exact = item.offers[c.id]
        const applied = appliedAnalogue[itemKey]?.[c.id]?.price
        return exact ?? applied ?? null
      })
      const minPrice = effectivePrices.find((p) => p != null) != null ? Math.min(...(effectivePrices.filter((p): p is number => p != null))) : null
      const rowTotalSum = minPrice != null ? minPrice * Math.max(0, parseFloat(String(item.quantity).replace(',', '.')) || 0) : 0
      return [
        idx + 1,
        item.name,
        item.quantity || '',
        item.unit || '',
        ...summaryData.counterparties.map((c) => {
          const exact = item.offers[c.id]
          const applied = appliedAnalogue[itemKey]?.[c.id]?.price
          const p = exact ?? applied ?? null
          return p != null ? p : ''
        }),
        rowTotalSum > 0 ? rowTotalSum : '',
      ]
    })
    const footerRow = ['Итого', '', '', '', ...summaryData.counterparties.map((c) => sumByCounterparty[c.id] > 0 ? sumByCounterparty[c.id] : ''), totalMinSum > 0 ? totalMinSum : '']
    const aoa = [headerRow, ...dataRows, footerRow]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [{ wch: 6 }, { wch: 28 }, { wch: 10 }, { wch: 8 }, ...summaryData.counterparties.map(() => ({ wch: 14 })), { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Сводная')
    const safeName = `Сводная_${formatRequestDate(createdRequest.createdAt).replace(/\./g, '-')}`.replace(/[^\w\s\u0400-\u04FF-]/g, '').trim() || 'Сводная'
    XLSX.writeFile(wb, `${safeName}.xlsx`)
  }

  const downloadCounterpartyAsExcel = (counterpartyId: string) => {
    if (!summaryData || !createdRequest) return
    setMenuOpenCardId(null)
    const c = summaryData.counterparties.find((x) => x.id === counterpartyId)
    if (!c) return
    const partners = summaryData.counterparties.filter(isPartnerCounterparty)
    const rowsForCounterparty = summaryData.items
      .map((item, idx) => {
        const itemKey = String(idx)
        let rowMin: number | null = null
        partners.forEach((cc) => {
          const exact = item.offers[cc.id]
          const applied = appliedAnalogue[itemKey]?.[cc.id]?.price
          const p = exact ?? applied ?? null
          if (p != null && (rowMin == null || p < rowMin)) rowMin = p
        })
        const exact = item.offers[c.id]
        const applied = appliedAnalogue[itemKey]?.[c.id]?.price
        const price = exact ?? applied ?? null
        const isMin = price != null && rowMin != null && Number.isFinite(price) && Math.abs(price - rowMin) < 1e-6
        if (!isMin) return null
        const qty = Math.max(0, parseFloat(String(item.quantity).replace(',', '.')) || 0)
        return { item, price, qty, sum: price * qty }
      })
      .filter((r): r is NonNullable<typeof r> => r != null)
    const total = rowsForCounterparty.reduce((a, r) => a + r.sum, 0)
    const headerRow = ['№', 'Наименование', 'Кол-во', 'Ед.', 'Цена', 'Сумма']
    const dataRows = rowsForCounterparty.map((r, i) => [i + 1, r.item.name, r.item.quantity || '', r.item.unit || '', r.price, r.sum])
    const footerRow = ['Итого', '', '', '', '', total]
    const aoa = [headerRow, ...dataRows, footerRow]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [{ wch: 6 }, { wch: 28 }, { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Заявка')
    const safeName = `Заявка_${(c.legalName || '').replace(/[^\w\s\u0400-\u04FF-]/g, '').trim() || 'контрагент'}_${formatRequestDate(createdRequest.createdAt).replace(/\./g, '-')}`.trim() || 'Заявка'
    XLSX.writeFile(wb, `${safeName}.xlsx`)
  }

  const handleDeleteCreated = () => {
    setMenuOpenCardId(null)
    clearCreatedFromStorage()
    setCreatedRequest(null)
    setSummaryData(null)
    setViewMode('form')
    setShowCreateBlock(false)
  }

  const handleDeleteCounterpartyCard = (counterpartyId: string) => {
    if (!createdRequest) return
    setMenuOpenCardId(null)
    const next = createdRequest.counterpartyCards.filter((x) => x.id !== counterpartyId)
    const newCreated = { ...createdRequest, counterpartyCards: next }
    setCreatedRequest(newCreated)
    if (summaryData) saveCreatedToStorage(newCreated, summaryData, appliedAnalogue)
  }

  const getRowsForCounterparty = (counterpartyId: string): { item: SummaryItem; price: number; qty: number; sum: number }[] => {
    if (!summaryData) return []
    const c = summaryData.counterparties.find((x) => x.id === counterpartyId)
    if (!c) return []
    const partners = summaryData.counterparties.filter(isPartnerCounterparty)
    return summaryData.items
      .map((item, idx) => {
        const itemKey = String(idx)
        let rowMin: number | null = null
        partners.forEach((cc) => {
          const exact = item.offers[cc.id]
          const applied = appliedAnalogue[itemKey]?.[cc.id]?.price
          const p = exact ?? applied ?? null
          if (p != null && (rowMin == null || p < rowMin)) rowMin = p
        })
        const exact = item.offers[c.id]
        const applied = appliedAnalogue[itemKey]?.[c.id]?.price
        const price = exact ?? applied ?? null
        const isMin = price != null && rowMin != null && Number.isFinite(price) && Math.abs(price - rowMin) < 1e-6
        if (!isMin) return null
        const qty = Math.max(0, parseFloat(String(item.quantity).replace(',', '.')) || 0)
        return { item, price, qty, sum: price * qty }
      })
      .filter((r): r is NonNullable<typeof r> => r != null)
  }

  const handleSendRequest = async (counterpartyId: string) => {
    if (!summaryData || !createdRequest) return
    setMenuOpenCardId(null)
    setSendStatus(null)
    const rows = getRowsForCounterparty(counterpartyId)
    if (rows.length === 0) {
      setSendStatus({ ok: false, message: 'Нет позиций для отправки' })
      return
    }
    const total = rows.reduce((a, r) => a + r.sum, 0)
    const items = rows.map((r) => ({
      name: r.item.name,
      quantity: r.item.quantity || '',
      unit: r.item.unit || '',
      price: r.price,
      sum: r.sum,
    }))
    setSendingCounterpartyId(counterpartyId)
    try {
      const res = await fetch(`/api/office/businesses/${businessId}/requests/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          recipientBusinessId: counterpartyId,
          category: createdRequest.category,
          total,
          items,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Ошибка отправки')
      }
      const c = summaryData.counterparties.find((x) => x.id === counterpartyId)
      setSendStatus({ ok: true, message: `Заявка отправлена ${c?.legalName || 'контрагенту'}` })
    } catch (e: any) {
      setSendStatus({ ok: false, message: e.message || 'Ошибка отправки' })
    } finally {
      setSendingCounterpartyId(null)
    }
  }

  const handleSendAllRequests = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!summaryData || !createdRequest || sendingCounterpartyId != null || sendingAll) return
    setMenuOpenCardId(null)
    setSendStatus(null)
    setSendingAll(true)
    let sent = 0
    let errMsg: string | null = null
    try {
      for (const c of createdRequest.counterpartyCards) {
        const rows = getRowsForCounterparty(c.id)
        if (rows.length === 0) continue
        const total = rows.reduce((a, r) => a + r.sum, 0)
        const items = rows.map((r) => ({
          name: r.item.name,
          quantity: r.item.quantity || '',
          unit: r.item.unit || '',
          price: r.price,
          sum: r.sum,
        }))
        try {
          const res = await fetch(`/api/office/businesses/${businessId}/requests/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              recipientBusinessId: c.id,
              category: createdRequest.category,
              total,
              items,
            }),
          })
          if (res.ok) sent++
          else {
            const data = await res.json().catch(() => ({}))
            errMsg = data.error || 'Ошибка отправки'
          }
        } catch (_) {
          errMsg = 'Ошибка отправки'
        }
      }
      if (errMsg && sent === 0) setSendStatus({ ok: false, message: errMsg })
      else if (sent > 0) setSendStatus({ ok: true, message: `Отправлено заявок: ${sent}${errMsg ? `. Ошибки: ${errMsg}` : ''}` })
    } finally {
      setSendingAll(false)
    }
  }

  const fetchIncomingRequests = async () => {
    setIncomingLoading(true)
    try {
      const res = await fetch(`/api/office/businesses/${businessId}/requests/incoming`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setIncomingRequests(data.requests || [])
      }
    } catch (_) {}
    finally {
      setIncomingLoading(false)
    }
  }

  const handleAddRow = () => {
    setRows([...rows, {}])
  }

  const handleDeleteRow = (index: number) => {
    setRows(rows.filter((_, i) => i !== index))
  }

  const handleCellChange = (rowIndex: number, columnId: string, value: string) => {
    const newRows = [...rows]
    if (!newRows[rowIndex]) newRows[rowIndex] = {}
    newRows[rowIndex][columnId] = value
    setRows(newRows)
  }

  const handleFormSubmit = async () => {
    const items = rows
      .map((r) => ({ name: (r.name || '').trim(), quantity: (r.quantity || '').trim(), unit: (r.unit || '').trim() }))
      .filter((r) => r.name.length > 0)
    if (items.length === 0) {
      setSummaryError('Укажите хотя бы одну позицию с наименованием')
      return
    }
    setSummaryError(null)
    setSummaryLoading(true)
    try {
      const res = await fetch(`/api/office/businesses/${businessId}/request-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ items }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Ошибка загрузки')
      }
      const data = await res.json()
      const counterparties = data.counterparties || []
      setSummaryData({ items: data.items, counterparties })
      setAppliedAnalogue({})
      setUseForRequest(Object.fromEntries(counterparties.filter((c: Counterparty) => isPartnerCounterparty(c)).map((c: Counterparty) => [c.id, true])))
      setViewMode('summary')
    } catch (e: any) {
      setSummaryError(e.message || 'Ошибка')
    } finally {
      setSummaryLoading(false)
    }
  }

  const handleCreateRequest = () => {
    if (!summaryData) return
    const partners = summaryData.counterparties.filter(isPartnerCounterparty)
    const selected = partners.filter((c) => useForRequest[c.id])
    const withAtLeastOneOrder = selected.filter((c) => {
      return summaryData.items.some((item, idx) => {
        const itemKey = String(idx)
        let rowMin: number | null = null
        partners.forEach((cc) => {
          const exact = item.offers[cc.id]
          const applied = appliedAnalogue[itemKey]?.[cc.id]?.price
          const p = exact ?? applied ?? null
          if (p != null && (rowMin == null || p < rowMin)) rowMin = p
        })
        const exact = item.offers[c.id]
        const applied = appliedAnalogue[itemKey]?.[c.id]?.price
        const p = exact ?? applied ?? null
        return p != null && rowMin != null && p === rowMin
      })
    })
    const newCreated = {
      category: DEFAULT_CATEGORY,
      createdAt: new Date(),
      counterpartyCards: withAtLeastOneOrder.map((c) => ({ id: c.id, legalName: c.legalName })),
    }
    setCreatedRequest(newCreated)
    setSelectedCounterpartyId(null)
    setViewMode('created')
    saveCreatedToStorage(newCreated, summaryData, appliedAnalogue)
  }

  useEffect(() => {
    if (typeof window === 'undefined' || !businessId) return
    const key = `${STORAGE_KEY_PREFIX}${businessId}`
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) return
      const parsed = JSON.parse(raw)
      const cr = parsed?.createdRequest
      const sd = parsed?.summaryData
      if (!cr || !sd?.items?.length || !Array.isArray(sd?.counterparties)) return
      const createdAt = cr.createdAt ? new Date(cr.createdAt) : new Date()
      if (Number.isNaN(createdAt.getTime())) return
      const items: SummaryItem[] = sd.items.map((it: any) => ({
        name: typeof it.name === 'string' ? it.name : '',
        quantity: typeof it.quantity === 'string' ? it.quantity : String(it.quantity ?? ''),
        unit: typeof it.unit === 'string' ? it.unit : String(it.unit ?? ''),
        offers: it.offers && typeof it.offers === 'object' ? it.offers : {},
        analogues: it.analogues && typeof it.analogues === 'object' ? it.analogues : {},
      }))
      const counterparties: Counterparty[] = sd.counterparties.map((x: any) => ({ id: String(x.id), legalName: String(x.legalName ?? '') }))
      setSummaryData({ items, counterparties })
      setCreatedRequest({
        category: cr.category || DEFAULT_CATEGORY,
        createdAt,
        counterpartyCards: Array.isArray(cr.counterpartyCards) ? cr.counterpartyCards : [],
      })
      setAppliedAnalogue(parsed?.appliedAnalogue && typeof parsed.appliedAnalogue === 'object' ? parsed.appliedAnalogue : {})
      setUseForRequest(Object.fromEntries(counterparties.filter(isPartnerCounterparty).map((c) => [c.id, true])))
      setShowCreateBlock(true)
      setViewMode('created')
    } catch (_) {}
  }, [businessId])

  useEffect(() => {
    if (showCreateBlock && viewMode === 'form' && rows.length > 0 && lastRowRef.current) {
      lastRowRef.current.focus()
    }
  }, [showCreateBlock, viewMode, rows.length])

  useEffect(() => {
    const el = allCheckboxRef.current
    if (!el || !summaryData?.counterparties?.length) return
    const partners = summaryData.counterparties.filter(isPartnerCounterparty)
    const some = partners.some((c) => useForRequest[c.id])
    const every = partners.length > 0 && partners.every((c) => useForRequest[c.id])
    el.indeterminate = some && !every
  }, [summaryData?.counterparties, useForRequest])

  useEffect(() => {
    if (viewSection === 'incoming') fetchIncomingRequests()
  }, [viewSection])

  useEffect(() => {
    if (!sendStatus) return
    const t = setTimeout(() => setSendStatus(null), 5000)
    return () => clearTimeout(t)
  }, [sendStatus])

  useEffect(() => {
    if (menuOpenCardId == null) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpenCardId(null)
    }
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuContainerRef.current && menuContainerRef.current.contains(target)) return
      setMenuOpenCardId(null)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('click', onClick, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('click', onClick, true)
    }
  }, [menuOpenCardId])

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ marginBottom: '1rem', fontSize: '2rem' }}>Заявки</h1>

      <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <Link
            href={`/office/businesses/${businessId}`}
            style={{ padding: '0.25rem 0', color: '#111827', fontSize: '1rem', fontWeight: 500, textDecoration: 'none' }}
          >
            Назад
          </Link>
          <button
            type="button"
            onClick={() => { setViewSection('incoming'); setShowCreateBlock(false); setSelectedIncomingId(null) }}
            style={{
              padding: '0.25rem 0',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 500,
              color: '#111827',
              textAlign: 'left',
            }}
          >
            Поступившие заявки
          </button>
          <span style={{ padding: '0.25rem 0', color: '#111827', fontSize: '1rem', fontWeight: 500 }}>
            Архив заявок
          </span>
        </div>
        {sendStatus && (
          <div style={{ marginBottom: '0.75rem', padding: '0.5rem 1rem', borderRadius: '6px', background: sendStatus.ok ? '#dcfce7' : '#fee2e2', color: sendStatus.ok ? '#166534' : '#991b1b', fontSize: '0.875rem' }}>
            {sendStatus.message}
          </div>
        )}

        {viewSection === 'incoming' ? (
          <div style={{ flex: '1', minWidth: '320px', maxWidth: '900px' }}>
            <div style={{ marginBottom: '0.75rem', fontSize: '1rem', fontWeight: 500, color: '#111827' }}>Поступившие заявки</div>
            {incomingLoading ? (
              <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Загрузка...</p>
            ) : selectedIncomingId ? (() => {
              const req = incomingRequests.find((r) => r.id === selectedIncomingId)
              if (!req) return null
              const total = req.items.reduce((a, i) => a + i.sum, 0)
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedIncomingId(null)}
                    style={{ alignSelf: 'flex-start', padding: '0.5rem 1rem', background: 'none', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}
                  >
                    Назад к списку
                  </button>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: '#111827' }}>Заявка от {req.senderLegalName}</div>
                  <div style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '0.5rem' }}>{req.category || '—'}. {req.createdAt ? formatRequestDate(new Date(req.createdAt)) : ''}</div>
                  <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500 }}>№</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500 }}>Наименование</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500 }}>Кол-во</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500 }}>Ед.</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500 }}>Цена</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500 }}>Сумма</th>
                        </tr>
                      </thead>
                      <tbody>
                        {req.items.map((r, i) => (
                          <tr key={r.id}>
                            <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'center' }}>{i + 1}</td>
                            <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>{r.name}</td>
                            <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'center' }}>{r.quantity}</td>
                            <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>{r.unit}</td>
                            <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>{formatPrice(r.price)}</td>
                            <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>{formatPrice(r.sum)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: '#f3f4f6', fontWeight: 600 }}>
                          <td colSpan={5} style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>Итого</td>
                          <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>{formatPrice(total)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )
            })() : incomingRequests.length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Нет поступивших заявок</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {incomingRequests.map((req) => (
                  <button
                    key={req.id}
                    type="button"
                    onClick={() => setSelectedIncomingId(req.id)}
                    style={{
                      padding: '1rem 1.25rem',
                      textAlign: 'left',
                      background: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      maxWidth: '22em',
                    }}
                  >
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: '#111827', marginBottom: '0.35rem' }}>Заявка от {req.senderLegalName}</div>
                    <div style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '0.25rem' }}>{req.category || '—'}</div>
                    <div style={{ fontSize: '0.875rem', color: '#4b5563' }}>{req.createdAt ? formatRequestDate(new Date(req.createdAt)) : ''}. {req.total != null ? formatPrice(req.total) : ''}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ flex: '1', minWidth: '320px', maxWidth: '900px', minHeight: '200px' }}>
            {viewMode === 'form' ? (
              <>
                <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 500, color: '#111827' }}>Заявка</span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={handleAddRow}
                      style={{
                        padding: '0.5rem 1rem',
                        background: '#f3f4f6',
                        color: '#111827',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                      }}
                    >
                      Добавить строку
                    </button>
                    <button
                      type="button"
                      onClick={handleFormSubmit}
                      disabled={summaryLoading}
                      style={{
                        padding: '0.5rem 1rem',
                        background: '#0070f3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: summaryLoading ? 'not-allowed' : 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                      }}
                    >
                      {summaryLoading ? 'Загрузка...' : 'Сформировать'}
                    </button>
                  </div>
                </div>
                {summaryError && (
                  <p style={{ marginBottom: '0.5rem', color: '#dc2626', fontSize: '0.875rem' }}>{summaryError}</p>
                )}
                <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '70vh', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500, minWidth: '48px' }}>№ п/п</th>
                        {REQUEST_COLUMNS.map((col) => (
                          <th key={col.id} style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500, minWidth: '120px' }}>{col.title}</th>
                        ))}
                        <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500, minWidth: '80px' }}>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'center', background: '#f9fafb' }}>{rowIndex + 1}</td>
                          {REQUEST_COLUMNS.map((col) => (
                            <td key={col.id} style={{ padding: 0, border: '1px solid #e5e7eb' }}>
                              <input
                                ref={rowIndex === rows.length - 1 && col.id === 'name' ? lastRowRef : undefined}
                                type={col.kind === 'number' ? 'number' : 'text'}
                                value={row[col.id] ?? ''}
                                onChange={(e) => handleCellChange(rowIndex, col.id, e.target.value)}
                                onKeyDown={(e) => {
                                  if (col.id === 'unit' && e.key === 'Enter') {
                                    e.preventDefault()
                                    handleAddRow()
                                  }
                                }}
                                style={{ width: '100%', padding: '0.75rem', border: 'none', fontSize: '0.875rem', background: 'white', boxSizing: 'border-box' }}
                              />
                            </td>
                          ))}
                          <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                            <button type="button" onClick={() => handleDeleteRow(rowIndex)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, padding: '0.25rem' }} title="Удалить строку">×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <>
                {viewMode === 'summary' && (
                  <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 500, color: '#111827' }}>Сводная таблица</span>
                    <button
                      type="button"
                      onClick={() => { window.location.href = `/office/businesses/${businessId}/requests` }}
                      style={{
                        padding: '0.5rem 1rem',
                        background: 'none',
                        color: '#111827',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                      }}
                    >
                      Назад
                    </button>
                  </div>
                )}
                {viewMode === 'requestDetail' && selectedCounterpartyId && summaryData ? (() => {
                  const c = summaryData.counterparties.find((x) => x.id === selectedCounterpartyId)
                  if (!c) return null
                  const detailPartners = summaryData.counterparties.filter(isPartnerCounterparty)
                  const rowsForCounterparty = summaryData.items
                    .map((item, idx) => {
                      const itemKey = String(idx)
                      let rowMin: number | null = null
                      detailPartners.forEach((cc) => {
                        const exact = item.offers[cc.id]
                        const applied = appliedAnalogue[itemKey]?.[cc.id]?.price
                        const p = exact ?? applied ?? null
                        if (p != null && (rowMin == null || p < rowMin)) rowMin = p
                      })
                      const exact = item.offers[c.id]
                      const applied = appliedAnalogue[itemKey]?.[c.id]?.price
                      const price = exact ?? applied ?? null
                      const isMin = price != null && rowMin != null && Number.isFinite(price) && Math.abs(price - rowMin) < 1e-6
                      if (!isMin) return null
                      const qty = Math.max(0, parseFloat(String(item.quantity).replace(',', '.')) || 0)
                      return { item, price, qty, sum: price * qty }
                    })
                    .filter((r): r is NonNullable<typeof r> => r != null)
                  const total = rowsForCounterparty.reduce((a, r) => a + r.sum, 0)
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 600, color: '#111827' }}>Заявка на {c.legalName}</span>
                        <button
                          type="button"
                          onClick={() => { setViewMode('created'); setSelectedCounterpartyId(null) }}
                          style={{
                            padding: '0.5rem 1rem',
                            background: 'none',
                            color: '#111827',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                          }}
                        >
                          Назад
                        </button>
                      </div>
                      <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                          <thead>
                            <tr>
                              <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500 }}>№</th>
                              <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500 }}>Наименование</th>
                              <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500 }}>Кол-во</th>
                              <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500 }}>Ед.</th>
                              <th style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500 }}>Цена</th>
                              <th style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500 }}>Сумма</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rowsForCounterparty.map((r, i) => (
                              <tr key={i}>
                                <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'center' }}>{i + 1}</td>
                                <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>{r.item.name}</td>
                                <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'center' }}>{r.item.quantity || '—'}</td>
                                <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>{r.item.unit || '—'}</td>
                                <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>{formatPrice(r.price)}</td>
                                <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>{formatPrice(r.sum)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ background: '#f3f4f6', fontWeight: 600 }}>
                              <td colSpan={5} style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>Итого</td>
                              <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>{formatPrice(total)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )
                })(                ) : viewMode === 'created' && createdRequest ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ ...REQUEST_CARD_STYLE, background: '#f9fafb', width: '100%', maxWidth: '22em', display: 'flex', alignItems: 'flex-start', gap: '0.5rem', paddingRight: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => { setViewMode('summary'); setSelectedCounterpartyId(null) }}
                        style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }}
                      >
                        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#111827', marginBottom: '0.35rem' }}>Сводная таблица</div>
                        <div style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '0.25rem' }}>{createdRequest.category}</div>
                        <div style={{ fontSize: '0.875rem', color: '#4b5563' }}>{formatRequestDate(createdRequest.createdAt)}</div>
                      </button>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <div ref={menuOpenCardId === 'summary' ? menuContainerRef : undefined} style={{ position: 'relative' }}>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setMenuOpenCardId(menuOpenCardId === 'summary' ? null : 'summary') }}
                            aria-label="Меню"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', fontSize: '1.25rem', lineHeight: 1, color: '#6b7280' }}
                          >
                            ☰
                          </button>
                          {menuOpenCardId === 'summary' && (
                            <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '2px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 10, minWidth: '160px', padding: '0.25rem 0' }}>
                            <button type="button" onClick={downloadSummaryAsExcel} style={{ display: 'block', width: '100%', padding: '0.5rem 1rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}>Скачать (Excel)</button>
                            <button type="button" onClick={() => { setMenuOpenCardId(null); setViewMode('summary'); setSelectedCounterpartyId(null) }} style={{ display: 'block', width: '100%', padding: '0.5rem 1rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}>Редактировать</button>
                            <button type="button" onClick={handleSendAllRequests} disabled={sendingAll || sendingCounterpartyId != null} style={{ display: 'block', width: '100%', padding: '0.5rem 1rem', textAlign: 'left', background: 'none', border: 'none', cursor: sendingAll ? 'wait' : 'pointer', fontSize: '0.875rem', color: sendingAll ? '#9ca3af' : '#6b7280' }}>{sendingAll ? 'Отправка...' : 'Отправить (сводная)'}</button>
                            <button type="button" onClick={handleDeleteCreated} style={{ display: 'block', width: '100%', padding: '0.5rem 1rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', color: '#dc2626' }}>Удалить</button>
                          </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {createdRequest.counterpartyCards.map((c) => (
                      <div key={c.id} style={{ ...REQUEST_CARD_STYLE, background: 'white', width: '100%', maxWidth: '22em', display: 'flex', alignItems: 'flex-start', gap: '0.5rem', paddingRight: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => { setSelectedCounterpartyId(c.id); setViewMode('requestDetail') }}
                          style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }}
                        >
                          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#111827', marginBottom: '0.35rem' }}>Заявка {c.legalName}</div>
                          <div style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '0.25rem' }}>{createdRequest.category}</div>
                          <div style={{ fontSize: '0.875rem', color: '#4b5563' }}>{formatRequestDate(createdRequest.createdAt)}</div>
                        </button>
                        <div style={{ position: 'relative', flexShrink: 0 }} ref={menuOpenCardId === c.id ? menuContainerRef : undefined}>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setMenuOpenCardId(menuOpenCardId === c.id ? null : c.id) }}
                            aria-label="Меню"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', fontSize: '1.25rem', lineHeight: 1, color: '#6b7280' }}
                          >
                            ☰
                          </button>
                          {menuOpenCardId === c.id && (
                            <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '2px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 10, minWidth: '160px', padding: '0.25rem 0' }}>
                              <button type="button" onClick={() => downloadCounterpartyAsExcel(c.id)} style={{ display: 'block', width: '100%', padding: '0.5rem 1rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}>Скачать (Excel)</button>
                              <button type="button" onClick={() => { setMenuOpenCardId(null); setViewMode('summary'); setSelectedCounterpartyId(null) }} style={{ display: 'block', width: '100%', padding: '0.5rem 1rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}>Редактировать</button>
                              <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSendRequest(c.id) }} disabled={sendingCounterpartyId != null || sendingAll} style={{ display: 'block', width: '100%', padding: '0.5rem 1rem', textAlign: 'left', background: 'none', border: 'none', cursor: sendingCounterpartyId != null || sendingAll ? 'wait' : 'pointer', fontSize: '0.875rem', opacity: sendingCounterpartyId != null || sendingAll ? 0.7 : 1 }}>{sendingCounterpartyId === c.id ? 'Отправка...' : 'Отправить'}</button>
                              <button type="button" onClick={() => handleDeleteCounterpartyCard(c.id)} style={{ display: 'block', width: '100%', padding: '0.5rem 1rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', color: '#dc2626' }}>Удалить</button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : summaryData ? (() => {
                  const partners = summaryData.counterparties.filter(isPartnerCounterparty)
                  const sumByCounterparty: Record<string, number> = {}
                  summaryData.counterparties.forEach((c) => { sumByCounterparty[c.id] = 0 })
                  summaryData.items.forEach((item, idx) => {
                    const itemKey = String(idx)
                    const qty = Math.max(0, parseFloat(String(item.quantity).replace(',', '.')) || 0)
                    let rowMin: number | null = null
                    partners.forEach((c) => {
                      const exact = item.offers[c.id]
                      const applied = appliedAnalogue[itemKey]?.[c.id]?.price
                      const p = exact ?? applied ?? null
                      if (p != null && (rowMin == null || p < rowMin)) rowMin = p
                    })
                    partners.forEach((c) => {
                      const exact = item.offers[c.id]
                      const applied = appliedAnalogue[itemKey]?.[c.id]?.price
                      const p = exact ?? applied ?? null
                      if (p != null && rowMin != null && p === rowMin) {
                        sumByCounterparty[c.id] += p * qty
                      }
                    })
                    if (item.offers[OWN_PRICE_ID] != null) {
                      sumByCounterparty[OWN_PRICE_ID] += item.offers[OWN_PRICE_ID] * qty
                    }
                  })
                  const rowTotals = summaryData.items.map((item, idx) => {
                    const itemKey = String(idx)
                    const qty = Math.max(0, parseFloat(String(item.quantity).replace(',', '.')) || 0)
                    let rowMin: number | null = null
                    partners.forEach((c) => {
                      const exact = item.offers[c.id]
                      const applied = appliedAnalogue[itemKey]?.[c.id]?.price
                      const p = exact ?? applied ?? null
                      if (p != null && (rowMin == null || p < rowMin)) rowMin = p
                    })
                    return rowMin != null ? rowMin * qty : 0
                  })
                  const totalMinSum = rowTotals.reduce((a, b) => a + b, 0)
                  return (
                  <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '70vh', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500, minWidth: '48px' }}>№</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500, minWidth: '140px' }}>Наименование</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500, minWidth: '80px' }}>Кол-во</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500, minWidth: '60px' }}>Ед.</th>
                          {summaryData.counterparties.map((c) => (
                            <th key={c.id} style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #e5e7eb', background: c.id === OWN_PRICE_ID ? '#f0fdf4' : '#f9fafb', fontWeight: 500, minWidth: '100px', verticalAlign: 'top' }}>
                              <div style={{ marginBottom: '0.35rem' }}>{c.legalName}</div>
                              {c.id !== OWN_PRICE_ID && (
                                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 400, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                  <input
                                    type="checkbox"
                                    checked={!!useForRequest[c.id]}
                                    onChange={() => {
                                      setUseForRequest((prev) => ({ ...prev, [c.id]: !prev[c.id] }))
                                    }}
                                  />
                                  В заявку
                                </label>
                              )}
                            </th>
                          ))}
                          <th style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500, minWidth: '100px', verticalAlign: 'top' }}>
                            <div style={{ marginBottom: '0.35rem' }}>Итоговая сумма</div>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              <input
                                ref={allCheckboxRef}
                                type="checkbox"
                                checked={partners.length > 0 && partners.every((c) => useForRequest[c.id])}
                                onChange={() => {
                                  const allChecked = partners.every((c) => useForRequest[c.id])
                                  const next = Object.fromEntries(partners.map((c) => [c.id, !allChecked]))
                                  setUseForRequest(next)
                                }}
                              />
                              Использовать для заявки: Все
                            </label>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {summaryData.items.map((item, idx) => {
                          const itemKey = String(idx)
                          const qty = Math.max(0, parseFloat(String(item.quantity).replace(',', '.')) || 0)
                          const partnerPrices = partners.map((c) => {
                            const exact = item.offers[c.id]
                            const applied = appliedAnalogue[itemKey]?.[c.id]?.price
                            return exact ?? applied ?? null
                          }).filter((p): p is number => p != null)
                          const minPrice = partnerPrices.length > 0 ? Math.min(...partnerPrices) : null
                          const rowTotalSum = minPrice != null ? minPrice * qty : 0
                          return (
                            <tr key={idx}>
                              <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'center', background: '#f9fafb' }}>{idx + 1}</td>
                              <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>{item.name}</td>
                              <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'center' }}>{item.quantity || '—'}</td>
                              <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>{item.unit || '—'}</td>
                              {summaryData.counterparties.map((c) => {
                                const exactPrice = item.offers[c.id]
                                const appliedVal = appliedAnalogue[itemKey]?.[c.id]
                                const effectivePrice = exactPrice ?? appliedVal?.price ?? null
                                const isMin = minPrice != null && effectivePrice === minPrice
                                const analogues = item.analogues?.[c.id] || []
                                const hasAnalogue = analogues.length > 0 && exactPrice == null && !appliedVal
                                return (
                                  <td
                                    key={c.id}
                                    style={{
                                      padding: '0.75rem',
                                      border: '1px solid #e5e7eb',
                                      textAlign: 'right',
                                      backgroundColor: isMin ? '#dcfce7' : 'white',
                                      fontWeight: isMin ? 600 : 400,
                                      verticalAlign: 'top',
                                    }}
                                  >
                                    {effectivePrice != null ? (
                                      formatPrice(effectivePrice)
                                    ) : hasAnalogue ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-end' }}>
                                        {analogues.slice(0, 3).map((a, i) => (
                                          <div key={i} style={{ fontSize: '0.8125rem' }}>
                                            <span style={{ color: '#4b5563' }}>{a.name}</span>
                                            <span style={{ marginLeft: '0.35rem' }}>{formatPrice(a.price)}</span>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setAppliedAnalogue((prev) => ({
                                                  ...prev,
                                                  [itemKey]: {
                                                    ...(prev[itemKey] || {}),
                                                    [c.id]: { name: a.name, price: a.price },
                                                  },
                                                }))
                                              }}
                                              style={{
                                                marginLeft: '0.35rem',
                                                padding: '0.2rem 0.5rem',
                                                fontSize: '0.75rem',
                                                background: '#e0f2fe',
                                                color: '#0369a1',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                              }}
                                            >
                                              Применить аналог
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                )
                              })}
                              <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right', fontWeight: rowTotalSum > 0 ? 600 : 400 }}>
                                {rowTotalSum > 0 ? formatPrice(rowTotalSum) : '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: '#f3f4f6', fontWeight: 600 }}>
                          <td colSpan={4} style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>Итого</td>
                          {summaryData.counterparties.map((c) => (
                            <td key={c.id} style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>
                              {sumByCounterparty[c.id] > 0 ? formatPrice(sumByCounterparty[c.id]) : '—'}
                            </td>
                          ))}
                          <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>
                            {totalMinSum > 0 ? formatPrice(totalMinSum) : '—'}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  )
                })() : null}
              </>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
