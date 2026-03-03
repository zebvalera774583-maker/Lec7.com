'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import PriceUploadModal from './PriceUploadModal'
import PriceImportModal from './PriceImportModal'
import CreateDerivedPriceModal from './CreateDerivedPriceModal'
import AssignCounterpartyModal from './AssignCounterpartyModal'

interface Row {
  [columnId: string]: string
}

interface Column {
  id: string
  title: string
  kind: 'text' | 'number'
  isBase: boolean
}

interface Price {
  id: string
  name: string
  kind: 'BASE' | 'DERIVED'
  derivedFromId?: string | null
  modifierType?: 'MARKUP' | 'DISCOUNT' | null
  percent?: number | null
  rows?: Row[]
  columns?: Column[] | null
  assignedCounterparties?: string[]
  _count?: {
    rows: number
    assignments: number
  }
}

interface TelegramRecipientItem {
  id: string
  chatIdMasked: string
  label: string | null
  isActive: boolean
  createdAt: string
}

interface RequestItem {
  id: string
  title: string
  status: string
  createdAt: string
}

interface PartnershipPageClientProps {
  businessId: string
  businessName: string
  telegramChatId: string | null
  telegramRecipients: TelegramRecipientItem[]
  requests: RequestItem[]
  initialAction?: string
  initialSection?: string
}

interface AssignedPrice {
  id: string
  priceListId: string
  priceName: string
  priceCategory: string | null
  priceKind: string
  priceModifierType: string | null
  pricePercent: number | null
  sourceBusinessId: string
  sourceBusinessLegalName: string | null
  sourceBusinessName: string | null
  sourceBusinessSlug: string | null
  sourceBusinessDisplayName: string | null
  sourceBusinessResidentNumber: string | null
  assignedAt: string
}

interface ActiveCounterparty {
  partnerBusinessId: string
  legalName: string | null
  name: string | null
  slug: string | null
  residentNumber: string | null
}

interface IncomingRequest {
  linkId: string
  fromBusinessId: string
  fromLegalName: string | null
  fromName: string | null
  fromSlug: string | null
  fromResidentNumber: string | null
  createdAt: string
}

export default function PartnershipPageClient({ businessId, businessName, telegramChatId: initialTelegramChatId, telegramRecipients: initialRecipients, requests, initialAction, initialSection }: PartnershipPageClientProps) {
  const router = useRouter()
  const [prices, setPrices] = useState<Price[]>([])
  const [assignedPrices, setAssignedPrices] = useState<AssignedPrice[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [updatePriceId, setUpdatePriceId] = useState<string | null>(null)
  const [isCreateDerivedModalOpen, setIsCreateDerivedModalOpen] = useState(false)
  const [isAssignCounterpartyModalOpen, setIsAssignCounterpartyModalOpen] = useState(false)
  const [assigningPriceId, setAssigningPriceId] = useState<string | null>(null)
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null)
  const [editingPriceData, setEditingPriceData] = useState<{ rows: Row[]; columns: Column[]; category?: string | null } | null>(null)
  const [isViewOnlyMode, setIsViewOnlyMode] = useState(false)
  const [menuOpenPriceId, setMenuOpenPriceId] = useState<string | null>(null)
  const [activeCounterparties, setActiveCounterparties] = useState<ActiveCounterparty[]>([])
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([])
  const [maxRequests, setMaxRequests] = useState<{ requestId: string; number: number | null; title: string; description: string; createdAt: string }[]>([])
  const [activeCounterpartiesExpanded, setActiveCounterpartiesExpanded] = useState(false)
  const [incomingRequestsExpanded, setIncomingRequestsExpanded] = useState(false)
  const [loadingPartnership, setLoadingPartnership] = useState(false)
  
  // Telegram integration states
  const [telegramChatId, setTelegramChatId] = useState<string | null>(initialTelegramChatId)
  const [telegramRecipients, setTelegramRecipients] = useState<TelegramRecipientItem[]>(initialRecipients)
  const [telegramLoading, setTelegramLoading] = useState(false)
  const [botStartUrl, setBotStartUrl] = useState<string>('')
  const [connectToken, setConnectToken] = useState<string>('')
  const [telegramError, setTelegramError] = useState<string>('')
  // Add recipient flow
  const [addRecipientLabel, setAddRecipientLabel] = useState('')
  const [addRecipientBotUrl, setAddRecipientBotUrl] = useState('')
  const [addRecipientToken, setAddRecipientToken] = useState('')
  const [addRecipientLoading, setAddRecipientLoading] = useState(false)
  const [telegramPanelOpen, setTelegramPanelOpen] = useState(false)
  const [removingCounterpartyId, setRemovingCounterpartyId] = useState<string | null>(null)
  const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null)

  // Сводная за период (таблица №4)
  const [isPeriodSummaryOpen, setIsPeriodSummaryOpen] = useState(false)
  const [periodDateFrom, setPeriodDateFrom] = useState('')
  const [periodDateTo, setPeriodDateTo] = useState('')
  const [periodSummaryData, setPeriodSummaryData] = useState<{ items: { name: string; quantity: string; unit: string; offers: Record<string, number> }[]; counterparties: { id: string; legalName: string }[] } | null>(null)
  const [periodSummaryLoading, setPeriodSummaryLoading] = useState(false)
  const [periodSummaryError, setPeriodSummaryError] = useState<string | null>(null)

  // Назначить исполнителя: панель справа
  const [assignPerformerOpen, setAssignPerformerOpen] = useState(false)
  const [assignRole, setAssignRole] = useState<'PICKER' | 'RECEIVER' | ''>('')
  const [assignData, setAssignData] = useState<{ pickers: { label: string; url: string }[]; receivers: { label: string; url: string }[] }>({ pickers: [], receivers: [] })
  const [assignInvite, setAssignInvite] = useState<{ label: string; url: string; role: 'PICKER' | 'RECEIVER' } | null>(null)
  const [assignLoading, setAssignLoading] = useState(false)
  const [assignGenerateLoading, setAssignGenerateLoading] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)

  // Скачать прайс в Excel (.xlsx): № п/п, ширина Наименование 28, Цена 22, только сохранённые колонки
  const downloadPriceAsExcel = (rows: Row[], columns: Column[], filename: string) => {
    const headerRow = ['№ п/п', ...columns.map((c) => c.title)]
    const dataRows = rows.map((row, index) => [
      index + 1,
      ...columns.map((col) => {
        const v = row[col.id] ?? ''
        if (col.kind === 'number' && v !== '') {
          const n = parseFloat(String(v))
          return Number.isNaN(n) ? String(v) : n
        }
        return String(v)
      }),
    ])
    const aoa = [headerRow, ...dataRows]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    // Ширины в единицах Excel: № п/п = 8, Наименование = 28, Цена* = 22, остальные 15
    const colWidths = [
      { wch: 8 },
      ...columns.map((col) => {
        if (col.id === 'name' || col.title === 'Наименование') return { wch: 28 }
        if (col.id === 'priceWithVat' || col.id === 'priceWithoutVat' || /цена/i.test(col.title)) return { wch: 22 }
        return { wch: 15 }
      }),
    ]
    ws['!cols'] = colWidths
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Прайс')
    const safeName = filename.replace(/[^\w\s\u0400-\u04FF-]/g, '').trim() || 'Прайс'
    XLSX.writeFile(wb, `${safeName}.xlsx`)
  }

  const downloadPeriodSummaryAsExcel = (
    data: { items: { name: string; quantity: string; unit: string; offers: Record<string, number> }[]; counterparties: { id: string; legalName: string }[] },
    dateFrom: string,
    dateTo: string
  ) => {
    const fmt = (n: number) => n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    const totalSum = data.items.reduce((a, r) => {
      const prices = data.counterparties.map((c) => r.offers[c.id] ?? null)
      const minP = prices.filter((x): x is number => x != null)
      const rowMin = minP.length > 0 ? Math.min(...minP) : null
      const qty = parseFloat(r.quantity) || 0
      return a + (rowMin != null ? rowMin * qty : 0)
    }, 0)
    const sumByCounterparty = data.counterparties.map((c) =>
      data.items.reduce((a, r) => {
        const p = r.offers[c.id] ?? null
        const prices = data.counterparties.map((cc) => r.offers[cc.id] ?? null)
        const minP = prices.filter((x): x is number => x != null)
        const rowMin = minP.length > 0 ? Math.min(...minP) : null
        const qty = parseFloat(r.quantity) || 0
        if (rowMin != null && p != null && p === rowMin) return a + p * qty
        return a
      }, 0)
    )
    const fullOrderByCounterparty = data.counterparties.map((c) =>
      data.items.reduce((a, r) => {
        let p = r.offers[c.id] ?? null
        if (p == null) {
          const others = data.counterparties.filter((cc) => cc.id !== c.id)
          let minOther: number | null = null
          others.forEach((o) => {
            const op = r.offers[o.id] ?? null
            if (op != null && (minOther == null || op < minOther)) minOther = op
          })
          p = minOther ?? 0
        }
        const qty = parseFloat(r.quantity) || 0
        return a + p * qty
      }, 0)
    )
    const headerRow = ['№', 'Наименование', 'Кол-во', 'Ед.', ...data.counterparties.map((c) => c.legalName), 'Итоговая сумма']
    const dataRows = data.items.map((r, idx) => {
      const prices = data.counterparties.map((c) => r.offers[c.id] ?? null)
      const minP = prices.filter((x): x is number => x != null)
      const rowMin = minP.length > 0 ? Math.min(...minP) : null
      const qty = parseFloat(r.quantity) || 0
      const rowSum = rowMin != null ? rowMin * qty : null
      return [
        idx + 1,
        r.name,
        r.quantity || '',
        r.unit || '',
        ...data.counterparties.map((c) => (r.offers[c.id] != null ? r.offers[c.id] : '')),
        rowSum != null ? rowSum : '',
      ]
    })
    const footerRow1 = ['Итого (по выбранным позициям)', '', '', '', ...sumByCounterparty.map((s) => (s > 0 ? s : '')), totalSum > 0 ? totalSum : '']
    const footerRow2 = ['Сумма заказа у поставщика', '', '', '', ...fullOrderByCounterparty.map((s) => (s > 0 ? s : '')), '']
    const footerRow3 = ['Экономия', '', '', '', ...fullOrderByCounterparty.map((s) => {
      const saving = totalSum - s
      if (saving === 0) return 0
      return saving > 0 ? `+${fmt(saving)}` : `-${fmt(Math.abs(saving))}`
    }), '']
    const aoa = [headerRow, ...dataRows, footerRow1, footerRow2, footerRow3]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [{ wch: 6 }, { wch: 28 }, { wch: 10 }, { wch: 8 }, ...data.counterparties.map(() => ({ wch: 14 })), { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Сводная')
    const safeName = `Сводная_за_период_${dateFrom}_${dateTo}`.replace(/[^\w\s\u0400-\u04FF-]/g, '_').trim() || 'Сводная_за_период'
    XLSX.writeFile(wb, `${safeName}.xlsx`)
  }

  const handleDownloadPrice = async (priceId: string, priceName: string) => {
    setMenuOpenPriceId(null)
    try {
      const response = await fetch(`/api/office/businesses/${businessId}/prices/${priceId}`, {
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Не удалось загрузить прайс')
      const data = await response.json()
      const rows: Row[] = (data.rows || []).map((row: any) => {
        const result: Row = {
          name: row.name || '',
          unit: row.unit || '',
          priceWithVat: row.priceWithVat != null ? String(row.priceWithVat) : '',
          priceWithoutVat: row.priceWithoutVat != null ? String(row.priceWithoutVat) : '',
        }
        if (row.extra && typeof row.extra === 'object') Object.assign(result, row.extra)
        return result
      })
      // Используем полный сохранённый список колонок (если пользователь убрал столбец — его нет в выгрузке)
      const baseDefs: Column[] = [
        { id: 'name', title: 'Наименование', kind: 'text', isBase: true },
        { id: 'unit', title: 'Ед. изм', kind: 'text', isBase: true },
        { id: 'priceWithVat', title: 'Цена за ед. изм. С НДС', kind: 'number', isBase: true },
        { id: 'priceWithoutVat', title: 'Цена за ед. изм. без НДС', kind: 'number', isBase: true },
      ]
      let columns: Column[]
      if (data.columns && Array.isArray(data.columns) && data.columns.length > 0) {
        columns = data.columns.map((col: any) => ({
          id: col.id,
          title: col.title || col.id,
          kind: col.kind === 'number' ? 'number' : 'text',
          isBase: ['name', 'unit', 'priceWithVat', 'priceWithoutVat'].includes(col.id),
        }))
        if (!columns.some((c) => c.id === 'name')) columns.unshift(baseDefs[0])
        if (!columns.some((c) => c.id === 'unit')) columns.splice(1, 0, baseDefs[1])
      } else {
        columns = [...baseDefs]
      }
      downloadPriceAsExcel(rows, columns, priceName)
    } catch (e) {
      console.error('Download price error:', e)
    }
  }

  // Загрузка прайсов из API
  const loadPrices = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/office/businesses/${businessId}/prices`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load prices')
      }

      const data = await response.json()
      setPrices(data || [])
    } catch (error) {
      console.error('Failed to load prices:', error)
    } finally {
      setLoading(false)
    }
  }

  // Загрузка назначенных прайсов (для контрагента)
  const loadAssignedPrices = async () => {
    try {
      const response = await fetch(`/api/office/businesses/${businessId}/assigned-prices`, {
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        setAssignedPrices(data || [])
      }
    } catch (error) {
      console.error('Failed to load assigned prices:', error)
    }
  }

  // Загрузка данных партнёрства
  const loadPartnershipData = async () => {
    try {
      setLoadingPartnership(true)
      const response = await fetch(`/api/office/businesses/${businessId}/partnership`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load partnership data')
      }

      const data = await response.json()
      setActiveCounterparties(data.activeCounterparties || [])
      setIncomingRequests(data.incomingRequests || [])
      setMaxRequests(data.maxRequests || [])
    } catch (error) {
      console.error('Failed to load partnership data:', error)
    } finally {
      setLoadingPartnership(false)
    }
  }

  const handleDeleteRequest = async (requestId: string) => {
    if (!window.confirm('Удалить эту заявку?')) return
    try {
      setDeletingRequestId(requestId)
      const r = await fetch(`/api/office/businesses/${businessId}/request/${requestId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!r.ok) throw new Error('Не удалось удалить')
      await loadPartnershipData()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка удаления заявки')
    } finally {
      setDeletingRequestId(null)
    }
  }

  // Обработка принятия/отклонения заявки
  const handleRequestAction = async (linkId: string, action: 'accept' | 'decline') => {
    try {
      const response = await fetch(`/api/office/businesses/${businessId}/partnership/requests/${linkId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ action }),
      })

      if (!response.ok) {
        throw new Error('Failed to process request')
      }

      // Перезагружаем данные партнёрства
      await loadPartnershipData()
    } catch (error) {
      console.error('Failed to process request:', error)
      alert('Ошибка обработки заявки')
    }
  }

  // Функция для получения отображаемого названия контрагента
  const getCounterpartyDisplayName = (counterparty: ActiveCounterparty | IncomingRequest) => {
    const legalName = 'fromLegalName' in counterparty ? counterparty.fromLegalName : counterparty.legalName
    const name = 'fromName' in counterparty ? counterparty.fromName : counterparty.name
    const slug = 'fromSlug' in counterparty ? counterparty.fromSlug : counterparty.slug
    const residentNumber = 'fromResidentNumber' in counterparty ? counterparty.fromResidentNumber : counterparty.residentNumber

    if (legalName && legalName.trim().length > 0) return legalName.trim()
    if (name) return name
    if (slug) return slug
    if (residentNumber) return residentNumber
    return 'fromBusinessId' in counterparty ? counterparty.fromBusinessId : counterparty.partnerBusinessId
  }

  const handleRemoveCounterparty = async (partnerBusinessId: string) => {
    if (removingCounterpartyId) return
    const confirmed = window.confirm('Удалить контрагента из списка действующих?')
    if (!confirmed) return
    try {
      setRemovingCounterpartyId(partnerBusinessId)
      const r = await fetch(
        `/api/office/businesses/${businessId}/partnership/counterparties/${partnerBusinessId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
      )
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data?.error || 'Ошибка удаления контрагента')
      await loadPartnershipData()
    } catch (e) {
      console.error('Remove counterparty error:', e)
      alert(e instanceof Error ? e.message : 'Ошибка удаления контрагента')
    } finally {
      setRemovingCounterpartyId(null)
    }
  }

  // Подключение Telegram
  const connectTelegram = async () => {
    setTelegramLoading(true)
    setTelegramError('')
    try {
      const r = await fetch(`/api/office/businesses/${businessId}/integrations/telegram/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error ?? "connect failed")
      setBotStartUrl(data.botStartUrl)
      setConnectToken(data.connectToken || '')
    } catch (err: any) {
      setTelegramError(err.message || 'Ошибка подключения')
    } finally {
      setTelegramLoading(false)
    }
  }

  // Построение URL для открытия в Telegram приложении
  const getBotStartAppUrl = (): string => {
    if (!connectToken || !botStartUrl) return ''
    // Извлекаем username из botStartUrl (формат: https://t.me/username?start=token)
    const match = botStartUrl.match(/https:\/\/t\.me\/([^?]+)/)
    if (match && match[1]) {
      const botUsername = match[1]
      return `tg://resolve?domain=${botUsername}&start=${connectToken}`
    }
    return ''
  }

  // Обновление статуса подключения
  const refreshTelegramStatus = async () => {
    router.refresh()
  }

  useEffect(() => {
    loadPrices()
    loadAssignedPrices()
    loadPartnershipData()
  }, [businessId])

  // Обновляем telegramChatId при изменении пропса
  useEffect(() => {
    setTelegramChatId(initialTelegramChatId)
    // Если подключение успешно, очищаем botStartUrl и connectToken
    if (initialTelegramChatId) {
      setBotStartUrl('')
      setConnectToken('')
      setTelegramError('')
    }
  }, [initialTelegramChatId])

  useEffect(() => {
    setTelegramRecipients(initialRecipients)
  }, [initialRecipients])

  useEffect(() => {
    if (initialAction === 'create-price') {
      setEditingPriceId(null)
      setEditingPriceData(null)
      setIsViewOnlyMode(false)
      setIsModalOpen(true)
    } else if (initialAction === 'import-price') {
      setUpdatePriceId(null)
      setIsImportModalOpen(true)
    }
  }, [initialAction])

  useEffect(() => {
    if (initialSection === 'incoming') {
      setIncomingRequestsExpanded(true)
      setActiveCounterpartiesExpanded(false)
      setAssignPerformerOpen(false)
      setTelegramPanelOpen(false)
      loadPartnershipData()
    } else if (initialSection === 'counterparties') {
      setActiveCounterpartiesExpanded(true)
      setIncomingRequestsExpanded(false)
      setAssignPerformerOpen(false)
      setTelegramPanelOpen(false)
      loadPartnershipData()
    } else if (initialSection === 'performers') {
      setAssignPerformerOpen(true)
      setTelegramPanelOpen(false)
    } else if (initialSection === 'telegram') {
      setTelegramPanelOpen(true)
      setAssignPerformerOpen(false)
    }
  }, [initialSection])

  // Загрузка существующих инвайтов при открытии drawer «Назначить исполнителя»
  const loadAssignExisting = async () => {
    setAssignLoading(true)
    setAssignError(null)
    try {
      const r = await fetch(`/api/office/businesses/${businessId}/assign-performer`, { credentials: 'include' })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error || 'Failed to load')
      const pickers = data.pickers || []
      const receivers = data.receivers || []
      setAssignData({ pickers, receivers })
      const firstPicker = pickers[0]
      const firstReceiver = receivers[0]
      if (firstPicker) {
        setAssignRole('PICKER')
        setAssignInvite({ label: firstPicker.label, url: firstPicker.url, role: 'PICKER' })
      } else if (firstReceiver) {
        setAssignRole('RECEIVER')
        setAssignInvite({ label: firstReceiver.label, url: firstReceiver.url, role: 'RECEIVER' })
      } else {
        setAssignRole('')
        setAssignInvite(null)
      }
    } catch (e: unknown) {
      setAssignError(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setAssignLoading(false)
    }
  }

  useEffect(() => {
    if (assignPerformerOpen) {
      setAssignInvite(null)
      setAssignRole('')
      setAssignData({ pickers: [], receivers: [] })
      setAssignError(null)
      loadAssignExisting()
    } else if (!assignPerformerOpen) {
      setAssignInvite(null)
      setAssignRole('')
      setAssignError(null)
    }
  }, [assignPerformerOpen])

  const handleAssignRoleChange = (role: 'PICKER' | 'RECEIVER') => {
    setAssignRole(role)
    const existing = role === 'PICKER' ? assignData.pickers[0] : assignData.receivers[0]
    if (existing) {
      setAssignInvite({ label: existing.label, url: existing.url, role })
    } else {
      setAssignInvite(null)
      handleAssignGenerate(role)
    }
  }

  const handleAssignGenerate = async (role: 'PICKER' | 'RECEIVER') => {
    setAssignGenerateLoading(true)
    setAssignError(null)
    try {
      const r = await fetch(`/api/office/businesses/${businessId}/assign-performer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error || 'Ошибка')
      const p = data.picker
      const rec = data.receiver
      if (p) {
        setAssignInvite({ label: p.label, url: p.url, role: 'PICKER' })
        setAssignData((prev) => ({ ...prev, pickers: [p, ...prev.pickers] }))
      } else if (rec) {
        setAssignInvite({ label: rec.label, url: rec.url, role: 'RECEIVER' })
        setAssignData((prev) => ({ ...prev, receivers: [rec, ...prev.receivers] }))
      }
    } catch (e: unknown) {
      setAssignError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setAssignGenerateLoading(false)
    }
  }

  const copyAssignLink = () => {
    if (assignInvite?.url) navigator.clipboard.writeText(assignInvite.url)
  }

  const handleAssignDelete = async () => {
    setAssignError(null)
    const role = assignInvite?.role || assignRole || 'PICKER'
    try {
      const r = await fetch(
        `/api/office/businesses/${businessId}/assign-performer${role === 'RECEIVER' ? '?role=RECEIVER' : ''}`,
        { method: 'DELETE', credentials: 'include' }
      )
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data?.error || 'Ошибка удаления')
      setAssignInvite(null)
      setAssignData((prev) =>
        role === 'RECEIVER'
          ? { ...prev, receivers: prev.receivers.slice(1) }
          : { ...prev, pickers: prev.pickers.slice(1) }
      )
    } catch (e: unknown) {
      setAssignError(e instanceof Error ? e.message : 'Ошибка удаления')
    }
  }

  // Добавить получателя: connect с mode add_recipient
  const connectAddRecipient = async () => {
    setAddRecipientLoading(true)
    setTelegramError('')
    try {
      const r = await fetch(`/api/office/businesses/${businessId}/integrations/telegram/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mode: 'add_recipient',
          label: addRecipientLabel.trim() || undefined,
        }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error ?? 'connect failed')
      setAddRecipientBotUrl(data.botStartUrl)
      setAddRecipientToken(data.connectToken || '')
    } catch (err: any) {
      setTelegramError(err.message || 'Ошибка генерации ссылки')
    } finally {
      setAddRecipientLoading(false)
    }
  }

  const toggleRecipientActive = async (recipientId: string, isActive: boolean) => {
    try {
      const r = await fetch(`/api/office/businesses/${businessId}/integrations/telegram/recipients/${recipientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive }),
      })
      if (!r.ok) throw new Error('Failed to update')
      router.refresh()
    } catch (e) {
      console.error('Toggle recipient error:', e)
    }
  }

  const getAddRecipientAppUrl = (): string => {
    if (!addRecipientToken || !addRecipientBotUrl) return ''
    const match = addRecipientBotUrl.match(/https:\/\/t\.me\/([^?]+)/)
    if (match?.[1]) return `tg://resolve?domain=${match[1]}&start=${addRecipientToken}`
    return ''
  }

  const copyAddRecipientLink = () => {
    if (addRecipientBotUrl) {
      void navigator.clipboard.writeText(addRecipientBotUrl)
      // можно показать toast
    }
  }

  // Загрузка данных конкретного прайса (для редактирования)
  const loadPriceData = async (priceId: string) => {
    try {
      const response = await fetch(`/api/office/businesses/${businessId}/prices/${priceId}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load price data')
      }

      const data = await response.json()
      
      // Преобразуем rows из БД в формат UI
      const rows: Row[] = data.rows.map((row: any) => {
        const result: Row = {
          name: row.name || '',
          unit: row.unit || '',
          priceWithVat: row.priceWithVat ? String(row.priceWithVat) : '',
          priceWithoutVat: row.priceWithoutVat ? String(row.priceWithoutVat) : '',
        }
        
        // Добавляем дополнительные колонки из extra
        if (row.extra && typeof row.extra === 'object') {
          Object.assign(result, row.extra)
        }
        
        return result
      })

      const BASE_COLUMN_DEFS: Column[] = [
        { id: 'name', title: 'Наименование', kind: 'text', isBase: true },
        { id: 'unit', title: 'Ед. изм', kind: 'text', isBase: true },
        { id: 'priceWithVat', title: 'Цена за ед. изм. С НДС', kind: 'number', isBase: true },
        { id: 'priceWithoutVat', title: 'Цена за ед. изм. без НДС', kind: 'number', isBase: true },
      ]
      let columns: Column[]
      if (data.columns && typeof data.columns === 'object' && Array.isArray(data.columns) && data.columns.length > 0) {
        columns = data.columns.map((col: any) => ({
          id: col.id,
          title: col.title || col.id,
          kind: col.kind === 'number' ? 'number' : 'text',
          isBase: ['name', 'unit', 'priceWithVat', 'priceWithoutVat'].includes(col.id),
        }))
        if (!columns.some((c) => c.id === 'name')) columns.unshift(BASE_COLUMN_DEFS[0])
        if (!columns.some((c) => c.id === 'unit')) columns.splice(1, 0, BASE_COLUMN_DEFS[1])
      } else {
        const hasAnyPriceWithoutVat = data.rows?.some((r: any) => r.priceWithoutVat != null)
        columns = hasAnyPriceWithoutVat ? [...BASE_COLUMN_DEFS] : BASE_COLUMN_DEFS.filter((c) => c.id !== 'priceWithoutVat')
      }

      setEditingPriceData({ rows, columns, category: data.category })
    } catch (error) {
      console.error('Failed to load price data:', error)
    }
  }

  const handleSave = async (rows: Row[], columns: Column[], category?: string) => {
    try {
      // Фильтруем пустые строки (где все поля пустые)
      const nonEmptyRows = rows.filter((row) => {
        const values = Object.values(row).filter((v) => v && String(v).trim() !== '')
        return values.length > 0
      })

      // Если нет ни одной заполненной строки, используем хотя бы одну пустую
      const rowsToSave = nonEmptyRows.length > 0 ? nonEmptyRows : [{}]

      if (editingPriceId) {
        // Редактирование существующего прайса
        // Преобразуем rows в формат БД
        const dbRows = rowsToSave.map((row, index) => {
          const { name, unit, priceWithVat, priceWithoutVat, ...extra } = row
          
          // Обработка числовых значений
          let priceWithVatNum: number | null = null
          let priceWithoutVatNum: number | null = null
          
          if (priceWithVat && String(priceWithVat).trim() !== '') {
            const parsed = parseFloat(String(priceWithVat))
            if (!isNaN(parsed)) {
              priceWithVatNum = parsed
            }
          }
          
          if (priceWithoutVat && String(priceWithoutVat).trim() !== '') {
            const parsed = parseFloat(String(priceWithoutVat))
            if (!isNaN(parsed)) {
              priceWithoutVatNum = parsed
            }
          }

          // Убираем базовые поля из extra
          const extraClean: any = {}
          for (const [key, value] of Object.entries(extra)) {
            if (!['name', 'unit', 'priceWithVat', 'priceWithoutVat'].includes(key)) {
              extraClean[key] = value
            }
          }

          return {
            name: name || '',
            unit: unit || null,
            priceWithVat: priceWithVatNum,
            priceWithoutVat: priceWithoutVatNum,
            extra: Object.keys(extraClean).length > 0 ? extraClean : null,
          }
        })

        // Сохраняем полный список колонок (в т.ч. если пользователь удалил «с НДС» или «без НДС»)
        const response = await fetch(`/api/office/businesses/${businessId}/prices/${editingPriceId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            rows: dbRows,
            columns,
            category: category || null,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to save price')
        }
      } else {
        // Создание нового базового прайса
        const dbRows = rowsToSave.map((row, index) => {
          const { name, unit, priceWithVat, priceWithoutVat, ...extra } = row
          
          // Обработка числовых значений
          let priceWithVatNum: number | null = null
          let priceWithoutVatNum: number | null = null
          
          if (priceWithVat && String(priceWithVat).trim() !== '') {
            const parsed = parseFloat(String(priceWithVat))
            if (!isNaN(parsed)) {
              priceWithVatNum = parsed
            }
          }
          
          if (priceWithoutVat && String(priceWithoutVat).trim() !== '') {
            const parsed = parseFloat(String(priceWithoutVat))
            if (!isNaN(parsed)) {
              priceWithoutVatNum = parsed
            }
          }

          // Убираем базовые поля из extra
          const extraClean: any = {}
          for (const [key, value] of Object.entries(extra)) {
            if (!['name', 'unit', 'priceWithVat', 'priceWithoutVat'].includes(key)) {
              extraClean[key] = value
            }
          }

          return {
            name: name || '',
            unit: unit || null,
            priceWithVat: priceWithVatNum,
            priceWithoutVat: priceWithoutVatNum,
            extra: Object.keys(extraClean).length > 0 ? extraClean : null,
          }
        })

        const response = await fetch(`/api/office/businesses/${businessId}/prices`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            name: 'Прайс 1',
            kind: 'BASE',
            category: category || null,
            rows: dbRows,
            columns,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to create price')
        }
      }

      // Перезагружаем список прайсов
      await loadPrices()
      setIsModalOpen(false)
      setEditingPriceId(null)
      setEditingPriceData(null)
      // Убираем action из URL, чтобы показать блок с прайсами (он скрыт при action=create-price)
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        if (url.searchParams.has('action')) {
          url.searchParams.delete('action')
          router.replace(url.pathname + (url.search || ''))
        }
      }
    } catch (error: any) {
      console.error('Failed to save price:', error)
      alert(error.message || 'Ошибка сохранения прайса')
      throw error
    }
  }

  const handleCreateDerived = async (data: { name: string; modifierType: 'markup' | 'discount'; percent: number }) => {
    try {
      const basePrice = prices.find((p) => p.kind === 'BASE')
      if (!basePrice) return

      // Загружаем данные базового прайса
      const baseResponse = await fetch(`/api/office/businesses/${businessId}/prices/${basePrice.id}`, {
        credentials: 'include',
      })

      if (!baseResponse.ok) {
        throw new Error('Failed to load base price')
      }

      const baseData = await baseResponse.json()

      // Копируем строки базового прайса
      const dbRows = baseData.rows.map((row: any) => {
        const { name, unit, priceWithVat, priceWithoutVat, extra } = row
        return {
          name: name || '',
          unit: unit || null,
          priceWithVat: priceWithVat ? parseFloat(String(priceWithVat)) : null,
          priceWithoutVat: priceWithoutVat ? parseFloat(String(priceWithoutVat)) : null,
          extra: extra || null,
        }
      })

      const extraColumns = baseData.columns && Array.isArray(baseData.columns) 
        ? baseData.columns.filter((col: Column) => !col.isBase)
        : null

      const response = await fetch(`/api/office/businesses/${businessId}/prices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: data.name,
          kind: 'DERIVED',
          derivedFromId: basePrice.id,
          modifierType: data.modifierType.toUpperCase() as 'MARKUP' | 'DISCOUNT',
          percent: data.percent,
          rows: dbRows,
          columns: extraColumns,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create derived price')
      }

      await loadPrices()
    } catch (error) {
      console.error('Failed to create derived price:', error)
      alert('Ошибка создания производного прайса')
    }
  }

  const handleEdit = async (priceId: string) => {
    setEditingPriceId(priceId)
    await loadPriceData(priceId)
    setIsViewOnlyMode(false) // Режим редактирования для своих прайсов
    setIsModalOpen(true)
    setMenuOpenPriceId(null)
  }

  const handlePriceClick = async (priceId: string) => {
    setEditingPriceId(priceId)
    await loadPriceData(priceId)
    setIsViewOnlyMode(false) // Режим редактирования для своих прайсов
    setIsModalOpen(true)
  }

  const handleAssignCounterparty = (priceId: string) => {
    setAssigningPriceId(priceId)
    setIsAssignCounterpartyModalOpen(true)
    setMenuOpenPriceId(null)
  }

  const handleCounterpartyAssign = async (residentNumber: string) => {
    if (!assigningPriceId) return

    try {
      const response = await fetch(`/api/office/businesses/${businessId}/prices/${assigningPriceId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ residentNumber }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to assign counterparty')
      }

      // Обновляем данные назначений
      if (assigningPriceId) {
        const updatedData = await getAssigningPrice(assigningPriceId)
        if (updatedData) {
          setAssigningPriceData(updatedData)
        }
      }
      await loadPrices()
      alert('Заявка отправлена. Контрагент увидит её в блоке «Запросы на подключение контрагентов» на своей странице партнёрства.')
    } catch (error: any) {
      console.error('Failed to assign counterparty:', error)
      alert(error.message || 'Ошибка назначения контрагента')
    }
  }

  const handleCounterpartyRemove = async (residentNumber: string) => {
    if (!assigningPriceId) return

    try {
      const response = await fetch(
        `/api/office/businesses/${businessId}/prices/${assigningPriceId}/assign?residentNumber=${encodeURIComponent(residentNumber)}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      )

      if (!response.ok) {
        throw new Error('Failed to remove assignment')
      }

      // Перезагружаем данные текущего прайса
      if (assigningPriceId) {
        const updatedData = await getAssigningPrice(assigningPriceId)
        if (updatedData) {
          setAssigningPriceData(updatedData)
        }
      }
      await loadPrices()
    } catch (error) {
      console.error('Failed to remove assignment:', error)
      alert('Ошибка удаления назначения')
    }
  }

  const [assigningPriceData, setAssigningPriceData] = useState<{ assignedCounterparties: string[] } | null>(null)

  const getAssigningPrice = async (priceId: string) => {
    try {
      const response = await fetch(`/api/office/businesses/${businessId}/prices/${priceId}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        return null
      }

      const data = await response.json()
      return {
        assignedCounterparties: data.assignments?.map((a: any) => a.counterpartyResidentNumber).filter(Boolean) || [],
      }
    } catch (error) {
      console.error('Failed to load assigning price:', error)
      return null
    }
  }

  useEffect(() => {
    if (isAssignCounterpartyModalOpen && assigningPriceId) {
      getAssigningPrice(assigningPriceId).then(setAssigningPriceData)
    } else {
      setAssigningPriceData(null)
    }
  }, [isAssignCounterpartyModalOpen, assigningPriceId, businessId])

  const nextPriceNumber = prices.length + 1

  const getPriceBadge = (price: Price) => {
    let modifierText = ''
    if (price.kind === 'DERIVED' && price.modifierType && price.percent !== undefined && price.percent !== null) {
      const sign = price.modifierType === 'MARKUP' ? '+' : '−'
      modifierText = ` (${sign}${price.percent}%)`
    }
    return modifierText
  }

  const renderPriceCard = (price: Price) => (
    <div key={price.id} style={{ position: 'relative' }}>
      <div
        style={{
          padding: '0.5rem 0.75rem',
          background: '#dbeafe',
          border: '1px solid #93c5fd',
          borderRadius: '4px',
          color: '#1e40af',
          fontSize: '0.8125rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          width: 'fit-content',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span onClick={() => handlePriceClick(price.id)} style={{ cursor: 'pointer' }}>
            {price.name}{getPriceBadge(price)}
          </span>
          {(price._count?.assignments || 0) > 0 && (
            <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>Контрагенты: {price._count?.assignments || 0}</span>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpenPriceId(menuOpenPriceId === price.id ? null : price.id) }}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}
        >
          <div style={{ width: 14, height: 2, background: '#1e40af' }} />
          <div style={{ width: 14, height: 2, background: '#1e40af' }} />
          <div style={{ width: 14, height: 2, background: '#1e40af' }} />
        </button>
      </div>
      {menuOpenPriceId === price.id && (
        <>
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }} onClick={() => setMenuOpenPriceId(null)} />
          <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.25rem', background: 'white', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', border: '1px solid #e5e7eb', minWidth: 150, zIndex: 999, overflow: 'hidden' }}>
            {price.kind === 'BASE' && (
              <button onClick={() => { setIsCreateDerivedModalOpen(true); setMenuOpenPriceId(null) }} style={{ width: '100%', padding: '0.75rem 1rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', color: '#111827' }}>Создать производный прайс</button>
            )}
            <button onClick={() => { setUpdatePriceId(price.id); setIsImportModalOpen(true); setMenuOpenPriceId(null) }} style={{ width: '100%', padding: '0.75rem 1rem', textAlign: 'left', background: 'none', border: 'none', borderTop: '1px solid #e5e7eb', cursor: 'pointer', fontSize: '0.875rem', color: '#111827' }}>Обновить из Excel</button>
            <button onClick={() => handleEdit(price.id)} style={{ width: '100%', padding: '0.75rem 1rem', textAlign: 'left', background: 'none', border: 'none', borderTop: '1px solid #e5e7eb', cursor: 'pointer', fontSize: '0.875rem', color: '#111827' }}>Редактировать</button>
            <button onClick={() => handleAssignCounterparty(price.id)} style={{ width: '100%', padding: '0.75rem 1rem', textAlign: 'left', background: 'none', border: 'none', borderTop: '1px solid #e5e7eb', cursor: 'pointer', fontSize: '0.875rem', color: '#111827' }}>Назначить контрагента</button>
            <button onClick={() => handleDownloadPrice(price.id, price.name)} style={{ width: '100%', padding: '0.75rem 1rem', textAlign: 'left', background: 'none', border: 'none', borderTop: '1px solid #e5e7eb', cursor: 'pointer', fontSize: '0.875rem', color: '#111827' }}>Скачать прайс</button>
            <button
              onClick={async () => {
                setMenuOpenPriceId(null)
                if (!confirm('Удалить прайс «' + price.name + '»?')) return
                try {
                  const res = await fetch(`/api/office/businesses/${businessId}/prices/${price.id}`, { method: 'DELETE', credentials: 'include' })
                  if (!res.ok) throw new Error('Не удалось удалить')
                  await loadPrices()
                } catch (e) {
                  alert('Ошибка удаления прайса')
                }
              }}
              style={{ width: '100%', padding: '0.75rem 1rem', textAlign: 'left', background: 'none', border: 'none', borderTop: '1px solid #e5e7eb', cursor: 'pointer', fontSize: '0.875rem', color: '#dc2626' }}
            >
              Удалить прайс
            </button>
          </div>
        </>
      )}
    </div>
  )

  if (loading) {
    return (
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p>Загрузка прайсов...</p>
        </div>
      </main>
    )
  }

  const hideLeftColumn =
    (initialSection && ['telegram', 'performers', 'counterparties', 'incoming'].includes(initialSection)) ||
    (initialAction && ['create-price', 'import-price'].includes(initialAction))
  const showLeftColumn = !hideLeftColumn
  const onlyCounterpartiesTable = initialSection === 'counterparties'
  const onlyIncomingTable = initialSection === 'incoming'
  const onlyPricesView = initialSection === 'prices'
  const onlyNeedsView = !initialSection && !initialAction

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      {/* При section=counterparties — только таблица контрагентов */}
      {onlyCounterpartiesTable && (
        <div style={{ width: '100%' }}>
          {loadingPartnership ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>Загрузка...</div>
          ) : activeCounterparties.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Нет действующих контрагентов</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: 500 }}>№ п/п</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: 500 }}>Юридическое название</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: 500 }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {activeCounterparties.map((counterparty, index) => (
                  <tr key={counterparty.partnerBusinessId}>
                    <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>{index + 1}</td>
                    <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>{getCounterpartyDisplayName(counterparty)}</td>
                    <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveCounterparty(counterparty.partnerBusinessId)}
                        disabled={removingCounterpartyId === counterparty.partnerBusinessId}
                        style={{
                          padding: '0.35rem 0.75rem',
                          background: '#f9fafb',
                          color: '#111827',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          cursor: removingCounterpartyId ? 'not-allowed' : 'pointer',
                          fontSize: '0.8125rem',
                        }}
                      >
                        {removingCounterpartyId === counterparty.partnerBusinessId ? 'Удаление...' : 'Удалить'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* При section=incoming — только таблица запросов (контрагенты + MAX) */}
      {onlyIncomingTable && (
        <div style={{ width: '100%' }}>
          {loadingPartnership ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>Загрузка...</div>
          ) : (() => {
            const allItems = [
              ...incomingRequests.map((r) => ({ type: 'counterparty' as const, number: null as number | null, ...r })),
              ...maxRequests.map((r) => ({ type: 'max' as const, ...r, number: r.number })),
            ].sort((a, b) => ((a.number ?? 999999999) - (b.number ?? 999999999)))
            if (allItems.length === 0) {
              return <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Нет входящих заявок</div>
            }
            return (
              <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: 500 }}>№</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: 500 }}>Название / Описание</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: 500 }}>Дата</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: 500 }}>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {allItems.map((item) => (
                    <tr key={item.type === 'counterparty' ? item.linkId : item.requestId}>
                      <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>{item.type === 'max' && item.number != null ? item.number : '—'}</td>
                      <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>
                        {item.type === 'counterparty' ? getCounterpartyDisplayName(item) : (item.title || item.description || '—')}
                      </td>
                      <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>
                        {new Date(item.createdAt).toLocaleDateString('ru-RU')}
                      </td>
                      <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>
                        {item.type === 'counterparty' ? (
                          <>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleRequestAction(item.linkId, 'accept') }}
                              style={{ padding: '0.35rem 0.75rem', marginRight: '0.5rem', background: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8125rem' }}
                            >
                              Принять
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleRequestAction(item.linkId, 'decline') }}
                              style={{ padding: '0.35rem 0.75rem', background: '#f3f4f6', color: '#111827', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8125rem' }}
                            >
                              Отклонить
                            </button>
                          </>
                        ) : (
                          <>
                            <Link
                              href={`/office/businesses/${businessId}/request/${item.requestId}`}
                              style={{ padding: '0.35rem 0.75rem', marginRight: '0.5rem', background: '#059669', color: 'white', textDecoration: 'none', borderRadius: '4px', fontSize: '0.8125rem', display: 'inline-block' }}
                            >
                              Просмотр
                            </Link>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleDeleteRequest(item.requestId) }}
                              disabled={deletingRequestId === item.requestId}
                              style={{ padding: '0.35rem 0.75rem', background: '#f3f4f6', color: '#111827', border: '1px solid #d1d5db', borderRadius: '4px', cursor: deletingRequestId === item.requestId ? 'not-allowed' : 'pointer', fontSize: '0.8125rem' }}
                            >
                              {deletingRequestId === item.requestId ? 'Удаление...' : 'Удалить'}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          })()}
        </div>
      )}

      {/* При section=prices — только мои прайсы */}
      {onlyPricesView && (
        <div style={{ width: '100%' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 600 }}>Мои прайсы</h2>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Загрузка...</div>
          ) : prices.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              Нет прайсов.{' '}
              <button type="button" onClick={() => { setEditingPriceId(null); setEditingPriceData(null); setIsModalOpen(true) }} style={{ background: 'none', border: 'none', color: '#0070f3', cursor: 'pointer', textDecoration: 'underline', fontSize: 'inherit' }}>Создать прайс</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '0.5rem' }}>
              {prices.map((price) => renderPriceCard(price))}
              <button
                type="button"
                onClick={() => { setEditingPriceId(null); setEditingPriceData(null); setIsModalOpen(true) }}
                style={{ padding: '0.5rem 0.75rem', background: '#f3f4f6', border: '1px dashed #d1d5db', borderRadius: '4px', color: '#6b7280', fontSize: '0.8125rem', cursor: 'pointer' }}
              >
                + Добавить прайс
              </button>
            </div>
          )}
        </div>
      )}

      {/* Потребности — таблица потребностей + мои прайсы */}
      {onlyNeedsView && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <h2 style={{ marginBottom: 0, fontSize: '1.25rem', fontWeight: 600 }}>Потребности</h2>
            <button
              type="button"
              onClick={() => {
                const today = new Date()
                const weekAgo = new Date(today)
                weekAgo.setDate(weekAgo.getDate() - 7)
                setPeriodDateFrom(weekAgo.toISOString().slice(0, 10))
                setPeriodDateTo(today.toISOString().slice(0, 10))
                setPeriodSummaryData(null)
                setPeriodSummaryError(null)
                setIsPeriodSummaryOpen(true)
              }}
              style={{
                padding: '0.35rem 0.75rem',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              Сводная за период
            </button>
          </div>
            {loadingPartnership ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}>Загрузка...</div>
            ) : (() => {
              const allItems = [
                ...incomingRequests.map((r) => ({ type: 'counterparty' as const, number: null as number | null, ...r })),
                ...maxRequests.map((r) => ({ type: 'max' as const, ...r, number: r.number })),
              ].sort((a, b) => ((a.number ?? 999999999) - (b.number ?? 999999999)))
              if (allItems.length === 0) {
                return <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Нет потребностей</div>
              }
              return (
                <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: 500 }}>№</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: 500 }}>Название / Описание</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: 500 }}>Дата</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: 500 }}>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allItems.map((item) => (
                      <tr key={item.type === 'counterparty' ? item.linkId : item.requestId}>
                        <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>{item.type === 'max' && item.number != null ? item.number : '—'}</td>
                        <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>
                          {businessName}
                        </td>
                        <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>
                          {new Date(item.createdAt).toLocaleDateString('ru-RU')}
                        </td>
                        <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>
                          {item.type === 'counterparty' ? (
                            <>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleRequestAction(item.linkId, 'accept') }}
                                style={{ padding: '0.35rem 0.75rem', marginRight: '0.5rem', background: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8125rem' }}
                              >
                                Принять
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleRequestAction(item.linkId, 'decline') }}
                                style={{ padding: '0.35rem 0.75rem', background: '#f3f4f6', color: '#111827', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8125rem' }}
                              >
                                Отклонить
                              </button>
                            </>
                          ) : (
                            <>
                              <Link
                                href={`/office/businesses/${businessId}/request/${item.requestId}`}
                                style={{ padding: '0.35rem 0.75rem', marginRight: '0.5rem', background: '#059669', color: 'white', textDecoration: 'none', borderRadius: '4px', fontSize: '0.8125rem', display: 'inline-block' }}
                              >
                                Просмотр
                              </Link>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleDeleteRequest(item.requestId) }}
                                disabled={deletingRequestId === item.requestId}
                                style={{ padding: '0.35rem 0.75rem', background: '#f3f4f6', color: '#111827', border: '1px solid #d1d5db', borderRadius: '4px', cursor: deletingRequestId === item.requestId ? 'not-allowed' : 'pointer', fontSize: '0.8125rem' }}
                              >
                                {deletingRequestId === item.requestId ? 'Удаление...' : 'Удалить'}
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            })()}

          {/* Мои прайсы — всегда видны на странице Потребности */}
          <div>
            <h3 style={{ marginBottom: '0.75rem', fontSize: '1.125rem', fontWeight: 600 }}>Мои прайсы</h3>
            {loading ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>Загрузка...</div>
            ) : prices.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: '#6b7280', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                Нет прайсов. <button type="button" onClick={() => { setEditingPriceId(null); setEditingPriceData(null); setIsModalOpen(true) }} style={{ background: 'none', border: 'none', color: '#0070f3', cursor: 'pointer', textDecoration: 'underline', fontSize: 'inherit' }}>Создать прайс</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '0.5rem' }}>
                {prices.map((price) => renderPriceCard(price))}
                <button
                  type="button"
                  onClick={() => { setEditingPriceId(null); setEditingPriceData(null); setIsModalOpen(true) }}
                  style={{ padding: '0.5rem 0.75rem', background: '#f3f4f6', border: '1px dashed #d1d5db', borderRadius: '4px', color: '#6b7280', fontSize: '0.8125rem', cursor: 'pointer' }}
                >
                  + Добавить прайс
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {!onlyCounterpartiesTable && !onlyIncomingTable && !onlyNeedsView && !onlyPricesView && (
      <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Левая колонка: заголовок, описание, ссылки, заголовки секций, аккордеоны */}
        {showLeftColumn && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: '200px', flex: '0 0 auto' }}>
          <h1 style={{ marginBottom: '0.25rem', fontSize: '2rem' }}>Партнёрство</h1>
          <p style={{ color: '#666', fontSize: '1rem', lineHeight: 1.6, marginBottom: '0.25rem' }}>
            Здесь настраивается сотрудничество с партнёрами: прайсы, подключения, условия.
          </p>
          <Link href={`/office/businesses/${businessId}/preview`} style={{ padding: '0.25rem 0', color: '#111827', fontSize: '1rem', fontWeight: 500, textDecoration: 'none', display: 'inline-block', width: 'fit-content' }}>
            Назад
          </Link>
          <Link
            href={`/office/businesses/${businessId}/requests`}
            style={{ padding: '0.25rem 0', background: 'none', color: '#111827', border: 'none', fontSize: '1rem', fontWeight: 500, textDecoration: 'none', display: 'inline-block', width: 'fit-content' }}
          >
            Создать заявку
          </Link>
          <Link
            href={`/office/businesses/${businessId}/prices/compare`}
            style={{ padding: '0.25rem 0', background: 'none', color: '#111827', border: 'none', fontSize: '1rem', fontWeight: 500, textDecoration: 'none', display: 'inline-block', width: 'fit-content' }}
          >
            Сводная таблица прайсов
          </Link>
          <button
            type="button"
            onClick={() => {
              setAssignPerformerOpen(true)
            }}
            style={{ padding: '0.25rem 0', background: 'none', color: '#111827', border: 'none', fontSize: '1rem', fontWeight: 500, textAlign: 'left', cursor: 'pointer', display: 'inline-block', width: 'fit-content' }}
          >
            Исполнители
          </button>

          {prices.length === 0 ? (
            <button
              type="button"
              onClick={() => {
                setEditingPriceId(null)
                setEditingPriceData(null)
                setIsViewOnlyMode(false)
                setIsModalOpen(true)
              }}
              style={{ padding: '0.25rem 0', background: 'none', color: '#111827', border: 'none', borderRadius: 0, cursor: 'pointer', fontSize: '1rem', fontWeight: 500, textAlign: 'left', display: 'inline-block', width: 'fit-content' }}
            >
              Создать прайс
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditingPriceId(null)
                setEditingPriceData(null)
                setIsModalOpen(true)
              }}
              style={{ padding: '0.25rem 0', background: 'none', color: '#111827', border: 'none', borderRadius: 0, cursor: 'pointer', fontSize: '1rem', fontWeight: 500, textAlign: 'left', display: 'inline-block', width: 'fit-content' }}
            >
              Добавить прайс
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setUpdatePriceId(null)
              setIsImportModalOpen(true)
            }}
            style={{ padding: '0.25rem 0', background: 'none', color: '#111827', border: 'none', borderRadius: 0, cursor: 'pointer', fontSize: '1rem', fontWeight: 500, textAlign: 'left', display: 'inline-block', width: 'fit-content' }}
          >
            Импорт прайса
          </button>

          {/* Действующие контрагенты */}
          <div style={{ width: '100%' }}>
            <button
              type="button"
              onClick={() => {
                const next = !activeCounterpartiesExpanded
                setActiveCounterpartiesExpanded(next)
                setIncomingRequestsExpanded(false)
                if (next) loadPartnershipData()
              }}
              style={{ padding: '0.25rem 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight: 500, color: '#111827', textAlign: 'left', display: 'inline-block', width: 'fit-content' }}
            >
              Действующие контрагенты
            </button>
            {activeCounterpartiesExpanded && (
              <div style={{ marginTop: '0.5rem', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.25rem' }}>
                  <button
                    type="button"
                    onClick={() => setActiveCounterpartiesExpanded(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, color: '#6b7280', padding: '0.25rem' }}
                    title="Закрыть"
                  >
                    ×
                  </button>
                </div>
                {loadingPartnership ? (
                  <div style={{ padding: '2rem', textAlign: 'center' }}>Загрузка...</div>
                ) : activeCounterparties.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Нет действующих контрагентов</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: 500 }}>№ п/п</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: 500 }}>Юридическое название</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: 500 }}>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeCounterparties.map((counterparty, index) => (
                        <tr key={counterparty.partnerBusinessId}>
                          <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>{index + 1}</td>
                          <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>{getCounterpartyDisplayName(counterparty)}</td>
                          <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveCounterparty(counterparty.partnerBusinessId)}
                              disabled={removingCounterpartyId === counterparty.partnerBusinessId}
                              style={{
                                padding: '0.35rem 0.75rem',
                                background: '#f9fafb',
                                color: '#111827',
                                border: '1px solid #d1d5db',
                                borderRadius: '4px',
                                cursor: removingCounterpartyId ? 'not-allowed' : 'pointer',
                                fontSize: '0.8125rem',
                              }}
                            >
                              {removingCounterpartyId === counterparty.partnerBusinessId ? 'Удаление...' : 'Удалить'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          {/* Запросы на подключение контрагентов */}
          <div style={{ width: '100%' }}>
            <button
              type="button"
              onClick={() => {
                const next = !incomingRequestsExpanded
                setIncomingRequestsExpanded(next)
                setActiveCounterpartiesExpanded(false)
                if (next) loadPartnershipData()
              }}
              style={{ padding: '0.25rem 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight: 500, color: '#111827', textAlign: 'left', display: 'inline-block', width: 'fit-content' }}
            >
              Запросы на подключение контрагентов
            </button>
            {/* Кнопка Telegram — по клику открывается панель справа */}
            <div style={{ marginTop: '0.3rem' }}>
              <button
                type="button"
                onClick={() => setTelegramPanelOpen((v) => !v)}
                style={{
                  padding: '0.25rem 0',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: 500,
                  color: '#111827',
                  textAlign: 'left',
                  display: 'inline-block',
                  width: 'fit-content',
                }}
              >
                Telegram
              </button>
            </div>
            {incomingRequestsExpanded && (
              <div style={{ marginTop: '0.5rem', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.25rem' }}>
                  <button
                    type="button"
                    onClick={() => setIncomingRequestsExpanded(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, color: '#6b7280', padding: '0.25rem' }}
                    title="Закрыть"
                  >
                    ×
                  </button>
                </div>
                {loadingPartnership ? (
                  <div style={{ padding: '2rem', textAlign: 'center' }}>Загрузка...</div>
                ) : (() => {
                  const allItems = [
                    ...incomingRequests.map((r) => ({ type: 'counterparty' as const, number: null as number | null, ...r })),
                    ...maxRequests.map((r) => ({ type: 'max' as const, ...r, number: r.number })),
                  ].sort((a, b) => ((a.number ?? 999999999) - (b.number ?? 999999999)))
                  if (allItems.length === 0) {
                    return (
                      <>
                        <div style={{ padding: '1rem 2rem 0', fontSize: '0.8125rem', color: '#6b7280' }}>
                          Сюда попадают заявки, когда кто-то назначил ваш бизнес контрагентом в своём прайсе (по вашему ИНР), а также заявки из MAX.
                        </div>
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Нет входящих заявок</div>
                      </>
                    )
                  }
                  return (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f9fafb' }}>
                          <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: 500 }}>№</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: 500 }}>Название / Описание</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: 500 }}>Дата</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: 500 }}>Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allItems.map((item) => (
                          <tr key={item.type === 'counterparty' ? item.linkId : item.requestId}>
                            <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>{item.type === 'max' && item.number != null ? item.number : '—'}</td>
                            <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>
                              {item.type === 'counterparty' ? getCounterpartyDisplayName(item) : (item.title || item.description || '—')}
                            </td>
                            <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>
                              {new Date(item.createdAt).toLocaleDateString('ru-RU')}
                            </td>
                            <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>
                              {item.type === 'counterparty' ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleRequestAction(item.linkId, 'accept') }}
                                    style={{ padding: '0.35rem 0.75rem', marginRight: '0.5rem', background: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8125rem' }}
                                  >
                                    Принять
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleRequestAction(item.linkId, 'decline') }}
                                    style={{ padding: '0.35rem 0.75rem', background: '#f3f4f6', color: '#111827', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8125rem' }}
                                  >
                                    Отклонить
                                  </button>
                                </>
                              ) : (
                                <>
                                  <Link
                                    href={`/office/businesses/${businessId}/request/${item.requestId}`}
                                    style={{ padding: '0.35rem 0.75rem', marginRight: '0.5rem', background: '#059669', color: 'white', textDecoration: 'none', borderRadius: '4px', fontSize: '0.8125rem', display: 'inline-block' }}
                                  >
                                    Просмотр
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleDeleteRequest(item.requestId) }}
                                    disabled={deletingRequestId === item.requestId}
                                    style={{ padding: '0.35rem 0.75rem', background: '#f3f4f6', color: '#111827', border: '1px solid #d1d5db', borderRadius: '4px', cursor: deletingRequestId === item.requestId ? 'not-allowed' : 'pointer', fontSize: '0.8125rem' }}
                                  >
                                    {deletingRequestId === item.requestId ? 'Удаление...' : 'Удалить'}
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                })()}
              </div>
            )}
          </div>
        </div>
        )}

        {/* Центр + правая панель Telegram */}
        <div style={{ flex: 1, minWidth: '280px', display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
          {/* Карточки назначенных прайсов и свои прайсы — скрыты при открытом «Исполнители» или section=telegram */}
          {!assignPerformerOpen && !hideLeftColumn && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-start' }}>
          {assignedPrices.length > 0 && (
            <>
            {assignedPrices.map((assigned) => (
              <div
                key={assigned.id}
                onClick={async () => {
                  // Загружаем данные прайса и открываем в режиме просмотра
                  try {
                    const response = await fetch(
                      `/api/office/businesses/${businessId}/prices/${assigned.priceListId}`,
                      {
                        credentials: 'include',
                      }
                    )

                    if (!response.ok) {
                      throw new Error('Failed to load price')
                    }

                    const data = await response.json()
                    
                    // Преобразуем rows
                    const rows: Row[] = data.rows.map((row: any) => {
                      const result: Row = {
                        name: row.name || '',
                        unit: row.unit || '',
                        priceWithVat: row.priceWithVat ? String(row.priceWithVat) : '',
                        priceWithoutVat: row.priceWithoutVat ? String(row.priceWithoutVat) : '',
                      }
                      
                      if (row.extra && typeof row.extra === 'object') {
                        Object.assign(result, row.extra)
                      }
                      
                      return result
                    })

                    const baseDefs: Column[] = [
                      { id: 'name', title: 'Наименование', kind: 'text', isBase: true },
                      { id: 'unit', title: 'Ед. изм', kind: 'text', isBase: true },
                      { id: 'priceWithVat', title: 'Цена за ед. изм. С НДС', kind: 'number', isBase: true },
                      { id: 'priceWithoutVat', title: 'Цена за ед. изм. без НДС', kind: 'number', isBase: true },
                    ]
                    let columns: Column[]
                    if (data.columns && Array.isArray(data.columns) && data.columns.length > 0) {
                      columns = data.columns.map((col: any) => ({
                        id: col.id,
                        title: col.title || col.id,
                        kind: col.kind === 'number' ? 'number' : 'text',
                        isBase: ['name', 'unit', 'priceWithVat', 'priceWithoutVat'].includes(col.id),
                      }))
                      if (!columns.some((c) => c.id === 'name')) columns.unshift(baseDefs[0])
                      if (!columns.some((c) => c.id === 'unit')) columns.splice(1, 0, baseDefs[1])
                    } else {
                      const hasAnyPriceWithoutVat = data.rows?.some((r: any) => r.priceWithoutVat != null)
                      columns = hasAnyPriceWithoutVat ? [...baseDefs] : baseDefs.filter((c) => c.id !== 'priceWithoutVat')
                    }

                    setEditingPriceData({ rows, columns, category: data.category })
                    setEditingPriceId(assigned.priceListId)
                    setIsViewOnlyMode(true) // Режим только просмотра для назначенных прайсов
                    setIsModalOpen(true)
                  } catch (error) {
                    console.error('Failed to load assigned price:', error)
                    alert('Ошибка загрузки прайса')
                  }
                }}
                style={{
                  padding: '1rem',
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  width: 'fit-content',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s, border-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6'
                  e.currentTarget.style.borderColor = '#d1d5db'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f9fafb'
                  e.currentTarget.style.borderColor = '#e5e7eb'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '0.35rem', fontSize: '1rem' }}>
                    Прайс
                    {assigned.priceModifierType && assigned.pricePercent !== null && (
                      <span style={{ color: '#6b7280', fontWeight: 500 }}>
                        {' '}
                        ({assigned.priceModifierType === 'MARKUP' ? '+' : '−'}
                        {assigned.pricePercent}%)
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.9375rem', marginBottom: '0.2rem', color: '#111827' }}>
                    {assigned.priceCategory?.trim() || 'Свежая плодоовощная продукция'}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                    {(() => {
                      const legalName = assigned.sourceBusinessLegalName?.trim() || null
                      if (legalName) return legalName
                      if (assigned.sourceBusinessName) return assigned.sourceBusinessName
                      if (assigned.sourceBusinessSlug) return assigned.sourceBusinessSlug
                      if (assigned.sourceBusinessResidentNumber) return assigned.sourceBusinessResidentNumber
                      return assigned.sourceBusinessId
                    })()}
                  </div>
                </div>
              </div>
            ))}
            </>
          )}
      <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '0.5rem' }}>
        {prices.map((price) => (
          <div key={price.id} style={{ position: 'relative' }}>
            <div
              style={{
                padding: '0.5rem 0.75rem',
                background: '#dbeafe',
                border: '1px solid #93c5fd',
                borderRadius: '4px',
                color: '#1e40af',
                fontSize: '0.8125rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                width: 'fit-content',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span
                  onClick={() => handlePriceClick(price.id)}
                  style={{
                    cursor: 'pointer',
                  }}
                >
                  {price.name}
                  {getPriceBadge(price)}
                </span>
                {(price._count?.assignments || 0) > 0 && (
                  <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>
                    Контрагенты: {price._count?.assignments || 0}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setMenuOpenPriceId(menuOpenPriceId === price.id ? null : price.id)
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '0',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    width: '14px',
                    height: '2px',
                    background: '#1e40af',
                  }}
                />
                <div
                  style={{
                    width: '14px',
                    height: '2px',
                    background: '#1e40af',
                  }}
                />
                <div
                  style={{
                    width: '14px',
                    height: '2px',
                    background: '#1e40af',
                  }}
                />
              </button>
            </div>

            {/* Меню гамбургера */}
            {menuOpenPriceId === price.id && (
              <>
                <div
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 998,
                  }}
                  onClick={() => setMenuOpenPriceId(null)}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '0.25rem',
                    background: 'white',
                    borderRadius: '6px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    border: '1px solid #e5e7eb',
                    minWidth: '150px',
                    zIndex: 999,
                    overflow: 'hidden',
                  }}
                >
                  {price.kind === 'BASE' && (
                    <button
                      onClick={() => {
                        setIsCreateDerivedModalOpen(true)
                        setMenuOpenPriceId(null)
                      }}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        textAlign: 'left',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        color: '#111827',
                        transition: 'background-color 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f9fafb'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }}
                    >
                      Создать производный прайс
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setUpdatePriceId(price.id)
                      setIsImportModalOpen(true)
                      setMenuOpenPriceId(null)
                    }}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      borderTop: '1px solid #e5e7eb',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      color: '#111827',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f9fafb'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    Обновить из Excel
                  </button>
                  <button
                    onClick={() => handleEdit(price.id)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      borderTop: '1px solid #e5e7eb',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      color: '#111827',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f9fafb'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    Редактировать
                  </button>
                  <button
                    onClick={() => handleAssignCounterparty(price.id)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      borderTop: '1px solid #e5e7eb',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      color: '#111827',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f9fafb'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    Назначить контрагента
                  </button>
                  <button
                    onClick={() => handleDownloadPrice(price.id, price.name)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      borderTop: '1px solid #e5e7eb',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      color: '#111827',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f9fafb'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    Скачать прайс
                  </button>
                  <button
                    onClick={async () => {
                      setMenuOpenPriceId(null)
                      if (!confirm('Удалить прайс «' + price.name + '»?')) return
                      try {
                        const res = await fetch(`/api/office/businesses/${businessId}/prices/${price.id}`, {
                          method: 'DELETE',
                          credentials: 'include',
                        })
                        if (!res.ok) throw new Error('Не удалось удалить')
                        await loadPrices()
                      } catch (e) {
                        alert('Ошибка удаления прайса')
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      borderTop: '1px solid #e5e7eb',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      color: '#dc2626',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#fef2f2'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    Удалить прайс
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
          </div>
          )}

          {/* Панель Telegram справа */}
          {telegramPanelOpen && (
            <div
              style={{
                width: '320px',
                flexShrink: 0,
                padding: '1rem',
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '1rem', fontWeight: 600, color: '#111827' }}>Telegram</span>
                <button
                  type="button"
                  onClick={() => setTelegramPanelOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, color: '#6b7280', padding: '0.25rem' }}
                  title="Закрыть"
                >
                  ×
                </button>
              </div>

              <div style={{ marginBottom: '0.75rem', fontSize: '0.875rem' }}>
                {telegramChatId ? (
                  <span style={{ color: '#374151' }}>✅ Telegram подключен</span>
                ) : (
                  <span style={{ color: '#6b7280' }}>⚪ Telegram не подключен</span>
                )}
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.35rem', color: '#374151' }}>Получатели заявок</div>
                {telegramRecipients.length === 0 ? (
                  <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>Нет получателей. Добавьте через кнопку ниже.</div>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {telegramRecipients.map((r) => (
                      <li key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0', fontSize: '0.8125rem', borderBottom: '1px solid #e5e7eb' }}>
                        <input type="checkbox" checked={r.isActive} onChange={(e) => toggleRecipientActive(r.id, e.target.checked)} style={{ cursor: 'pointer' }} />
                        <span style={{ flex: 1 }}>
                          {r.label?.trim() || r.chatIdMasked}
                          {r.label?.trim() && <span style={{ color: '#6b7280', marginLeft: '0.25rem' }}>({r.chatIdMasked})</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.35rem', color: '#374151' }}>Добавить получателя</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Метка (необязательно), напр. Мария (склад)"
                    value={addRecipientLabel}
                    onChange={(e) => setAddRecipientLabel(e.target.value)}
                    style={{ padding: '0.4rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #d1d5db', borderRadius: '4px', maxWidth: '100%' }}
                  />
                  <button
                    type="button"
                    onClick={connectAddRecipient}
                    disabled={addRecipientLoading}
                    style={{
                      padding: '0.5rem 1rem',
                      background: 'white',
                      color: '#111827',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      cursor: addRecipientLoading ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      alignSelf: 'flex-start',
                    }}
                  >
                    {addRecipientLoading ? 'Генерация...' : 'Сгенерировать ссылку'}
                  </button>
                  {addRecipientBotUrl && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <button type="button" onClick={copyAddRecipientLink} style={{ padding: '0.4rem 0.75rem', background: 'white', color: '#111827', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8125rem', alignSelf: 'flex-start' }}>
                        Скопировать ссылку
                      </button>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <a href={addRecipientBotUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8125rem', color: '#111827', textDecoration: 'underline' }}>
                          Открыть Telegram
                        </a>
                        <a href={getAddRecipientAppUrl()} style={{ fontSize: '0.8125rem', color: '#111827', textDecoration: 'underline' }}>
                          В приложении
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={() => { router.refresh(); setAddRecipientBotUrl(''); setAddRecipientToken('') }}
                        style={{ padding: '0.4rem 0.75rem', background: 'white', color: '#111827', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8125rem', alignSelf: 'flex-start' }}
                      >
                        Обновить список
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {!telegramChatId && (
                <button
                  type="button"
                  onClick={connectTelegram}
                  disabled={telegramLoading}
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'white',
                    color: '#111827',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    cursor: telegramLoading ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    marginBottom: botStartUrl ? '0.5rem' : '0',
                  }}
                >
                  {telegramLoading ? 'Подключение...' : 'Подключить Telegram'}
                </button>
              )}

              {botStartUrl && connectToken && (
                <div style={{ marginBottom: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <a href={botStartUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', padding: '0.5rem 1rem', background: 'white', color: '#111827', textDecoration: 'none', borderRadius: '4px', fontSize: '0.875rem', fontWeight: 500, border: '1px solid #d1d5db', textAlign: 'center' }}>
                    Открыть Telegram
                  </a>
                  <a href={getBotStartAppUrl()} style={{ display: 'inline-block', padding: '0.5rem 1rem', background: 'white', color: '#111827', textDecoration: 'none', borderRadius: '4px', fontSize: '0.875rem', fontWeight: 500, border: '1px solid #d1d5db', textAlign: 'center' }}>
                    Открыть в приложении
                  </a>
                </div>
              )}

              {botStartUrl && !telegramChatId && (
                <button type="button" onClick={refreshTelegramStatus} style={{ padding: '0.5rem 1rem', background: 'white', color: '#111827', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}>
                  Проверить статус
                </button>
              )}

              {telegramError && (
                <div style={{ marginTop: '0.5rem', color: '#dc2626', fontSize: '0.875rem' }}>{telegramError}</div>
              )}
            </div>
          )}

          {/* Drawer «Назначить исполнителя»: выбор заявки, должность, ссылка */}
          {assignPerformerOpen && (
            <div
              style={{
                width: '320px',
                flexShrink: 0,
                padding: '1.25rem',
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#111827' }}>Назначить исполнителя</h2>
                <button
                  type="button"
                  onClick={() => { setAssignPerformerOpen(false); setAssignInvite(null); setAssignError(null) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#6b7280' }}
                >
                  ×
                </button>
              </div>

              {assignLoading ? (
                <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Загрузка...</p>
              ) : (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#374151', marginBottom: '0.35rem' }}>Должность</label>
                    <select
                      value={assignRole}
                      onChange={(e) => {
                        const v = e.target.value as 'PICKER' | 'RECEIVER' | ''
                        if (v === 'PICKER' || v === 'RECEIVER') {
                          handleAssignRoleChange(v)
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        fontSize: '0.875rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        background: 'white',
                      }}
                    >
                      <option value="">Выберите должность</option>
                      <option value="PICKER">Сборщик</option>
                      <option value="RECEIVER">Приёмщик</option>
                    </select>
                  </div>

                  {assignGenerateLoading && !assignInvite && (
                    <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Генерация ссылки...</p>
                  )}

                  {assignInvite && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <p style={{ fontSize: '0.875rem', marginBottom: '0.35rem' }}>
                        <strong>Исполнитель:</strong> {assignInvite.label}
                      </p>
                      <input
                        type="text"
                        readOnly
                        value={assignInvite.url}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          fontSize: '0.8125rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          background: '#fff',
                          marginBottom: '0.5rem',
                        }}
                      />
                      <button
                        type="button"
                        onClick={copyAssignLink}
                        style={{
                          padding: '0.5rem 1rem',
                          background: 'white',
                          color: '#111827',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                        }}
                      >
                        Копировать
                      </button>
                      <button
                        type="button"
                        onClick={handleAssignDelete}
                        style={{
                          marginLeft: '0.5rem',
                          padding: '0.5rem 1rem',
                          background: 'white',
                          color: '#111827',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                        }}
                      >
                        Удалить
                      </button>
                      <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#6b7280' }}>
                        {assignInvite.role === 'RECEIVER'
                          ? 'Ссылка даёт доступ к активации страницы приёмщика.'
                          : 'Ссылка даёт доступ к активации страницы сборщика по этой заявке.'}
                      </p>
                    </div>
                  )}
                  {assignError && <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#dc2626' }}>{assignError}</p>}
                </>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      <PriceUploadModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingPriceId(null)
          setEditingPriceData(null)
          setIsViewOnlyMode(false)
        }}
        onSave={handleSave}
        initialRows={editingPriceData?.rows}
        initialColumns={editingPriceData?.columns}
        initialCategory={editingPriceData?.category}
        readOnly={isViewOnlyMode}
        businessId={businessId}
      />

      <PriceImportModal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false)
          setUpdatePriceId(null)
        }}
        onSuccess={async () => {
          await loadPrices()
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href)
            if (url.searchParams.has('action')) {
              url.searchParams.delete('action')
              router.replace(url.pathname + (url.search || ''))
            }
          }
        }}
        businessId={businessId}
        updatePriceId={updatePriceId}
      />

      <CreateDerivedPriceModal
        isOpen={isCreateDerivedModalOpen}
        onClose={() => setIsCreateDerivedModalOpen(false)}
        onCreate={handleCreateDerived}
        nextPriceNumber={nextPriceNumber}
      />

      <AssignCounterpartyModal
        isOpen={isAssignCounterpartyModalOpen}
        onClose={() => {
          setIsAssignCounterpartyModalOpen(false)
          setAssigningPriceId(null)
          setAssigningPriceData(null)
        }}
        assignedCounterparties={assigningPriceData?.assignedCounterparties || []}
        onAssign={handleCounterpartyAssign}
        onRemove={handleCounterpartyRemove}
      />

      {/* Модалка «Сводная за период» */}
      {isPeriodSummaryOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.4)',
          }}
          onClick={() => setIsPeriodSummaryOpen(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              maxWidth: '95vw',
              maxHeight: '90vh',
              overflow: 'auto',
              padding: '1.5rem',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: 600 }}>Сводная за период</h3>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', minWidth: '4rem' }}>С:</span>
                <input
                  type="date"
                  value={periodDateFrom}
                  onChange={(e) => setPeriodDateFrom(e.target.value)}
                  style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', minWidth: '4rem' }}>По:</span>
                <input
                  type="date"
                  value={periodDateTo}
                  onChange={(e) => setPeriodDateTo(e.target.value)}
                  style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }}
                />
              </label>
              <button
                type="button"
                onClick={async () => {
                  if (!periodDateFrom || !periodDateTo) {
                    setPeriodSummaryError('Укажите даты')
                    return
                  }
                  setPeriodSummaryError(null)
                  setPeriodSummaryLoading(true)
                  try {
                    const res = await fetch(
                      `/api/office/businesses/${businessId}/partnership/period-summary?dateFrom=${periodDateFrom}&dateTo=${periodDateTo}`,
                      { credentials: 'include' }
                    )
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error || 'Ошибка загрузки')
                    setPeriodSummaryData(data)
                  } catch (e) {
                    setPeriodSummaryError(e instanceof Error ? e.message : 'Ошибка')
                  } finally {
                    setPeriodSummaryLoading(false)
                  }
                }}
                disabled={periodSummaryLoading}
                style={{
                  padding: '0.5rem 1rem',
                  background: periodSummaryLoading ? '#9ca3af' : '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: periodSummaryLoading ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                {periodSummaryLoading ? 'Загрузка...' : 'Показать'}
              </button>
              {periodSummaryData && periodSummaryData.items.length > 0 && (
                <button
                  type="button"
                  onClick={() => downloadPeriodSummaryAsExcel(periodSummaryData, periodDateFrom, periodDateTo)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#059669',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  Скачать (Excel)
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsPeriodSummaryOpen(false)}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#f3f4f6',
                  color: '#111827',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Закрыть
              </button>
            </div>
            {periodSummaryError && (
              <p style={{ margin: '0 0 1rem 0', color: '#dc2626', fontSize: '0.875rem' }}>{periodSummaryError}</p>
            )}
            {periodSummaryData && (
              <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #e5e7eb', fontWeight: 500 }}>№</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: 500 }}>Наименование</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #e5e7eb', fontWeight: 500 }}>Кол-во</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: 500 }}>Ед.</th>
                      {periodSummaryData.counterparties.map((c) => (
                        <th key={c.id} style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #e5e7eb', fontWeight: 500 }}>{c.legalName}</th>
                      ))}
                      <th style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #e5e7eb', fontWeight: 500 }}>Итоговая сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodSummaryData.items.map((r, idx) => {
                      const prices = periodSummaryData.counterparties.map((c) => r.offers[c.id] ?? null)
                      const minPrice = prices.filter((p): p is number => p != null)
                      const rowMin = minPrice.length > 0 ? Math.min(...minPrice) : null
                      const qty = parseFloat(r.quantity) || 0
                      const rowSum = rowMin != null ? rowMin * qty : null
                      return (
                        <tr key={idx}>
                          <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'center' }}>{idx + 1}</td>
                          <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>{r.name}</td>
                          <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'center' }}>{r.quantity}</td>
                          <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>{r.unit}</td>
                          {periodSummaryData.counterparties.map((c) => {
                            const p = r.offers[c.id] ?? null
                            const isMin = p != null && rowMin != null && p === rowMin
                            return (
                              <td
                                key={c.id}
                                style={{
                                  padding: '0.75rem',
                                  border: '1px solid #e5e7eb',
                                  textAlign: 'right',
                                  backgroundColor: isMin ? '#dcfce7' : 'white',
                                }}
                              >
                                {p != null ? p.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '—'}
                              </td>
                            )
                          })}
                          <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right', fontWeight: (rowSum ?? 0) > 0 ? 600 : 400 }}>
                            {rowSum != null ? rowSum.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    {(() => {
                      const totalSum = periodSummaryData.items.reduce((a, r) => {
                        const prices = periodSummaryData.counterparties.map((c) => r.offers[c.id] ?? null)
                        const minP = prices.filter((x): x is number => x != null)
                        const rowMin = minP.length > 0 ? Math.min(...minP) : null
                        const qty = parseFloat(r.quantity) || 0
                        return a + (rowMin != null ? rowMin * qty : 0)
                      }, 0)
                      const sumByCounterparty = periodSummaryData.counterparties.map((c) =>
                        periodSummaryData.items.reduce((a, r) => {
                          const p = r.offers[c.id] ?? null
                          const prices = periodSummaryData.counterparties.map((cc) => r.offers[cc.id] ?? null)
                          const minP = prices.filter((x): x is number => x != null)
                          const rowMin = minP.length > 0 ? Math.min(...minP) : null
                          const qty = parseFloat(r.quantity) || 0
                          if (rowMin != null && p != null && p === rowMin) return a + p * qty
                          return a
                        }, 0)
                      )
                      const fullOrderByCounterparty = periodSummaryData.counterparties.map((c) =>
                        periodSummaryData.items.reduce((a, r) => {
                          let p = r.offers[c.id] ?? null
                          if (p == null) {
                            const others = periodSummaryData.counterparties.filter((cc) => cc.id !== c.id)
                            let minOther: number | null = null
                            others.forEach((o) => {
                              const op = r.offers[o.id] ?? null
                              if (op != null && (minOther == null || op < minOther)) minOther = op
                            })
                            p = minOther ?? 0
                          }
                          const qty = parseFloat(r.quantity) || 0
                          return a + p * qty
                        }, 0)
                      )
                      const fmt = (n: number) => n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
                      return (
                        <>
                          <tr style={{ background: '#f3f4f6', fontWeight: 600 }}>
                            <td colSpan={4} style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>Итого (по выбранным позициям)</td>
                            {sumByCounterparty.map((sum, i) => (
                              <td key={periodSummaryData.counterparties[i].id} style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>
                                {sum > 0 ? fmt(sum) : '—'}
                              </td>
                            ))}
                            <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>{fmt(totalSum)}</td>
                          </tr>
                          <tr style={{ background: '#f9fafb', fontWeight: 500 }}>
                            <td colSpan={4} style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>Сумма заказа у поставщика</td>
                            {fullOrderByCounterparty.map((sum, i) => (
                              <td key={periodSummaryData.counterparties[i].id} style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>
                                {sum > 0 ? fmt(sum) : '—'}
                              </td>
                            ))}
                            <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>—</td>
                          </tr>
                          <tr style={{ background: '#f9fafb', fontWeight: 500 }}>
                            <td colSpan={4} style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>Экономия</td>
                            {fullOrderByCounterparty.map((sum, i) => {
                              const saving = totalSum - sum
                              const color = saving > 0 ? '#15803d' : saving < 0 ? '#dc2626' : '#6b7280'
                              return (
                                <td key={periodSummaryData.counterparties[i].id} style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right', color, fontWeight: 600 }}>
                                  {saving !== 0 ? (saving > 0 ? `+${fmt(saving)}` : `-${fmt(Math.abs(saving))}`) : '0'}
                                </td>
                              )
                            })}
                            <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>—</td>
                          </tr>
                        </>
                      )
                    })()}
                  </tfoot>
                </table>
              </div>
            )}
            {periodSummaryData?.items?.length === 0 && !periodSummaryLoading && (
              <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Нет потребностей за выбранный период</p>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
