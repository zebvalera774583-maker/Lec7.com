'use client'

import { useState, useEffect, useCallback } from 'react'

interface BotCatalogItem {
  id: string
  canonicalName: string
  synonyms: string[] | string
  defaultUnit: string | null
  isActive: boolean
}

interface ImportResult {
  inserted: number
  updated: number
  skipped: number
  errors: string[]
}

export default function BotToolsClient() {
  const [items, setItems] = useState<BotCatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [file, setFile] = useState<File | null>(null)

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/bot-tools/catalog', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setItems(data)
      }
    } catch (e) {
      console.error('Fetch catalog error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const handleImport = async () => {
    if (!file) return
    setImporting(true)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/admin/bot-tools/catalog/import-xlsx', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
      const data = await res.json()
      if (res.ok) {
        setResult(data)
        setFile(null)
        await fetchItems()
      } else {
        setResult({
          inserted: 0,
          updated: 0,
          skipped: 0,
          errors: [data.error || 'Ошибка загрузки'],
        })
      }
    } catch (e) {
      setResult({
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: [e instanceof Error ? e.message : 'Ошибка сети'],
      })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '0.5rem', fontSize: '1.875rem', fontWeight: 700 }}>
        Справочник бота
      </h1>
      <p style={{ margin: '0 0 1.5rem 0', color: '#6b7280', fontSize: '1rem' }}>
        Глобальный каталог товаров для распознавания ботом.
      </p>
      <div
        style={{
          height: '1px',
          background: '#e5e7eb',
          marginBottom: '1.5rem',
        }}
      />

      {/* Импорт */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: 600 }}>
          Импорт Excel
        </h2>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={{ fontSize: '0.875rem' }}
          />
          <button
            type="button"
            onClick={handleImport}
            disabled={!file || importing}
            style={{
              padding: '0.5rem 1rem',
              background: file && !importing ? '#111827' : '#9ca3af',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: file && !importing ? 'pointer' : 'not-allowed',
            }}
          >
            {importing ? 'Загрузка…' : 'Загрузить Excel'}
          </button>
        </div>
        {result && (
          <div
            style={{
              marginTop: '1rem',
              padding: '0.75rem',
              background: '#f9fafb',
              borderRadius: '6px',
              fontSize: '0.875rem',
            }}
          >
            <div>
              Добавлено: {result.inserted}, обновлено: {result.updated}, пропущено: {result.skipped}
            </div>
            {result.errors.length > 0 && (
              <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.25rem', color: '#dc2626' }}>
                {result.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Список записей */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '1.5rem',
        }}
      >
        <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: 600 }}>
          Записи каталога
        </h2>
        {loading ? (
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Загрузка…</p>
        ) : items.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Нет записей. Загрузите Excel.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {items.map((item) => {
              const synonymsList = Array.isArray(item.synonyms)
                ? item.synonyms
                : (typeof item.synonyms === 'string' ? item.synonyms.split(',') : [])
                    .map((s: string) => s.trim())
                    .filter(Boolean)
              return (
                <div
                  key={item.id}
                  style={{
                    marginBottom: 16,
                    padding: '0.75rem',
                    background: '#f9fafb',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{item.canonicalName}</div>
                  {item.defaultUnit && (
                    <span style={{ marginLeft: 0, color: '#6b7280', fontSize: '0.875rem' }}>
                      ({item.defaultUnit})
                    </span>
                  )}
                  {!item.isActive && (
                    <span style={{ marginLeft: '0.5rem', color: '#9ca3af' }}>неактивен</span>
                  )}
                  {synonymsList.length > 0 && (
                    <div style={{ color: '#666', fontSize: 14, marginTop: '0.25rem' }}>
                      Синонимы: {synonymsList.join(', ')}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
