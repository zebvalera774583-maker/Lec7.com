'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface BusinessMenuProps {
  businessId: string
  slug: string
}

interface Requisites {
  legalName: string | null
  address: string | null
  ogrn: string | null
  inn: string | null
  bankAccount: string | null
  bank: string | null
  bankCorrAccount: string | null
  bik: string | null
  requisitesPhone: string | null
  requisitesEmail: string | null
  director: string | null
}

export default function BusinessMenu({ businessId, slug }: BusinessMenuProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [requisitesOpen, setRequisitesOpen] = useState(false)
  const [requisites, setRequisites] = useState<Requisites | null>(null)
  const [requisitesLoading, setRequisitesLoading] = useState(false)
  const [requisitesSaving, setRequisitesSaving] = useState(false)
  const [requisitesDownloading, setRequisitesDownloading] = useState(false)
  const [requisitesForm, setRequisitesForm] = useState<Requisites>({
    legalName: null,
    address: null,
    ogrn: null,
    inn: null,
    bankAccount: null,
    bank: null,
    bankCorrAccount: null,
    bik: null,
    requisitesPhone: null,
    requisitesEmail: null,
    director: null,
  })

  useEffect(() => {
    if (requisitesOpen && businessId) {
      setRequisitesLoading(true)
      fetch(`/api/office/businesses/${businessId}/requisites`, { credentials: 'include' })
        .then((r) => r.json())
        .then((data) => {
          setRequisites(data)
          setRequisitesForm({
            legalName: data.legalName ?? null,
            address: data.address ?? null,
            ogrn: data.ogrn ?? null,
            inn: data.inn ?? null,
            bankAccount: data.bankAccount ?? null,
            bank: data.bank ?? null,
            bankCorrAccount: data.bankCorrAccount ?? null,
            bik: data.bik ?? null,
            requisitesPhone: data.requisitesPhone ?? null,
            requisitesEmail: data.requisitesEmail ?? null,
            director: data.director ?? null,
          })
        })
        .catch(() => setRequisites(null))
        .finally(() => setRequisitesLoading(false))
    }
  }, [requisitesOpen, businessId])

  const handleDownloadRequisites = async () => {
    setRequisitesDownloading(true)
    try {
      const res = await fetch(`/api/office/businesses/${businessId}/requisites/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(requisitesForm),
      })
      if (!res.ok) throw new Error('Ошибка загрузки')
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
      setRequisitesDownloading(false)
    }
  }

  const handleSaveRequisites = async () => {
    setRequisitesSaving(true)
    try {
      const res = await fetch(`/api/office/businesses/${businessId}/requisites`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(requisitesForm),
      })
      if (res.ok) {
        setRequisites(requisitesForm)
        setRequisitesOpen(false)
      } else {
        alert('Ошибка сохранения')
      }
    } catch {
      alert('Ошибка сохранения')
    } finally {
      setRequisitesSaving(false)
    }
  }

  const handleEditProfile = () => {
    router.push(`/office/businesses/${businessId}/profile`)
    setIsOpen(false)
  }

  const handleOpenShowcase = () => {
    window.open(`/office/businesses/${businessId}/preview`, '_blank')
    setIsOpen(false)
  }

  const handleOpenAds = () => {
    router.push(`/office/ads?businessId=${businessId}`)
    setIsOpen(false)
  }

  const handleOpenRequests = () => {
    router.push(`/office/businesses/${businessId}/requests`)
    setIsOpen(false)
  }

  const handleOpenPartnership = () => {
    router.push(`/office/businesses/${businessId}/partnership`)
    setIsOpen(false)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
        aria-label="Меню"
      >
        <div
          style={{
            width: '20px',
            height: '2px',
            background: '#333',
            transition: 'all 0.3s',
            transform: isOpen ? 'rotate(45deg) translate(5px, 5px)' : 'none',
          }}
        />
        <div
          style={{
            width: '20px',
            height: '2px',
            background: '#333',
            transition: 'all 0.3s',
            opacity: isOpen ? 0 : 1,
          }}
        />
        <div
          style={{
            width: '20px',
            height: '2px',
            background: '#333',
            transition: 'all 0.3s',
            transform: isOpen ? 'rotate(-45deg) translate(5px, -5px)' : 'none',
          }}
        />
      </button>

      {isOpen && (
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
            onClick={() => setIsOpen(false)}
          />
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '0.5rem',
              background: 'white',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              border: '1px solid #e5e7eb',
              minWidth: '200px',
              zIndex: 999,
              overflow: 'hidden',
            }}
          >
            <button
              onClick={handleEditProfile}
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
              Редактировать профиль
            </button>
            <button
              onClick={() => {
                setRequisitesOpen(true)
                setIsOpen(false)
              }}
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
              Реквизиты предприятия
            </button>
            <button
              onClick={handleOpenRequests}
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
              Заявки
            </button>
            <button
              onClick={handleOpenAds}
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
              Реклама и продвижение
            </button>
            <button
              onClick={handleOpenShowcase}
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
              Открыть витрину
            </button>
            <button
              onClick={handleOpenPartnership}
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
              Партнерство
            </button>
          </div>
        </>
      )}

      {/* Модальное окно «Реквизиты предприятия» */}
      {requisitesOpen && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.4)',
              zIndex: 1000,
            }}
            onClick={() => setRequisitesOpen(false)}
          />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              padding: '1.5rem',
              minWidth: '400px',
              maxWidth: '90vw',
              maxHeight: '90vh',
              overflow: 'auto',
              zIndex: 1001,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Реквизиты предприятия</h2>
              <button
                type="button"
                onClick={() => setRequisitesOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1, color: '#6b7280' }}
              >
                ×
              </button>
            </div>

            {requisitesLoading ? (
              <p style={{ color: '#6b7280' }}>Загрузка…</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[
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
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label style={{ display: 'block', fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.25rem' }}>{label}</label>
                    <input
                      type="text"
                      value={requisitesForm[key] ?? ''}
                      onChange={(e) => setRequisitesForm((prev) => ({ ...prev, [key]: e.target.value || null }))}
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
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={handleDownloadRequisites}
                disabled={requisitesLoading || requisitesDownloading}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#f3f4f6',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: requisitesLoading || requisitesDownloading ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                {requisitesDownloading ? 'Скачивание…' : 'Скачать'}
              </button>
              <button
                type="button"
                onClick={() => setRequisitesOpen(false)}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#f3f4f6',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSaveRequisites}
                disabled={requisitesLoading || requisitesSaving}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#111827',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: requisitesLoading || requisitesSaving ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                {requisitesSaving ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
