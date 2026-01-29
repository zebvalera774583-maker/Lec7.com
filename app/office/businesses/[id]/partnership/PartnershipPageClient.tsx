'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import PriceUploadModal from './PriceUploadModal'

interface Row {
  [columnId: string]: string
}

interface Column {
  id: string
  title: string
  kind: 'text' | 'number'
  isBase: boolean
}

interface PartnershipPageClientProps {
  businessId: string
}

export default function PartnershipPageClient({ businessId }: PartnershipPageClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [savedRows, setSavedRows] = useState<Row[] | null>(null)
  const [savedColumns, setSavedColumns] = useState<Column[] | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const storageKey = `partnership_price_${businessId}`

  // Загрузка данных из localStorage при монтировании
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.rows && parsed.columns) {
          setSavedRows(parsed.rows)
          setSavedColumns(parsed.columns)
        }
      }
    } catch (error) {
      console.error('Failed to load price from localStorage', error)
    }
  }, [storageKey])

  const handleSave = (rows: Row[], columns: Column[]) => {
    setSavedRows(rows)
    setSavedColumns(columns)
    // Сохранение в localStorage
    try {
      localStorage.setItem(storageKey, JSON.stringify({ rows, columns }))
    } catch (error) {
      console.error('Failed to save price to localStorage', error)
    }
  }

  const handleEdit = () => {
    setIsModalOpen(true)
    setIsMenuOpen(false)
  }

  const handlePriceClick = () => {
    setIsModalOpen(true)
  }

  const rowCount = savedRows ? savedRows.length : 0

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
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          onClick={() => setIsModalOpen(true)}
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

      {/* Бейдж о сохранённом прайсе */}
      {savedRows && savedRows.length > 0 && (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <div
            style={{
              padding: '0.75rem 1rem',
              background: '#dbeafe',
              border: '1px solid #93c5fd',
              borderRadius: '6px',
              color: '#1e40af',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              cursor: 'pointer',
            }}
            onClick={handlePriceClick}
          >
            <span>Прайс 1</span>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
                cursor: 'pointer',
              }}
              onClick={(e) => {
                e.stopPropagation()
                setIsMenuOpen(!isMenuOpen)
              }}
            >
              <div
                style={{
                  width: '16px',
                  height: '2px',
                  background: '#1e40af',
                }}
              />
              <div
                style={{
                  width: '16px',
                  height: '2px',
                  background: '#1e40af',
                }}
              />
              <div
                style={{
                  width: '16px',
                  height: '2px',
                  background: '#1e40af',
                }}
              />
            </div>
          </div>

          {/* Меню гамбургера */}
          {isMenuOpen && (
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
                onClick={() => setIsMenuOpen(false)}
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
                <button
                  onClick={handleEdit}
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
                  Редактировать
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <PriceUploadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        initialRows={savedRows || undefined}
        initialColumns={savedColumns || undefined}
      />
    </main>
  )
}
