'use client'

import { useState, useEffect, useCallback } from 'react'

interface BotCatalogItem {
  id: string
  canonicalName: string
  synonyms: string[]
  defaultUnit: string | null
  isActive: boolean
  requiresClarification?: boolean
  clarificationOptions?: string[]
}

interface ImportResult {
  inserted: number
  updated: number
  skipped: number
  errors: string[]
}

const PAGE_SIZE = 20

export default function BotToolsClient() {
  const [items, setItems] = useState<BotCatalogItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<BotCatalogItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    canonicalName: '',
    defaultUnit: '',
    isActive: true,
    requiresClarification: false,
    synonyms: '',
    clarificationOptions: '',
  })

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      params.set('page', String(page))
      const res = await fetch(`/api/admin/bot-tools/catalog?${params}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setItems(data.items)
        setTotal(data.total)
      }
    } catch (e) {
      console.error('Fetch catalog error:', e)
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput.trim())
    setPage(1)
  }

  const openAddModal = () => {
    setEditingItem(null)
    setFormData({
      canonicalName: '',
      defaultUnit: '',
      isActive: true,
      requiresClarification: false,
      synonyms: '',
      clarificationOptions: '',
    })
    setModalOpen(true)
  }

  const openEditModal = (item: BotCatalogItem) => {
    setEditingItem(item)
    setFormData({
      canonicalName: item.canonicalName,
      defaultUnit: item.defaultUnit || '',
      isActive: item.isActive,
      requiresClarification: !!item.requiresClarification,
      synonyms: Array.isArray(item.synonyms) ? item.synonyms.join(', ') : '',
      clarificationOptions: Array.isArray(item.clarificationOptions) ? item.clarificationOptions.join(', ') : '',
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingItem(null)
  }

  const handleSave = async () => {
    const canonicalName = formData.canonicalName.trim()
    if (!canonicalName) {
      alert('Введите каноническое название')
      return
    }
    if (formData.requiresClarification) {
      const opts = formData.clarificationOptions.split(/[,\n]+/).map((p) => p.trim()).filter(Boolean)
      const unique = [...new Set(opts.map((p) => p.toLowerCase()))]
      if (unique.length < 2) {
        alert('При включённом «Требует уточнения» нужно минимум 2 варианта')
        return
      }
    }
    setSaving(true)
    try {
      const body = {
        canonicalName,
        defaultUnit: formData.defaultUnit.trim() || null,
        isActive: formData.isActive,
        requiresClarification: formData.requiresClarification,
        synonyms: formData.synonyms,
        clarificationOptions: formData.requiresClarification ? formData.clarificationOptions : '',
      }
      if (editingItem) {
        const res = await fetch(`/api/admin/bot-tools/catalog/${editingItem.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          credentials: 'include',
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Ошибка сохранения')
      } else {
        const res = await fetch('/api/admin/bot-tools/catalog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          credentials: 'include',
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Ошибка создания')
      }
      closeModal()
      await fetchItems()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (item: BotCatalogItem) => {
    if (!window.confirm(`Удалить «${item.canonicalName}»?`)) return
    setDeletingId(item.id)
    try {
      const res = await fetch(`/api/admin/bot-tools/catalog/${item.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Ошибка удаления')
      }
      await fetchItems()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setDeletingId(null)
    }
  }

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

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '0.5rem', fontSize: '1.875rem', fontWeight: 700 }}>
        Мастер каталог
      </h1>
      <p style={{ margin: '0 0 1.5rem 0', color: '#6b7280', fontSize: '1rem' }}>
        Глобальный каталог товаров для распознавания ботом.
      </p>
      <div style={{ height: '1px', background: '#e5e7eb', marginBottom: '1.5rem' }} />

      {/* Поиск */}
      <form
        onSubmit={handleSearchSubmit}
        style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
      >
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Поиск по названию или синонимам..."
          style={{
            flex: 1,
            maxWidth: '400px',
            padding: '0.5rem 0.75rem',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '0.875rem',
          }}
        />
        <button
          type="submit"
          style={{
            padding: '0.5rem 1rem',
            background: '#111827',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Найти
        </button>
        {search && (
          <button
            type="button"
            onClick={() => {
              setSearchInput('')
              setSearch('')
              setPage(1)
            }}
            style={{
              padding: '0.5rem 1rem',
              background: '#f3f4f6',
              color: '#6b7280',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Сбросить
          </button>
        )}
      </form>

      {/* Импорт Excel */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '1rem 1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <h2 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 600 }}>
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
              marginTop: '0.75rem',
              padding: '0.5rem 0.75rem',
              background: '#f9fafb',
              borderRadius: '6px',
              fontSize: '0.875rem',
            }}
          >
            Добавлено: {result.inserted}, обновлено: {result.updated}, пропущено: {result.skipped}
            {result.errors.length > 0 && (
              <ul style={{ margin: '0.25rem 0 0 0', paddingLeft: '1.25rem', color: '#dc2626' }}>
                {result.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Таблица */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 1.5rem',
            borderBottom: '1px solid #e5e7eb',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
            Каталог ({total})
          </h2>
          <button
            onClick={openAddModal}
            style={{
              padding: '0.5rem 1rem',
              background: '#111827',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            + Добавить позицию
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Загрузка…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
            {search ? 'Ничего не найдено' : 'Нет записей. Загрузите Excel или добавьте позицию.'}
          </div>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>ID</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Каноническое название</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Ед. изм.</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Кол-во синонимов</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Активен</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.75rem 1rem', color: '#6b7280', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {item.id.slice(0, 8)}…
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{item.canonicalName}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#6b7280' }}>{item.defaultUnit || '—'}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#6b7280' }}>
                      {Array.isArray(item.synonyms) ? item.synonyms.length : 0}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {item.isActive ? (
                        <span style={{ color: '#059669' }}>✔</span>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <button
                        onClick={() => openEditModal(item)}
                        style={{
                          marginRight: '0.5rem',
                          padding: '0.25rem 0.5rem',
                          background: 'none',
                          color: '#111827',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        Редактировать
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        disabled={deletingId === item.id}
                        style={{
                          padding: '0.25rem 0.5rem',
                          background: 'none',
                          color: '#dc2626',
                          border: '1px solid #fecaca',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          cursor: deletingId === item.id ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {deletingId === item.id ? '…' : 'Удалить'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Пагинация */}
            {totalPages > 1 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '1rem',
                  borderTop: '1px solid #e5e7eb',
                }}
              >
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  style={{
                    padding: '0.25rem 0.75rem',
                    background: page <= 1 ? '#f3f4f6' : '#fff',
                    color: page <= 1 ? '#9ca3af' : '#111827',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                    cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  ←
                </button>
                <span style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  style={{
                    padding: '0.25rem 0.75rem',
                    background: page >= totalPages ? '#f3f4f6' : '#fff',
                    color: page >= totalPages ? '#9ca3af' : '#111827',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                    cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  }}
                >
                  →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={closeModal}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '8px',
              padding: '1.5rem',
              maxWidth: '500px',
              width: '90vw',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem' }}>
              {editingItem ? 'Редактировать позицию' : 'Добавить позицию'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>
                  Каноническое название *
                </label>
                <input
                  value={formData.canonicalName}
                  onChange={(e) => setFormData((f) => ({ ...f, canonicalName: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="requiresClarification"
                  checked={formData.requiresClarification}
                  onChange={(e) => setFormData((f) => ({ ...f, requiresClarification: e.target.checked }))}
                />
                <label htmlFor="requiresClarification" style={{ fontSize: '0.875rem' }}>Требует уточнения</label>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>
                  Единица измерения
                </label>
                <input
                  value={formData.defaultUnit}
                  onChange={(e) => setFormData((f) => ({ ...f, defaultUnit: e.target.value }))}
                  placeholder="кг, шт, л..."
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>
                  Синонимы (через запятую)
                </label>
                <textarea
                  value={formData.synonyms}
                  onChange={(e) => setFormData((f) => ({ ...f, synonyms: e.target.value }))}
                  placeholder="синоним1, синоним2, ..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>
              {formData.requiresClarification && (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>
                    Варианты (через запятую) *
                  </label>
                  <textarea
                    value={formData.clarificationOptions}
                    onChange={(e) => setFormData((f) => ({ ...f, clarificationOptions: e.target.value }))}
                    placeholder="перец красный, перец жёлтый, перец зелёный"
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      boxSizing: 'border-box',
                      resize: 'vertical',
                    }}
                  />
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                    Минимум 2 варианта. Будут показаны как кнопки выбора в боте.
                  </p>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData((f) => ({ ...f, isActive: e.target.checked }))}
                />
                <label htmlFor="isActive" style={{ fontSize: '0.875rem' }}>Активен</label>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button
                onClick={closeModal}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#f3f4f6',
                  color: '#111827',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                Отмена
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '0.5rem 1rem',
                  background: saving ? '#9ca3af' : '#111827',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Сохранение…' : editingItem ? 'Сохранить' : 'Добавить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
