'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type Conversation = {
  id: string
  title?: string | null
  createdAt?: string
  updatedAt?: string
}

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt?: string
}

export default function OwnerAIPanel() {
  const [collapsed, setCollapsed] = useState(false)

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) || null,
    [conversations, activeConversationId]
  )

  // Загрузка диалогов при монтировании
  useEffect(() => {
    ;(async () => {
      try {
        setError('')
        const res = await fetch('/api/owner/conversations', { method: 'GET' })
        if (res.status === 403) {
          setError('Нет доступа к owner-панели')
          return
        }
        if (!res.ok) throw new Error('Не удалось загрузить диалоги')

        const data = (await res.json()) as Conversation[]
        setConversations(data || [])
        if ((data || []).length > 0) {
          setActiveConversationId(data[0].id)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки диалогов')
      }
    })()
  }, [])

  // Загрузка сообщений при смене активного диалога
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([])
      return
    }

    ;(async () => {
      try {
        setError('')
        const res = await fetch(`/api/owner/conversations/${activeConversationId}/messages`, {
          method: 'GET',
        })
        if (res.status === 403) {
          setError('Нет доступа к owner-панели')
          return
        }
        if (!res.ok) throw new Error('Не удалось загрузить сообщения')

        const data = (await res.json()) as Message[] | { messages: Message[] }
        const list = Array.isArray(data) ? data : data.messages
        setMessages(list || [])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки сообщений')
      }
    })()
  }, [activeConversationId])

  // Автоскролл вниз
  useEffect(() => {
    if (!collapsed) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, collapsed])

  const createConversation = async (title?: string) => {
    try {
      setError('')
      const res = await fetch('/api/owner/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title ?? 'Новый диалог' }),
      })
      if (res.status === 403) {
        setError('Нет доступа к owner-панели')
        return null
      }
      if (!res.ok) throw new Error('Не удалось создать диалог')

      const conv = (await res.json()) as Conversation
      setConversations((prev) => [conv, ...prev])
      setActiveConversationId(conv.id)
      return conv.id
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка создания диалога')
      return null
    }
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return

    try {
      setLoading(true)
      setError('')

      let conversationId = activeConversationId

      // Если ещё нет диалога — создаём
      if (!conversationId) {
        const newId = await createConversation(text.length > 50 ? `${text.slice(0, 47)}...` : text)
        if (!newId) return
        conversationId = newId
      }

      setInput('')

      const resMsg = await fetch(`/api/owner/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      })

      if (resMsg.status === 403) {
        setError('Нет доступа к owner-панели')
        return
      }
      if (!resMsg.ok) throw new Error('Не удалось сохранить сообщение')

      const data = (await resMsg.json()) as { messages: Message[] }
      setMessages((prev) => [...prev, ...(data.messages || [])])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка отправки сообщения')
    } finally {
      setLoading(false)
    }
  }

  // Свернутое состояние
  if (collapsed) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid #e5e7eb',
          background: '#fff',
        }}
      >
        <div
          style={{
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>AI Console</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Advisory</div>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            style={{ padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}
          >
            Открыть
          </button>
        </div>
      </div>
    )
  }

  // Полная панель
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid #e5e7eb',
        background: '#fff',
      }}
    >
      {/* Заголовок */}
      <div
        style={{
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>AI Console</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Advisory (только советы)</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => void createConversation()}
            style={{ padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}
          >
            Новый
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            style={{ padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}
          >
            Свернуть
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Список диалогов */}
        <div
          style={{
            width: 190,
            borderRight: '1px solid #e5e7eb',
            overflow: 'auto',
          }}
        >
          {conversations.length === 0 ? (
            <div style={{ padding: 12, fontSize: 13, opacity: 0.7 }}>Нет диалогов</div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveConversationId(c.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 12px',
                  border: 'none',
                  borderBottom: '1px solid #f1f5f9',
                  background: c.id === activeConversationId ? '#f8fafc' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {c.title || 'Диалог'}
                </div>
                <div style={{ fontSize: 11, opacity: 0.6 }}>
                  {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ''}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Чат */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ flex: 1, overflow: 'auto', padding: 12, background: '#fff' }}>
            {error && (
              <div
                style={{
                  padding: 10,
                  background: '#fff1f2',
                  border: '1px solid #fecdd3',
                  borderRadius: 8,
                  marginBottom: 10,
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            {messages.length === 0 && !error ? (
              <div style={{ fontSize: 13, opacity: 0.7 }}>
                Напиши задачу. Я в advisory-режиме: дам (1) диагноз, (2) шаги для Cursor, (3) шаги для Timeweb/SSH.
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      maxWidth: '85%',
                      whiteSpace: 'pre-wrap',
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: m.role === 'user' ? '#e0f2fe' : '#f8fafc',
                      border: '1px solid #e5e7eb',
                      fontSize: 13,
                      lineHeight: 1.35,
                    }}
                  >
                    {m.content}
                  </div>
                </div>
              ))
            )}

            <div ref={messagesEndRef} />
          </div>

          <div
            style={{
              borderTop: '1px solid #e5e7eb',
              padding: 10,
              display: 'flex',
              gap: 8,
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={activeConversation ? 'Сообщение…' : 'Начни новый диалог…'}
              style={{
                flex: 1,
                padding: '10px 12px',
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                fontSize: 13,
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  if (!loading) void sendMessage()
                }
              }}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={loading}
              style={{
                padding: '10px 12px',
                fontSize: 13,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? '...' : 'Отправить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
