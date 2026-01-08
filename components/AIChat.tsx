'use client'

import { useState } from 'react'

interface AIChatProps {
  businessId: string
  businessName: string
}

export default function AIChat({ businessId, businessName }: AIChatProps) {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          messages: [...messages, { role: 'user', content: userMessage }],
        }),
      })

      const data = await response.json()

      if (data.error) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Извините, произошла ошибка. Попробуйте позже.' },
        ])
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.response }])

        // Если AI предложил создать заявку
        if (data.shouldCreateRequest && data.requestData) {
          const createRequest = confirm('Создать заявку на основе этого диалога?')
          if (createRequest) {
            await fetch('/api/requests', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                businessId,
                ...data.requestData,
              }),
            })
            alert('Заявка создана! Мы свяжемся с вами в ближайшее время.')
          }
        }
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Извините, произошла ошибка. Попробуйте позже.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: 'white',
      borderRadius: '8px',
      padding: '1.5rem',
      maxWidth: '600px',
    }}>
      <h3 style={{ marginBottom: '1rem' }}>Чат с AI-ассистентом</h3>

      <div style={{
        height: '400px',
        overflowY: 'auto',
        border: '1px solid #e0e0e0',
        borderRadius: '4px',
        padding: '1rem',
        marginBottom: '1rem',
        background: '#f9f9f9',
      }}>
        {messages.length === 0 ? (
          <p style={{ color: '#666', textAlign: 'center', marginTop: '2rem' }}>
            Начните диалог, задав вопрос
          </p>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                marginBottom: '1rem',
                textAlign: msg.role === 'user' ? 'right' : 'left',
              }}
            >
              <div
                style={{
                  display: 'inline-block',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  background: msg.role === 'user' ? '#0070f3' : 'white',
                  color: msg.role === 'user' ? 'white' : 'black',
                  maxWidth: '80%',
                  border: msg.role === 'assistant' ? '1px solid #e0e0e0' : 'none',
                }}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div style={{ textAlign: 'left', color: '#666' }}>
            <div style={{ display: 'inline-block', padding: '0.75rem 1rem' }}>...</div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Введите сообщение..."
          style={{
            flex: 1,
            padding: '0.75rem',
            border: '1px solid #e0e0e0',
            borderRadius: '4px',
          }}
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !input.trim() ? 0.5 : 1,
          }}
        >
          Отправить
        </button>
      </div>
    </div>
  )
}
