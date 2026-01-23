'use client'

import { useEffect, useRef } from 'react'
import AgentMessage from './AgentMessage'
import AgentComposer from './AgentComposer'

interface Message {
  id: string
  role: 'USER' | 'ASSISTANT'
  content: string
  createdAt: string
}

interface AgentChatProps {
  conversationId: string | null
  messages: Message[]
  loading?: boolean
  onSendMessage: (content: string) => Promise<void>
}

export default function AgentChat({
  conversationId,
  messages,
  loading = false,
  onSendMessage,
}: AgentChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (!conversationId) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ffffff',
          color: '#6b7280',
          fontSize: '1rem',
        }}
      >
        Выберите чат или создайте новый
      </div>
    )
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: '#ffffff',
        height: '100%',
      }}
    >
      {/* Область сообщений */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '2rem 0',
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
            {loading ? 'Загрузка сообщений...' : 'Начните диалог'}
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <AgentMessage key={message.id} role={message.role} content={message.content} />
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

      {/* Композер */}
      <AgentComposer onSend={onSendMessage} disabled={loading} />
    </div>
  )
}
