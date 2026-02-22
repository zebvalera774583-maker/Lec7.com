'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const FIELDS = [
  { key: 'legalName' as const, label: 'Юридическое название' },
  { key: 'address' as const, label: 'Адрес' },
  { key: 'ogrn' as const, label: 'ОГРН' },
  { key: 'inn' as const, label: 'ИНН' },
  { key: 'bankAccount' as const, label: 'р/сч' },
  { key: 'bank' as const, label: 'Банк' },
  { key: 'bankCorrAccount' as const, label: 'к/сч' },
  { key: 'bik' as const, label: 'БИК' },
  { key: 'requisitesPhone' as const, label: 'Телефон' },
  { key: 'requisitesEmail' as const, label: 'Электронный адрес' },
  { key: 'director' as const, label: 'Директор или ИП' },
]

type FormState = Record<string, string | null>

export default function RequisitesPageClient({ businessId }: { businessId: string }) {
  const [form, setForm] = useState<FormState>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    fetch(`/api/office/businesses/${businessId}/requisites`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        const state: FormState = {}
        FIELDS.forEach(({ key }) => { state[key] = data[key] ?? null })
        setForm(state)
      })
      .finally(() => setLoading(false))
  }, [businessId])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/office/businesses/${businessId}/requisites`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Ошибка сохранения')
    } catch {
      alert('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const res = await fetch(`/api/office/businesses/${businessId}/requisites/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Ошибка')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'реквизиты.docx'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Ошибка при скачивании')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) return <p style={{ color: '#6b7280' }}>Загрузка…</p>

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>Реквизиты предприятия</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {FIELDS.map(({ key, label }) => (
          <div key={key}>
            <label style={{ display: 'block', fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.25rem' }}>{label}</label>
            <input
              type="text"
              value={form[key] ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value || null }))}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '0.9375rem',
              }}
            />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '0.5rem 1rem',
            background: '#111827',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
          }}
        >
          {saving ? 'Сохранение…' : 'Сохранить'}
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          style={{
            padding: '0.5rem 1rem',
            background: '#f3f4f6',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            cursor: downloading ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
          }}
        >
          {downloading ? 'Скачивание…' : 'Скачать'}
        </button>
      </div>
    </div>
  )
}
