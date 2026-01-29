'use client'

import { useState } from 'react'

interface AssignCounterpartyModalProps {
  isOpen: boolean
  onClose: () => void
  assignedCounterparties: string[]
  onAssign: (residentNumber: string) => void
  onRemove: (residentNumber: string) => void
}

export default function AssignCounterpartyModal({
  isOpen,
  onClose,
  assignedCounterparties,
  onAssign,
  onRemove,
}: AssignCounterpartyModalProps) {
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState('')

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim().toUpperCase()
    setInputValue(value)
    setError('')
  }

  const handleAssign = () => {
    const trimmed = inputValue.trim().toUpperCase()
    
    if (!trimmed) {
      setError('Введите номер контрагента')
      return
    }

    // Валидация формата: L7-[A-Z0-9]{8}
    const pattern = /^L7-[A-Z0-9]{8}$/
    if (!pattern.test(trimmed)) {
      setError('Неверный формат. Пример: L7-8F2KQ1MZ')
      return
    }

    // Проверка на дубликат
    if (assignedCounterparties.includes(trimmed)) {
      setError('Уже назначено')
      return
    }

    onAssign(trimmed)
    setInputValue('')
    setError('')
  }

  const handleCancel = () => {
    setInputValue('')
    setError('')
    onClose()
  }

  const handleRemove = (residentNumber: string) => {
    onRemove(residentNumber)
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
        onClick={handleCancel}
      >
        {/* Modal */}
        <div
          style={{
            background: 'white',
            borderRadius: '8px',
            padding: '1.5rem',
            maxWidth: '500px',
            width: '90vw',
            zIndex: 1001,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Назначить контрагента</h2>
            <button
              onClick={handleCancel}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: '#666',
                padding: '0.25rem 0.5rem',
              }}
            >
              ×
            </button>
          </div>

          <p style={{ marginBottom: '1rem', color: '#666', fontSize: '0.875rem' }}>
            Введите индивидуальный номер контрагента (например, L7-8F2KQ1MZ).
          </p>

          {/* Поле ввода */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
              Номер контрагента
            </label>
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              placeholder="L7-8F2KQ1MZ"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: error ? '1px solid #ef4444' : '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '0.875rem',
                textTransform: 'uppercase',
                boxSizing: 'border-box',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAssign()
                }
              }}
            />
            {error && (
              <div
                style={{
                  marginTop: '0.5rem',
                  padding: '0.75rem',
                  background: '#fee2e2',
                  border: '1px solid #fecaca',
                  borderRadius: '4px',
                  color: '#991b1b',
                  fontSize: '0.875rem',
                }}
              >
                {error}
              </div>
            )}
          </div>

          {/* Список назначенных контрагентов */}
          {assignedCounterparties.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                Назначенные контрагенты:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {assignedCounterparties.map((residentNumber) => (
                  <div
                    key={residentNumber}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.5rem 0.75rem',
                      background: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: '4px',
                    }}
                  >
                    <span style={{ fontSize: '0.875rem', fontFamily: 'monospace' }}>{residentNumber}</span>
                    <button
                      onClick={() => handleRemove(residentNumber)}
                      style={{
                        padding: '0.25rem 0.5rem',
                        background: '#fee2e2',
                        color: '#991b1b',
                        border: '1px solid #fecaca',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                      }}
                    >
                      Убрать
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Кнопки */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button
              onClick={handleCancel}
              style={{
                padding: '0.5rem 1rem',
                background: '#f3f4f6',
                color: '#111827',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Отмена
            </button>
            <button
              onClick={handleAssign}
              style={{
                padding: '0.5rem 1rem',
                background: '#0070f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Назначить
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
