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
  sourceBusinessDisplayName: string | null
  sourceBusinessResidentNumber: string | null
  assignedAt: string
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
  const [menuOpenPriceId, setMenuOpenPriceId] = useState<string | null>(null)

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

  useEffect(() => {
    loadPrices()
    loadAssignedPrices()
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

      // Восстанавливаем структуру колонок
      let columns: Column[] = [
        { id: 'name', title: 'Наименование', kind: 'text', isBase: true },
        { id: 'unit', title: 'Ед. изм', kind: 'text', isBase: true },
        { id: 'priceWithVat', title: 'Цена за ед. изм. С НДС', kind: 'number', isBase: true },
        { id: 'priceWithoutVat', title: 'Цена за ед. изм. без НДС', kind: 'number', isBase: true },
      ]

      if (data.columns && typeof data.columns === 'object' && Array.isArray(data.columns)) {
        const extraColumns = data.columns.filter((col: Column) => !col.isBase)
        columns = [...columns, ...extraColumns]
      }

      setEditingPriceData({ rows, columns })
    } catch (error) {
      console.error('Failed to load price data:', error)
    }
  }

  const handleSave = async (rows: Row[], columns: Column[]) => {
    try {
      if (editingPriceId) {
        // Редактирование существующего прайса
        // Преобразуем rows в формат БД
        const dbRows = rows.map((row, index) => {
          const { name, unit, priceWithVat, priceWithoutVat, ...extra } = row
          return {
            name: name || '',
            unit: unit || null,
            priceWithVat: priceWithVat ? parseFloat(priceWithVat) : null,
            priceWithoutVat: priceWithoutVat ? parseFloat(priceWithoutVat) : null,
            extra: Object.keys(extra).length > 0 ? extra : null,
          }
        })

        // Сохраняем только добавленные колонки (не базовые)
        const extraColumns = columns.filter((col) => !col.isBase)

        const response = await fetch(`/api/office/businesses/${businessId}/prices/${editingPriceId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            rows: dbRows,
            columns: extraColumns.length > 0 ? extraColumns : null,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to save price')
        }
      } else {
        // Создание нового базового прайса
        const dbRows = rows.map((row, index) => {
          const { name, unit, priceWithVat, priceWithoutVat, ...extra } = row
          return {
            name: name || '',
            unit: unit || null,
            priceWithVat: priceWithVat ? parseFloat(priceWithVat) : null,
            priceWithoutVat: priceWithoutVat ? parseFloat(priceWithoutVat) : null,
            extra: Object.keys(extra).length > 0 ? extra : null,
          }
        })

        const extraColumns = columns.filter((col) => !col.isBase)

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
            columns: extraColumns.length > 0 ? extraColumns : null,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to create price')
        }
      }

      // Перезагружаем список прайсов
      await loadPrices()
      setIsModalOpen(false)
      setEditingPriceId(null)
      setEditingPriceData(null)
    } catch (error) {
      console.error('Failed to save price:', error)
      alert('Ошибка сохранения прайса')
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
    setIsModalOpen(true)
    setMenuOpenPriceId(null)
  }

  const handlePriceClick = async (priceId: string) => {
    setEditingPriceId(priceId)
    await loadPriceData(priceId)
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
      const updatedData = await getAssigningPrice()
      if (updatedData) {
        setAssigningPriceData(updatedData)
      }
      await loadPrices()
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
      const updatedData = await getAssigningPrice()
      if (updatedData) {
        setAssigningPriceData(updatedData)
      }
      await loadPrices()
    } catch (error) {
      console.error('Failed to remove assignment:', error)
      alert('Ошибка удаления назначения')
    }
  }

  const getAssigningPrice = async () => {
    if (!assigningPriceId) return null

    try {
      const response = await fetch(`/api/office/businesses/${businessId}/prices/${assigningPriceId}`, {
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

  const [assigningPriceData, setAssigningPriceData] = useState<{ assignedCounterparties: string[] } | null>(null)

  useEffect(() => {
    if (isAssignCounterpartyModalOpen && assigningPriceId) {
      getAssigningPrice().then(setAssigningPriceData)
    } else {
      setAssigningPriceData(null)
    }
  }, [isAssignCounterpartyModalOpen, assigningPriceId])

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

      {/* Кнопка загрузки прайса */}
      {prices.length === 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
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
            Загрузить прайс
          </button>
        </div>
      )}

      {/* Блок "Назначенные вам прайсы" */}
      {assignedPrices.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Назначенные вам прайсы</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {assignedPrices.map((assigned) => (
              <div
                key={assigned.id}
                style={{
                  padding: '1rem',
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
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
                    {assigned.sourceBusinessDisplayName ||
                      assigned.sourceBusinessResidentNumber ||
                      assigned.sourceBusinessId}
                  </div>
                </div>
                <button
                  onClick={async () => {
                    // Загружаем данные прайса и открываем в режиме просмотра
                    try {
                      const response = await fetch(
                        `/api/office/businesses/${assigned.sourceBusinessId}/prices/${assigned.priceListId}`,
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

                      // Восстанавливаем колонки
                      let columns: Column[] = [
                        { id: 'name', title: 'Наименование', kind: 'text', isBase: true },
                        { id: 'unit', title: 'Ед. изм', kind: 'text', isBase: true },
                        { id: 'priceWithVat', title: 'Цена за ед. изм. С НДС', kind: 'number', isBase: true },
                        { id: 'priceWithoutVat', title: 'Цена за ед. изм. без НДС', kind: 'number', isBase: true },
                      ]

                      if (data.columns && Array.isArray(data.columns)) {
                        const extraColumns = data.columns.filter((col: Column) => !col.isBase)
                        columns = [...columns, ...extraColumns]
                      }

                      setEditingPriceData({ rows, columns })
                      setEditingPriceId(assigned.priceListId)
                      setIsModalOpen(true)
                    } catch (error) {
                      console.error('Failed to load assigned price:', error)
                      alert('Ошибка загрузки прайса')
                    }
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#0070f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  Просмотр
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
        }}
        onSave={handleSave}
        initialRows={editingPriceData?.rows}
        initialColumns={editingPriceData?.columns}
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
