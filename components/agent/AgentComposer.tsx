'use client'

import { useState, KeyboardEvent } from 'react'

interface AgentComposerProps {
  onSend: (message: string) => void
  disabled?: boolean
}

export default function AgentComposer({ onSend, disabled = false }: AgentComposerProps) {
  const [message, setMessage] = useState('')

  const handleSubmit = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim())
      setMessage('')
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div
      style={{
        padding: '1rem',
        borderTop: '1px solid #e5e7eb',
        background: '#ffffff',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'flex-end',
          maxWidth: '768px',
          margin: '0 auto',
        }}
      >
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Спросите что-нибудь..."
          disabled={disabled}
          rows={1}
          style={{
            flex: 1,
            padding: '0.75rem',
            border: '1px solid #d1d5db',
            borderRadius: 0,
            fontSize: '0.9375rem',
            fontFamily: 'inherit',
            resize: 'none',
            minHeight: '44px',
            maxHeight: '200px',
            lineHeight: '1.5',
          }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement
            target.style.height = 'auto'
            target.style.height = `${Math.min(target.scrollHeight, 200)}px`
          }}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || !message.trim()}
          style={{
            padding: '0.75rem 1.5rem',
            background: disabled || !message.trim() ? '#d1d5db' : '#0070f3',
            color: disabled || !message.trim() ? '#9ca3af' : '#ffffff',
            border: 'none',
            borderRadius: 0,
            fontSize: '0.9375rem',
            fontWeight: 500,
            cursor: disabled || !message.trim() ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Отправить
        </button>
      </div>
      <div
        style={{
          marginTop: '0.5rem',
          fontSize: '0.75rem',
          color: '#6b7280',
          textAlign: 'center',
        }}
      >
        Enter для отправки, Shift+Enter для новой строки
      </div>
    </div>
  )
}
