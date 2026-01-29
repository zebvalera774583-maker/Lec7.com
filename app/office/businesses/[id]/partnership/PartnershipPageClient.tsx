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
  kind: 'base' | 'derived'
  baseId?: string
  modifierType?: 'markup' | 'discount'
  percent?: number
  rows: Row[]
  columns: Column[]
  assignedCounterparties?: string[]
}

interface PartnershipPageClientProps {
  businessId: string
}

export default function PartnershipPageClient({ businessId }: PartnershipPageClientProps) {
  const [prices, setPrices] = useState<Price[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCreateDerivedModalOpen, setIsCreateDerivedModalOpen] = useState(false)
  const [isAssignCounterpartyModalOpen, setIsAssignCounterpartyModalOpen] = useState(false)
  const [assigningPriceId, setAssigningPriceId] = useState<string | null>(null)
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null)
  const [menuOpenPriceId, setMenuOpenPriceId] = useState<string | null>(null)

  const storageKey = `partnership_prices_${businessId}`

  // Загрузка данных из localStorage при монтировании
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          setPrices(parsed)
        } else if (parsed.rows && parsed.columns) {
          // Миграция старого формата (один прайс) в новый (массив)
          const basePrice: Price = {
            id: 'price_1',
            name: 'Прайс 1',
            kind: 'base',
            rows: parsed.rows,
            columns: parsed.columns,
            assignedCounterparties: [],
          }
          setPrices([basePrice])
        }
      }
    } catch (error) {
      console.error('Failed to load prices from localStorage', error)
    }
  }, [storageKey])

  // Сохранение в localStorage
  const savePrices = (newPrices: Price[]) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(newPrices))
    } catch (error) {
      console.error('Failed to save prices to localStorage', error)
    }
  }

  const handleSave = (rows: Row[], columns: Column[]) => {
    if (editingPriceId) {
      // Редактирование существующего прайса
      const newPrices = prices.map((p) =>
        p.id === editingPriceId ? { ...p, rows, columns } : p
      )
      setPrices(newPrices)
      savePrices(newPrices)
    } else {
      // Создание нового базового прайса
      const newPrice: Price = {
        id: `price_${Date.now()}`,
        name: 'Прайс 1',
        kind: 'base',
        rows,
        columns,
        assignedCounterparties: [],
      }
      const newPrices = [...prices, newPrice]
      setPrices(newPrices)
      savePrices(newPrices)
    }
    setIsModalOpen(false)
    setEditingPriceId(null)
  }

  const handleCreateDerived = (data: { name: string; modifierType: 'markup' | 'discount'; percent: number }) => {
    const basePrice = prices.find((p) => p.kind === 'base')
    if (!basePrice) return

    const newPrice: Price = {
      id: `price_${Date.now()}`,
      name: data.name,
      kind: 'derived',
      baseId: basePrice.id,
      modifierType: data.modifierType,
      percent: data.percent,
      rows: JSON.parse(JSON.stringify(basePrice.rows)), // Глубокое копирование
      columns: JSON.parse(JSON.stringify(basePrice.columns)), // Глубокое копирование
      assignedCounterparties: [],
    }

    const newPrices = [...prices, newPrice]
    setPrices(newPrices)
    savePrices(newPrices)
  }

  const handleEdit = (priceId: string) => {
    setEditingPriceId(priceId)
    setIsModalOpen(true)
    setMenuOpenPriceId(null)
  }

  const handlePriceClick = (priceId: string) => {
    setEditingPriceId(priceId)
    setIsModalOpen(true)
  }

  const handleAssignCounterparty = (priceId: string) => {
    setAssigningPriceId(priceId)
    setIsAssignCounterpartyModalOpen(true)
    setMenuOpenPriceId(null)
  }

  const handleCounterpartyAssign = (residentNumber: string) => {
    if (!assigningPriceId) return
    const newPrices = prices.map((p) => {
      if (p.id === assigningPriceId) {
        const current = p.assignedCounterparties || []
        return {
          ...p,
          assignedCounterparties: [...current, residentNumber],
        }
      }
      return p
    })
    setPrices(newPrices)
    savePrices(newPrices)
  }

  const handleCounterpartyRemove = (residentNumber: string) => {
    if (!assigningPriceId) return
    const newPrices = prices.map((p) => {
      if (p.id === assigningPriceId) {
        const current = p.assignedCounterparties || []
        return {
          ...p,
          assignedCounterparties: current.filter((num) => num !== residentNumber),
        }
      }
      return p
    })
    setPrices(newPrices)
    savePrices(newPrices)
  }

  const getEditingPrice = () => {
    if (!editingPriceId) return null
    return prices.find((p) => p.id === editingPriceId)
  }

  const getAssigningPrice = () => {
    if (!assigningPriceId) return null
    return prices.find((p) => p.id === assigningPriceId)
  }

  const editingPrice = getEditingPrice()
  const assigningPrice = getAssigningPrice()
  const nextPriceNumber = prices.length + 1

  const getPriceBadge = (price: Price) => {
    let modifierText = ''
    if (price.kind === 'derived' && price.modifierType && price.percent !== undefined) {
      const sign = price.modifierType === 'markup' ? '+' : '−'
      modifierText = ` (${sign}${price.percent}%)`
    }
    return modifierText
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
                {(price.assignedCounterparties?.length || 0) > 0 && (
                  <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>
                    Контрагенты: {price.assignedCounterparties?.length || 0}
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
                  {price.kind === 'base' && (
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
        }}
        onSave={handleSave}
        initialRows={editingPrice?.rows}
        initialColumns={editingPrice?.columns}
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
        }}
        assignedCounterparties={assigningPrice?.assignedCounterparties || []}
        onAssign={handleCounterpartyAssign}
        onRemove={handleCounterpartyRemove}
      />
    </main>
  )
}
