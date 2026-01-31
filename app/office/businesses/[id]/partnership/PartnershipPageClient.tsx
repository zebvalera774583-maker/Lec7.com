'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import PriceUploadModal from './PriceUploadModal'
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

interface PartnershipPageClientProps {
  businessId: string
}

interface AssignedPrice {
  id: string
  priceListId: string
  priceName: string
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

export default function PartnershipPageClient({ businessId }: PartnershipPageClientProps) {
  const [prices, setPrices] = useState<Price[]>([])
  const [assignedPrices, setAssignedPrices] = useState<AssignedPrice[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCreateDerivedModalOpen, setIsCreateDerivedModalOpen] = useState(false)
  const [isAssignCounterpartyModalOpen, setIsAssignCounterpartyModalOpen] = useState(false)
  const [assigningPriceId, setAssigningPriceId] = useState<string | null>(null)
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null)
  const [editingPriceData, setEditingPriceData] = useState<{ rows: Row[]; columns: Column[] } | null>(null)
  const [isViewOnlyMode, setIsViewOnlyMode] = useState(false)
  const [menuOpenPriceId, setMenuOpenPriceId] = useState<string | null>(null)
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false)
  const [activeCounterparties, setActiveCounterparties] = useState<ActiveCounterparty[]>([])
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([])
  const [activeCounterpartiesExpanded, setActiveCounterpartiesExpanded] = useState(false)
  const [incomingRequestsExpanded, setIncomingRequestsExpanded] = useState(false)
  const [loadingPartnership, setLoadingPartnership] = useState(false)

  // Скачать прайс в CSV
  const downloadPriceAsCsv = (rows: Row[], columns: Column[], filename: string) => {
    const headers = columns.map((c) => c.title)
    const escape = (v: string) => {
      const s = String(v ?? '')
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }
    const lines = [headers.map(escape).join(';')]
    rows.forEach((row) => {
      const values = columns.map((col) => escape(row[col.id] ?? ''))
      lines.push(values.join(';'))
    })
    const csv = '\uFEFF' + lines.join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename.replace(/[^\w\s-]/g, '')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadPrice = async (priceId: string, priceName: string) => {
    setMenuOpenPriceId(null)
    setDownloadMenuOpen(false)
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
      let columns: Column[] = [
        { id: 'name', title: 'Наименование', kind: 'text', isBase: true },
        { id: 'unit', title: 'Ед. изм', kind: 'text', isBase: true },
        { id: 'priceWithVat', title: 'Цена за ед. изм. С НДС', kind: 'number', isBase: true },
        { id: 'priceWithoutVat', title: 'Цена за ед. изм. без НДС', kind: 'number', isBase: true },
      ]
      if (data.columns && Array.isArray(data.columns)) {
        const extra = data.columns.filter((c: Column) => !c.isBase)
        columns = [...columns, ...extra]
      }
      downloadPriceAsCsv(rows, columns, priceName)
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
    } catch (error) {
      console.error('Failed to load partnership data:', error)
    } finally {
      setLoadingPartnership(false)
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

  useEffect(() => {
    loadPrices()
    loadAssignedPrices()
    loadPartnershipData()
  }, [businessId])

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

      // Восстанавливаем структуру колонок: сохраняем полный список (в т.ч. удалённые «с НДС»/«без НДС»)
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
        // Гарантируем наличие обязательных колонок (их нельзя удалить)
        if (!columns.some((c) => c.id === 'name')) columns.unshift(BASE_COLUMN_DEFS[0])
        if (!columns.some((c) => c.id === 'unit')) columns.splice(1, 0, BASE_COLUMN_DEFS[1])
      } else {
        columns = [...BASE_COLUMN_DEFS]
      }

      setEditingPriceData({ rows, columns })
    } catch (error) {
      console.error('Failed to load price data:', error)
    }
  }

  const handleSave = async (rows: Row[], columns: Column[]) => {
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
    } catch (error: any) {
      console.error('Failed to save price:', error)
      alert(error.message || 'Ошибка сохранения прайса')
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

  if (loading) {
    return (
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p>Загрузка прайсов...</p>
        </div>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link href={`/office/businesses/${businessId}`} style={{ color: '#666', textDecoration: 'underline' }}>
          ← Назад к бизнесу
        </Link>
      </div>

      <h1 style={{ marginBottom: '1rem', fontSize: '2rem' }}>Партнёрство</h1>
      <p style={{ color: '#666', fontSize: '1rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
        Здесь настраивается сотрудничество с партнёрами: прайсы, подключения, условия.
      </p>

      {/* Кнопки: загрузка / скачать и добавить прайс */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        {prices.length === 0 ? (
          <button
            onClick={() => {
              setEditingPriceId(null)
              setEditingPriceData(null)
              setIsViewOnlyMode(false)
              setIsModalOpen(true)
            }}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 500,
            }}
          >
            Создать прайс
          </button>
        ) : (
          <>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => {
                  if (prices.length === 1) {
                    handleDownloadPrice(prices[0].id, prices[0].name)
                  } else {
                    setDownloadMenuOpen((v) => !v)
                  }
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: 500,
                }}
              >
                Скачать прайс{prices.length > 1 ? ' ▾' : ''}
              </button>
              {prices.length > 1 && downloadMenuOpen && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 998 }}
                    onClick={() => setDownloadMenuOpen(false)}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      marginTop: '0.25rem',
                      background: 'white',
                      borderRadius: '6px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      border: '1px solid #e5e7eb',
                      minWidth: '200px',
                      zIndex: 999,
                      overflow: 'hidden',
                    }}
                  >
                    {prices.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleDownloadPrice(p.id, p.name)}
                        style={{
                          width: '100%',
                          padding: '0.75rem 1rem',
                          textAlign: 'left',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          color: '#111827',
                        }}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => {
                setEditingPriceId(null)
                setEditingPriceData(null)
                setIsModalOpen(true)
              }}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#0070f3',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 500,
              }}
            >
              Добавить прайс
            </button>
          </>
        )}
      </div>

      {/* Блок "Назначенные вам прайсы" */}
      {assignedPrices.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Назначенные вам прайсы</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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

                    // Восстанавливаем колонки (полный список из БД)
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

                    setEditingPriceData({ rows, columns })
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
                  <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
                    {assigned.priceName}
                    {assigned.priceModifierType && assigned.pricePercent !== null && (
                      <span style={{ color: '#6b7280', fontWeight: 'normal' }}>
                        {' '}
                        ({assigned.priceModifierType === 'MARKUP' ? '+' : '−'}
                        {assigned.pricePercent}%)
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    От:{' '}
                    {(() => {
                      // Защита от пустых legalName (только пробелы)
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
          </div>
        </div>
      )}

      {/* Действующие контрагенты */}
      <div style={{ marginBottom: '2rem' }}>
        <button
          onClick={() => {
            const next = !activeCounterpartiesExpanded
            setActiveCounterpartiesExpanded(next)
            if (next) loadPartnershipData()
          }}
          style={{
            width: '100%',
            padding: '1rem',
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '1.125rem',
            fontWeight: 500,
          }}
        >
          <span>Действующие контрагенты</span>
          <span>{activeCounterpartiesExpanded ? '▼' : '▶'}</span>
        </button>
        {activeCounterpartiesExpanded && (
          <div style={{ marginTop: '0.5rem', background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
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
                  </tr>
                </thead>
                <tbody>
                  {activeCounterparties.map((counterparty, index) => (
                    <tr key={counterparty.partnerBusinessId}>
                      <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>{index + 1}</td>
                      <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>{getCounterpartyDisplayName(counterparty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Запросы на подключение контрагентов */}
      <div style={{ marginBottom: '2rem' }}>
        <button
          onClick={() => {
            const next = !incomingRequestsExpanded
            setIncomingRequestsExpanded(next)
            if (next) loadPartnershipData() // Перезагружаем при раскрытии, чтобы видеть новые заявки
          }}
          style={{
            width: '100%',
            padding: '1rem',
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '1.125rem',
            fontWeight: 500,
          }}
        >
          <span>Запросы на подключение контрагентов</span>
          <span>{incomingRequestsExpanded ? '▼' : '▶'}</span>
        </button>
        {incomingRequestsExpanded && (
          <div style={{ marginTop: '0.5rem', background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
            {loadingPartnership ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}>Загрузка...</div>
            ) : incomingRequests.length === 0 ? (
              <>
                <div style={{ padding: '1rem 2rem 0', fontSize: '0.8125rem', color: '#6b7280' }}>
                  Сюда попадают заявки, когда кто-то назначил ваш бизнес контрагентом в своём прайсе (по вашему ИНР).
                </div>
                <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Нет входящих заявок</div>
              </>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: 500 }}>№ п/п</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: 500 }}>Юридическое название</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: 500 }}>Дата</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: 500 }}>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {incomingRequests.map((request, index) => (
                    <tr key={request.linkId}>
                      <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>{index + 1}</td>
                      <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>{getCounterpartyDisplayName(request)}</td>
                      <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>
                        {new Date(request.createdAt).toLocaleDateString('ru-RU')}
                      </td>
                      <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => handleRequestAction(request.linkId, 'accept')}
                            style={{
                              padding: '0.5rem 1rem',
                              background: '#059669',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                            }}
                          >
                            Принять
                          </button>
                          <button
                            onClick={() => handleRequestAction(request.linkId, 'decline')}
                            style={{
                              padding: '0.5rem 1rem',
                              background: '#dc2626',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                            }}
                          >
                            Отклонить
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Список прайсов */}
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
                </div>
              </>
            )}
          </div>
        ))}
      </div>

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
        readOnly={isViewOnlyMode}
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
    </main>
  )
}
