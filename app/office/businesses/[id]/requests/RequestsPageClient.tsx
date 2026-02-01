'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface RequestsPageClientProps {
  businessId: string
}

export default function RequestsPageClient({ businessId }: RequestsPageClientProps) {
  const [showCreateBlock, setShowCreateBlock] = useState(false)
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [selectedCategory, setSelectedCategory] = useState('')

  useEffect(() => {
    fetch('/api/categories?type=PRICE', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then((list: { id: string; name: string }[]) => {
        setCategories(Array.isArray(list) ? list : [])
      })
      .catch(() => {})
  }, [])

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ marginBottom: '1rem', fontSize: '2rem' }}>Заявки</h1>

      <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Левая часть: Назад, Создать заявку, Поступившие заявки, Архив заявок */}
        <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <Link
            href={`/office/businesses/${businessId}`}
            style={{ padding: '0.25rem 0', color: '#111827', fontSize: '1rem', fontWeight: 500, textDecoration: 'none', display: 'inline-block', width: 'fit-content' }}
          >
            Назад
          </Link>
          <button
            type="button"
            onClick={() => setShowCreateBlock(!showCreateBlock)}
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
            Создать заявку
          </button>
          <p style={{ padding: '0.25rem 0', color: '#111827', fontSize: '1rem', fontWeight: 500, margin: 0 }}>
            Поступившие заявки
          </p>
          <p style={{ padding: '0.25rem 0', color: '#111827', fontSize: '1rem', fontWeight: 500, margin: 0 }}>
            Архив заявок
          </p>
        </div>

        {/* Справа: блок выбора категории (при нажатии Создать заявку) */}
        {showCreateBlock && (
          <div style={{ flex: '0 0 auto', minWidth: '280px' }}>
            <p style={{ marginBottom: '0.35rem', color: '#374151', fontSize: '0.9375rem' }}>
              Выберите категорию, в которой хотите сделать заявку
            </p>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{
                padding: '0.5rem 0.75rem',
                fontSize: '1rem',
                width: '100%',
                minWidth: '280px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                background: 'white',
              }}
            >
              <option value="">Выберите категорию</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </main>
  )
}
