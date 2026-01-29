'use client'

import { useState } from 'react'

interface CreateDerivedPriceModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (data: { name: string; modifierType: 'markup' | 'discount'; percent: number }) => void
  nextPriceNumber: number
}

export default function CreateDerivedPriceModal({
  isOpen,
  onClose,
  onCreate,
  nextPriceNumber,
}: CreateDerivedPriceModalProps) {
  const [percent, setPercent] = useState('')
  const [modifierType, setModifierType] = useState<'markup' | 'discount'>('markup')
  const [customName, setCustomName] = useState('')
  const [useCustomName, setUseCustomName] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = () => {
    setError('')
    const percentNum = parseFloat(percent)
    
    if (!percent || isNaN(percentNum) || percentNum <= 0) {
      setError('Процент должен быть больше 0')
      return
    }

    if (percentNum > 999) {
      setError('Процент не может быть больше 999')
      return
    }

    const name = useCustomName && customName.trim() ? customName.trim() : `Прайс ${nextPriceNumber}`

    onCreate({
      name,
      modifierType,
      percent: percentNum,
    })

    // Сброс формы
    setPercent('')
    setModifierType('markup')
    setCustomName('')
    setUseCustomName(false)
    setError('')
    onClose()
  }

  const handleCancel = () => {
    setPercent('')
    setModifierType('markup')
    setCustomName('')
    setUseCustomName(false)
    setError('')
    onClose()
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
            <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Создать производный прайс</h2>
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

          {/* Процент */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
              Процент
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="number"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                placeholder="0"
                min="0.01"
                max="999"
                step="0.01"
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              />
              <span style={{ fontSize: '0.875rem', color: '#666' }}>%</span>
            </div>
          </div>

          {/* Тип */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
              Тип
            </label>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={modifierType === 'markup'}
                  onChange={() => setModifierType('markup')}
                />
                <span style={{ fontSize: '0.875rem' }}>Наценка</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={modifierType === 'discount'}
                  onChange={() => setModifierType('discount')}
                />
                <span style={{ fontSize: '0.875rem' }}>Скидка</span>
              </label>
            </div>
          </div>

          {/* Название */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={useCustomName}
                onChange={(e) => setUseCustomName(e.target.checked)}
              />
              <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Указать своё название</span>
            </label>
            {useCustomName && (
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={`По умолчанию: Прайс ${nextPriceNumber}`}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              />
            )}
            {!useCustomName && (
              <div style={{ fontSize: '0.75rem', color: '#6b7280', paddingLeft: '1.5rem' }}>
                Будет использовано: Прайс {nextPriceNumber}
              </div>
            )}
          </div>

          {/* Ошибка */}
          {error && (
            <div
              style={{
                padding: '0.75rem',
                marginBottom: '1rem',
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
              onClick={handleCreate}
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
              Создать
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
