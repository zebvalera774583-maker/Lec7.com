'use client'

import { useEffect, useState } from 'react'

type Conversation = {
  id: string
  title: string | null
  createdAt: string
}

type Message = {
  id: string
  role: string
  content: string
  createdAt: string
}

export default function OwnerAIPanel() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  const loadConversations = async () => {
    try {
      setError(null)
      const res = await fetch('/api/owner/conversations', {
        method: 'GET',
      })
      if (res.status === 403) {
        setError('Нет доступа к owner-панели')
        return
      }
      if (!res.ok) {
        throw new Error('Ошибка загрузки диалогов')
      }
      const data = (await res.json()) as Conversation[]
      setConversations(data)
      if (data.length > 0 && !activeConversationId) {
        setActiveConversationId(data[0].id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки диалогов')
    }
  }

  const loadMessages = async (conversationId: string) => {
    try {
      setError(null)
      const res = await fetch(`/api/owner/conversations/${conversationId}/messages`)
      if (res.status === 403) {
        setError('Нет доступа к owner-панели')
        return
      }
      if (!res.ok) {
        throw new Error('Ошибка загрузки сообщений')
      }
      const data = (await res.json()) as Message[]
      setMessages(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки сообщений')
    }
  }

  useEffect(() => {
    void loadConversations()
  }, [])

  useEffect(() => {
    if (activeConversationId) {
      void loadMessages(activeConversationId)
    } else {
      setMessages([])
    }
  }, [activeConversationId])

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id)
  }

  const handleNewConversation = async () => {
    try {
      setError(null)
      const res = await fetch('/api/owner/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Новый диалог' }),
      })
      if (res.status === 403) {
        setError('Нет доступа к owner-панели')
        return
      }
      if (!res.ok) {
        throw new Error('Ошибка создания диалога')
      }
      const conv = (await res.json()) as Conversation
      setConversations((prev) => [conv, ...prev])
      setActiveConversationId(conv.id)
      setMessages([])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка создания диалога')
    }
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return

    setLoading(true)
    setError(null)

    try {
      let conversationId = activeConversationId

      // Если диалога ещё нет — создаём его на лету
      if (!conversationId) {
        const title =
          input.trim().length > 50 ? input.trim().slice(0, 47) + '...' : input.trim()
        const resConv = await fetch('/api/owner/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title }),
        })
        if (resConv.status === 403) {
          setError('Нет доступа к owner-панели')
          setLoading(false)
          return
        }
        if (!resConv.ok) {
          throw new Error('Не удалось создать диалог')
        }
        const conv = (await resConv.json()) as Conversation
        setConversations((prev) => [conv, ...prev])
        conversationId = conv.id
        setActiveConversationId(conv.id)
      }

      const content = input.trim()
      setInput('')

      const resMsg = await fetch(`/api/owner/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, content }),
      })
      if (resMsg.status === 403) {
        setError('Нет доступа к owner-панели')
        return
      }
      if (!resMsg.ok) {
        throw new Error('Не удалось сохранить сообщение')
      }

      const data = (await resMsg.json()) as { messages: Message[] }
      setMessages((prev) => [...prev, ...data.messages])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка отправки сообщения')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        overflow: 'hidden',
        background: 'white',
      }}
    >
      {/* Заголовок / управление */}
      <div
        style={{
          padding: '0.5rem 0.75rem',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>AI Console</div>
          <div
            style={{
              marginTop: '0.15rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.15rem 0.4rem',
              borderRadius: '999px',
              background: '#ecfdf5',
              border: '1px solid #bbf7d0',
              fontSize: '0.7rem',
              color: '#15803d',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: '6px',
                height: '6px',
                borderRadius: '999px',
                background: '#22c55e',
              }}
            />
            <span>Advisory</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: '999px',
            padding: '0.25rem 0.6rem',
            background: '#f9fafb',
            fontSize: '0.75rem',
            cursor: 'pointer',
          }}
        >
          {collapsed ? 'Открыть' : 'Свернуть'}
        </button>
      </div>

      {!collapsed && (
        <div
          style={{
            display: 'flex',
            flex: 1,
            minHeight: '320px',
          }}
        >
        {/* Список диалогов */}
        <div
          style={{
            width: '220px',
            borderRight: '1px solid #e0e0e0',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
        <div
          style={{
            padding: '0.75rem 1rem',
            borderBottom: '1px solid #e0e0e0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontWeight: 600 }}>Диалоги</span>
          <button
            onClick={handleNewConversation}
            style={{
              padding: '0.25rem 0.5rem',
              fontSize: '0.875rem',
              borderRadius: '4px',
              border: '1px solid #e0e0e0',
              background: '#f5f5f5',
              cursor: 'pointer',
            }}
          >
            +
          </button>
        </div>
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
          }}
        >
          {conversations.length === 0 ? (
            <div
              style={{
                padding: '1rem',
                fontSize: '0.9rem',
                color: '#777',
              }}
            >
              Диалогов пока нет. Напишите первое сообщение, чтобы начать.
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => handleSelectConversation(conv.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.75rem 1rem',
                  border: 'none',
                  borderBottom: '1px solid #f0f0f0',
                  background:
                    conv.id === activeConversationId ? '#eef3ff' : 'transparent',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                }}
              >
                <div
                  style={{
                    fontWeight: conv.id === activeConversationId ? 600 : 500,
                    marginBottom: '0.25rem',
                  }}
                >
                  {conv.title || 'Без названия'}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#888' }}>
                  {new Date(conv.createdAt).toLocaleString()}
                </div>
              </button>
            ))
          )}
        </div>
        </div>

        {/* Сообщения */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1rem',
            background: '#fafafa',
          }}
        >
          {error && (
            <div
              style={{
                marginBottom: '0.75rem',
                padding: '0.5rem 0.75rem',
                borderRadius: '4px',
                background: '#fee2e2',
                color: '#b91c1c',
                fontSize: '0.9rem',
              }}
            >
              {error}
            </div>
          )}

          {messages.length === 0 && !error ? (
            <div
              style={{
                marginTop: '2rem',
                textAlign: 'center',
                color: '#777',
                fontSize: '0.95rem',
              }}
            >
              История пока пуста. Напишите первое сообщение, чтобы зафиксировать
              задачу или мысль.
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  marginBottom: '0.75rem',
                  textAlign: msg.role === 'user' ? 'right' : 'left',
                }}
              >
                <div
                  style={{
                    display: 'inline-block',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    background:
                      msg.role === 'user' ? '#3b82f6' : 'white',
                    color: msg.role === 'user' ? 'white' : '#111827',
                    maxWidth: '80%',
                    fontSize: '0.95rem',
                    border:
                      msg.role === 'user'
                        ? 'none'
                        : '1px solid #e5e7eb',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))
          )}

          {loading && (
            <div
              style={{
                marginTop: '0.5rem',
                textAlign: 'left',
                color: '#777',
                fontSize: '0.9rem',
              }}
            >
              Сохранение...
            </div>
          )}
          <div
            style={{
              padding: '0.75rem 1rem',
              borderTop: '1px solid #e0e0e0',
              background: 'white',
            }}
          >
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void handleSend()
                  }
                }}
                placeholder="Напишите задачу, мысль или запрос..."
                style={{
                  flex: 1,
                  padding: '0.5rem 0.75rem',
                  borderRadius: '4px',
                  border: '1px solid #e0e0e0',
                  fontSize: '0.95rem',
                }}
                disabled={loading}
              />
              <button
                onClick={() => void handleSend()}
                disabled={loading || !input.trim()}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '4px',
                  border: 'none',
                  background:
                    loading || !input.trim() ? '#9ca3af' : '#2563eb',
                  color: 'white',
                  fontWeight: 500,
                  cursor:
                    loading || !input.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                Отправить
              </button>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  )
}

