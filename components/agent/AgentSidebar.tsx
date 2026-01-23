'use client'

import { useState, useEffect } from 'react'

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

interface AgentSidebarProps {
  conversations: Conversation[]
  activeConversationId: string | null
  onSelectConversation: (id: string) => void
  onCreateNew: () => void
  loading?: boolean
}

export default function AgentSidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onCreateNew,
  loading = false,
}: AgentSidebarProps) {
  return (
    <div
      style={{
        width: '260px',
        height: '100%',
        background: '#202123',
        color: '#ececf1',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #4d4d4f',
      }}
    >
      {/* Кнопка "Новый чат" */}
      <div style={{ padding: '0.75rem', borderBottom: '1px solid #4d4d4f' }}>
        <button
          type="button"
          onClick={onCreateNew}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: 'transparent',
            border: '1px solid #4d4d4f',
            color: '#ececf1',
            fontSize: '0.875rem',
            cursor: 'pointer',
            borderRadius: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#343541'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <span>+</span>
          <span>Новый чат</span>
        </button>
      </div>

      {/* Список чатов */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0.5rem 0',
        }}
      >
        {loading && conversations.length === 0 ? (
          <div style={{ padding: '1rem', color: '#8e8ea0', fontSize: '0.875rem', textAlign: 'center' }}>
            Загрузка...
          </div>
        ) : conversations.length === 0 ? (
          <div style={{ padding: '1rem', color: '#8e8ea0', fontSize: '0.875rem', textAlign: 'center' }}>
            Нет чатов
          </div>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.id}
              type="button"
              onClick={() => onSelectConversation(conv.id)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                background: activeConversationId === conv.id ? '#343541' : 'transparent',
                border: 'none',
                color: '#ececf1',
                fontSize: '0.875rem',
                textAlign: 'left',
                cursor: 'pointer',
                borderRadius: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (activeConversationId !== conv.id) {
                  e.currentTarget.style.background = '#2f2f2f'
                }
              }}
              onMouseLeave={(e) => {
                if (activeConversationId !== conv.id) {
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              {conv.title || 'Новый чат'}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
