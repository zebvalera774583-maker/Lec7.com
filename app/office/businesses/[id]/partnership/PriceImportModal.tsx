'use client'

import { useState, useRef } from 'react'

export type ImportItem = {
  title: string
  price: number | null
  priceWithVat?: number | null
  priceWithoutVat?: number | null
  unit?: string | null
  sku?: string | null
}

interface PriceImportModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  businessId: string
}

const PREVIEW_ROWS = 100

export default function PriceImportModal({
  isOpen,
  onClose,
  onSuccess,
  businessId,
}: PriceImportModalProps) {
  const [step, setStep] = useState<'select' | 'preview'>('select')
  const [file, setFile] = useState<File | null>(null)
  const [items, setItems] = useState<ImportItem[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setStep('select')
    setFile(null)
    setItems([])
    setWarnings([])
    setSelected(new Set())
    setError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return

    setError('')
    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('file', f)

      const res = await fetch(
        `/api/office/businesses/${businessId}/price-lists/import/parse`,
        { method: 'POST', body: formData, credentials: 'include' }
      )
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Ошибка при разборе файла')
        setLoading(false)
        return
      }

      const parsedItems: ImportItem[] = data.items || []
      const parsedWarnings: string[] = data.warnings || []

      setItems(parsedItems)
      setWarnings(parsedWarnings)
      setFile(f)
      setSelected(new Set(parsedItems.map((_, i) => i)))
      setStep('preview')
    } catch {
      setError('Ошибка соединения')
    } finally {
      setLoading(false)
    }
  }

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelected(new Set(items.map((_, i) => i)))
    } else {
      setSelected(new Set())
    }
  }

  const toggleOne = (index: number) => {
    const next = new Set(selected)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    setSelected(next)
  }

  const handleImport = async () => {
    if (selected.size === 0) {
      setError('Выберите хотя бы одну позицию')
      return
    }

    setError('')
    setImporting(true)

    try {
      const toImport = Array.from(selected)
        .sort((a, b) => a - b)
        .map((i) => items[i])

      const res = await fetch(
        `/api/office/businesses/${businessId}/price-lists/import/commit`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: `Импорт прайса (${new Date().toISOString().slice(0, 16).replace('T', ' ')})`,
            items: toImport,
          }),
        }
      )

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Ошибка при импорте')
        setImporting(false)
        return
      }

      handleClose()
      onSuccess()
    } catch {
      setError('Ошибка соединения')
    } finally {
      setImporting(false)
    }
  }

  if (!isOpen) return null

  const previewItems = items.slice(0, PREVIEW_ROWS)
  const selectedCount = selected.size
  const totalCount = items.length

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: '#fff',
          maxWidth: '90vw',
          maxHeight: '90vh',
          overflow: 'auto',
          padding: '1.5rem',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Импорт прайса</h2>
          <button
            type="button"
            onClick={handleClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', color: '#6b7280' }}
          >
            ×
          </button>
        </div>

        {step === 'select' && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.pdf,.docx"
              onChange={handleFileChange}
              style={{ marginBottom: '1rem' }}
            />
            {loading && <p style={{ color: '#6b7280' }}>Загрузка и разбор файла...</p>}
            {error && <p style={{ color: '#dc2626', marginTop: '0.5rem' }}>{error}</p>}
          </div>
        )}

        {step === 'preview' && (
          <div>
            {warnings.length > 0 && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#fef3c7', color: '#92400e' }}>
                {warnings.map((w, i) => (
                  <p key={i} style={{ margin: 0, fontSize: '0.9rem' }}>
                    {w}
                  </p>
                ))}
              </div>
            )}

            <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => toggleAll(true)}
                style={{ padding: '0.35rem 0.75rem', background: '#f3f4f6', border: '1px solid #d1d5db', cursor: 'pointer', fontSize: '0.875rem' }}
              >
                Выбрать все
              </button>
              <button
                type="button"
                onClick={() => toggleAll(false)}
                style={{ padding: '0.35rem 0.75rem', background: '#f3f4f6', border: '1px solid #d1d5db', cursor: 'pointer', fontSize: '0.875rem' }}
              >
                Снять все
              </button>
              <span style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                Выбрано {selectedCount} из {totalCount}
                {totalCount > PREVIEW_ROWS && ` (показаны первые ${PREVIEW_ROWS})`}
              </span>
            </div>

            <div style={{ maxHeight: '400px', overflow: 'auto', border: '1px solid #e5e7eb', marginBottom: '1rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.5rem', border: '1px solid #e5e7eb', width: 40 }}>✓</th>
                    <th style={{ padding: '0.5rem', border: '1px solid #e5e7eb', textAlign: 'left' }}>Наименование</th>
                    <th style={{ padding: '0.5rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>Цена</th>
                    <th style={{ padding: '0.5rem', border: '1px solid #e5e7eb', textAlign: 'left' }}>Ед.</th>
                  </tr>
                </thead>
                <tbody>
                  {previewItems.map((item, i) => (
                    <tr key={i}>
                      <td style={{ padding: '0.5rem', border: '1px solid #e5e7eb' }}>
                        <input
                          type="checkbox"
                          checked={selected.has(i)}
                          onChange={() => toggleOne(i)}
                        />
                      </td>
                      <td style={{ padding: '0.5rem', border: '1px solid #e5e7eb' }}>{item.title}</td>
                      <td style={{ padding: '0.5rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>
                        {item.price != null ? item.price : '—'}
                      </td>
                      <td style={{ padding: '0.5rem', border: '1px solid #e5e7eb' }}>{item.unit || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {error && <p style={{ color: '#dc2626', marginBottom: '0.5rem' }}>{error}</p>}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setStep('select')}
                style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', cursor: 'pointer' }}
              >
                Другой файл
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={importing || selectedCount === 0}
                style={{
                  padding: '0.5rem 1rem',
                  background: selectedCount === 0 ? '#9ca3af' : '#111827',
                  color: '#fff',
                  border: 'none',
                  cursor: selectedCount === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {importing ? 'Импорт...' : `Импортировать (${selectedCount})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
