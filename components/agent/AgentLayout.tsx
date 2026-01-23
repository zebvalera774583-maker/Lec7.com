'use client'

import { useState, useEffect } from 'react'
import AgentSidebar from './AgentSidebar'
import AgentChat from './AgentChat'

interface Conversation {
  id: string
  title: string | null
  scope: string
  mode: string
  updatedAt: string
  _count?: {
    messages: number
  }
}

interface Message {
  id: string
  role: 'USER' | 'ASSISTANT'
  content: string
  createdAt: string
}

export default function AgentLayout() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)

  // Загрузка списка чатов
  useEffect(() => {
    loadConversations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Загрузка сообщений при выборе чата
  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId)
    } else {
      setMessages([])
    }
  }, [activeConversationId])

  const loadConversations = async () => {
    try {
      setLoadingConversations(true)
      const res = await fetch('/api/agent/conversations?scope=PLATFORM')
      if (!res.ok) throw new Error('Failed to load conversations')
      const data = await res.json()
      setConversations(data.conversations || [])
      
      // Автоматически выбрать первый чат, если есть
      if (data.conversations && data.conversations.length > 0 && !activeConversationId) {
        setActiveConversationId(data.conversations[0].id)
      }
    } catch (error) {
      console.error('Error loading conversations:', error)
    } finally {
      setLoadingConversations(false)
    }
  }

  const loadMessages = async (conversationId: string) => {
    try {
      setLoadingMessages(true)
      const res = await fetch(`/api/agent/conversations/${conversationId}/messages`)
      if (!res.ok) throw new Error('Failed to load messages')
      const data = await res.json()
      setMessages(data.messages || [])
    } catch (error) {
      console.error('Error loading messages:', error)
    } finally {
      setLoadingMessages(false)
    }
  }

  const handleCreateNew = async () => {
    try {
      const res = await fetch('/api/agent/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'PLATFORM',
          mode: 'CREATOR',
        }),
      })
      if (!res.ok) throw new Error('Failed to create conversation')
      const data = await res.json()
      const newConversation = data.conversation
      
      // Добавляем новый чат в список и выбираем его
      setConversations((prev) => [newConversation, ...prev])
      setActiveConversationId(newConversation.id)
      setMessages([])
    } catch (error) {
      console.error('Error creating conversation:', error)
    }
  }

  const handleSendMessage = async (content: string) => {
    if (!activeConversationId || !content.trim()) return

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'USER',
      content,
      createdAt: new Date().toISOString(),
    }

    // Optimistic UI: сразу показываем сообщение пользователя
    setMessages((prev) => [...prev, userMessage])
    setSendingMessage(true)

    try {
      const res = await fetch(`/api/agent/conversations/${activeConversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })

      if (!res.ok) throw new Error('Failed to send message')

      const data = await res.json()
      
      // Заменяем временное сообщение на реальное и добавляем ответ
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== userMessage.id)
        return [
          ...filtered,
          {
            id: data.userMessage.id,
            role: data.userMessage.role as 'USER',
            content: data.userMessage.content,
            createdAt: data.userMessage.createdAt,
          },
          {
            id: data.assistantMessage.id,
            role: data.assistantMessage.role as 'ASSISTANT',
            content: data.assistantMessage.content,
            createdAt: data.assistantMessage.createdAt,
          },
        ]
      })

      // Обновляем список чатов, чтобы обновить updatedAt
      await loadConversations()
    } catch (error) {
      console.error('Error sending message:', error)
      // Удаляем временное сообщение при ошибке
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id))
    } finally {
      setSendingMessage(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        height: 'calc(100vh - 200px)',
        minHeight: '600px',
        background: '#ffffff',
        borderRadius: 0,
      }}
    >
      <AgentSidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={setActiveConversationId}
        onCreateNew={handleCreateNew}
        loading={loadingConversations}
      />
      <AgentChat
        conversationId={activeConversationId}
        messages={messages}
        loading={sendingMessage || loadingMessages}
        onSendMessage={handleSendMessage}
      />
    </div>
  )
}
