'use client'

import { useState, useEffect, useRef } from 'react'

interface Message {
  id: string
  role: 'USER' | 'ASSISTANT'
  content: string
}

export default function AdminOrchestratorChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'USER', content: text }])
    setLoading(true)

    try {
      const res = await fetch('/api/ai/orchestrator', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: 'ASSISTANT', content: 'Ошибка связи, попробуйте ещё раз.' },
        ])
        return
      }

      const data = (await res.json()) as {
        intent?: string
        message?: string
        items?: Array<{ name: string; quantity: string; unit: string; canonicalName?: string }>
      }

      let content: string
      if (data.intent === 'create_needs' && data.items?.length) {
        content =
          'Распознанные позиции:\n' +
          data.items.map((i) => `• ${i.canonicalName || i.name} — ${i.quantity} ${i.unit}`).join('\n')
      } else {
        content = data.message ?? 'AI Orchestrator MVP active'
      }

      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'ASSISTANT', content }])
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'ASSISTANT', content: 'Ошибка связи, попробуйте ещё раз.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 200px)',
        minHeight: '600px',
        background: '#ffffff',
        borderRadius: 0,
      }}
    >
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '2rem',
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#9ca3af',
              fontSize: '0.9375rem',
            }}
          >
            {loading ? 'Загрузка...' : 'Начните диалог'}
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'USER' ? 'flex-end' : 'flex-start',
                  marginBottom: '1.5rem',
                }}
              >
                <div
                  style={{
                    maxWidth: '85%',
                    padding: '0.75rem 1rem',
                    background: msg.role === 'USER' ? '#0070f3' : '#f7f7f8',
                    color: msg.role === 'USER' ? '#ffffff' : '#353740',
                    fontSize: '0.9375rem',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ padding: '0 1rem', color: '#9ca3af', fontSize: '0.9375rem' }}>
                Агент печатает...
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

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
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Спросите что-нибудь..."
            disabled={loading}
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
              lineHeight: 1.5,
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement
              target.style.height = 'auto'
              target.style.height = `${Math.min(target.scrollHeight, 200)}px`
            }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={loading || !input.trim()}
            style={{
              padding: '0.75rem 1.5rem',
              background: loading || !input.trim() ? '#d1d5db' : '#0070f3',
              color: loading || !input.trim() ? '#9ca3af' : '#ffffff',
              border: 'none',
              borderRadius: 0,
              fontSize: '0.9375rem',
              fontWeight: 500,
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Отправить
          </button>
        </div>
      </div>
    </div>
  )
}
