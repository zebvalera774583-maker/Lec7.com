'use client'

import { useState } from 'react'

interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  url: string
  title: string
}

export default function ShareModal({ isOpen, onClose, url, title }: ShareModalProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => {
        setCopied(false)
        onClose()
      }, 1500)
    } catch (err) {
      console.error('Failed to copy:', err)
      // Fallback для старых браузеров
      const textArea = document.createElement('textarea')
      textArea.value = url
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => {
          setCopied(false)
          onClose()
        }, 1500)
      } catch (err) {
        console.error('Fallback copy failed:', err)
      }
      document.body.removeChild(textArea)
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
        onClick={onClose}
      >
        {/* Modal */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 0,
            padding: '2rem',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.5rem', fontWeight: 600, color: '#111827' }}>
            Поделиться
          </h2>

          <div style={{ marginBottom: '1.5rem' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: '#111827',
              }}
            >
              Ссылка на витрину
            </label>
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
              }}
            >
              <input
                type="text"
                value={url}
                readOnly
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: 0,
                  fontSize: '0.9rem',
                  background: '#f9fafb',
                  color: '#111827',
                }}
              />
              <button
                type="button"
                onClick={handleCopy}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: '1px solid #4b6fae',
                  borderRadius: 0,
                  background: copied ? '#10b981' : '#4b6fae',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'background-color 0.2s',
                }}
              >
                {copied ? '✓ Скопировано' : 'Копировать'}
              </button>
            </div>
          </div>

          {copied && (
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
              Ссылка скопирована в буфер обмена!
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.75rem 1.5rem',
                border: '1px solid #d1d5db',
                borderRadius: 0,
                background: '#ffffff',
                color: '#111827',
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
