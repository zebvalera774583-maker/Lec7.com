'use client'

import { useState } from 'react'
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

  const handleSave = (rows: Row[], columns: Column[]) => {
    setSavedRows(rows)
    setSavedColumns(columns)
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
        <div
          style={{
            padding: '0.75rem 1rem',
            background: '#dbeafe',
            border: '1px solid #93c5fd',
            borderRadius: '6px',
            color: '#1e40af',
            fontSize: '0.875rem',
            display: 'inline-block',
          }}
        >
          Прайс заполнен (черновик) — {rowCount} {rowCount === 1 ? 'строка' : rowCount < 5 ? 'строки' : 'строк'}
        </div>
      )}

      <PriceUploadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
      />
    </main>
  )
}
