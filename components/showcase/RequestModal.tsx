'use client'

import { useState } from 'react'

interface RequestModalProps {
  isOpen: boolean
  onClose: () => void
  businessId: string
  businessName: string
}

export default function RequestModal({ isOpen, onClose, businessId, businessName }: RequestModalProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (!name.trim() || !phone.trim()) {
      setError('Заполните все обязательные поля')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          businessId,
          title: `Заявка на расчёт от ${name}`,
          description: comment || 'Заявка на расчёт',
          clientName: name,
          clientPhone: phone,
          source: 'showcase',
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Ошибка отправки заявки')
      }

      setSuccess(true)
      setName('')
      setPhone('')
      setComment('')

      setTimeout(() => {
        setSuccess(false)
        onClose()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки заявки')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setName('')
      setPhone('')
      setComment('')
      setError('')
      setSuccess(false)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={handleClose}
      >
        {/* Modal */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 0,
            padding: '2rem',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.5rem', fontWeight: 600, color: '#111827' }}>
            Заявка на расчёт
          </h2>
          <p style={{ margin: '0 0 1.5rem 0', color: '#666', fontSize: '0.9rem' }}>
            Оставьте заявку для бизнеса: <strong>{businessName}</strong>
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor="request-name"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#111827',
                }}
              >
                Имя <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="request-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: 0,
                  fontSize: '0.9rem',
                  background: loading ? '#f9fafb' : '#ffffff',
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor="request-phone"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#111827',
                }}
              >
                Телефон <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="request-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: 0,
                  fontSize: '0.9rem',
                  background: loading ? '#f9fafb' : '#ffffff',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label
                htmlFor="request-comment"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#111827',
                }}
              >
                Комментарий
              </label>
              <textarea
                id="request-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                disabled={loading}
                rows={4}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: 0,
                  fontSize: '0.9rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  background: loading ? '#f9fafb' : '#ffffff',
                }}
              />
            </div>

            {error && (
              <div
                style={{
                  marginBottom: '1rem',
                  padding: '0.75rem',
                  background: '#fee2e2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  fontSize: '0.875rem',
                  borderRadius: 0,
                }}
              >
                {error}
              </div>
            )}

            {success && (
              <div
                style={{
                  marginBottom: '1rem',
                  padding: '0.75rem',
                  background: '#d1fae5',
                  border: '1px solid #a7f3d0',
                  color: '#065f46',
                  fontSize: '0.875rem',
                  borderRadius: 0,
                }}
              >
                Заявка успешно отправлена!
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: 0,
                  background: '#ffffff',
                  color: '#111827',
                  fontSize: '0.9rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.5 : 1,
                }}
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: '1px solid #4b6fae',
                  borderRadius: 0,
                  background: '#4b6fae',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.5 : 1,
                }}
              >
                {loading ? 'Отправка...' : 'Отправить'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
