'use client'

import { useState, useEffect, useRef } from 'react'

type Step = 'idle' | 'parsed' | 'need_date' | 'catalog_choice' | 'ready_for_draft'

interface DraftItem {
  name: string
  quantity: string
  unit: string
  canonicalName?: string
  catalogItemId?: string | null
  needsUserChoice?: boolean
}

interface SessionState {
  step: Step
  draft: {
    items: DraftItem[]
    plannedForDate?: string
    resolvedChoiceIndices: number[]
  } | null
}

interface Message {
  id: string
  role: 'USER' | 'ASSISTANT'
  content: string
}

const btnStyle = {
  padding: '0.5rem 1rem',
  marginRight: '0.5rem',
  marginTop: '0.5rem',
  background: '#0070f3',
  color: '#ffffff',
  border: 'none',
  borderRadius: 0,
  fontSize: '0.875rem',
  cursor: 'pointer' as const,
}

export default function AdminOrchestratorChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionState, setSessionState] = useState<SessionState>({
    step: 'idle',
    draft: null,
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sessionState])

  const addBotMessage = (content: string) => {
    setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'ASSISTANT', content }])
  }

  const getProblematicIndices = (items: DraftItem[]): number[] => {
    return items
      .map((item, idx) => (item.needsUserChoice || !item.catalogItemId ? idx : -1))
      .filter((i) => i >= 0)
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'USER', content: text }])
    setSessionState({ step: 'idle', draft: null })
    setLoading(true)

    try {
      const res = await fetch('/api/ai/orchestrator', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })

      if (!res.ok) {
        addBotMessage('Ошибка связи, попробуйте ещё раз.')
        return
      }

      const data = (await res.json()) as {
        intent?: string
        message?: string
        items?: DraftItem[]
      }

      if (data.intent === 'create_needs' && data.items?.length) {
        const items = data.items
        addBotMessage(
          'Распознал позиции. На какую дату закуп: Сегодня / Завтра?\n\n' +
            items.map((i) => `• ${i.canonicalName || i.name} — ${i.quantity} ${i.unit}`).join('\n')
        )
        setSessionState({
          step: 'need_date',
          draft: { items, resolvedChoiceIndices: [] },
        })
      } else {
        addBotMessage(data.message ?? 'AI Orchestrator MVP active')
      }
    } catch {
      addBotMessage('Ошибка связи, попробуйте ещё раз.')
    } finally {
      setLoading(false)
    }
  }

  const handleDateChoice = (plannedForDate: string) => {
    const draft = sessionState.draft
    if (!draft || sessionState.step !== 'need_date') return

    const problematic = getProblematicIndices(draft.items)

    if (problematic.length === 0) {
      addBotMessage('Ок. Создать черновик потребности?')
      setSessionState({
        step: 'ready_for_draft',
        draft: { ...draft, plannedForDate },
      })
    } else {
      const firstIdx = problematic[0]
      const item = draft.items[firstIdx]
      addBotMessage(`Что вы имели в виду под «${item.name}»?`)
      setSessionState({
        step: 'catalog_choice',
        draft: { ...draft, plannedForDate },
      })
    }
  }

  const handleCatalogChoice = (_choice: 'keep') => {
    const draft = sessionState.draft
    if (!draft || sessionState.step !== 'catalog_choice') return

    const problematic = getProblematicIndices(draft.items)
    const resolvedSet = new Set(draft.resolvedChoiceIndices)
    const currentUnresolved = problematic.find((i) => !resolvedSet.has(i))
    if (currentUnresolved === undefined) return

    const resolved = [...draft.resolvedChoiceIndices, currentUnresolved]
    const stillUnresolved = problematic.filter((i) => !resolved.includes(i))

    if (stillUnresolved.length > 0) {
      const nextIdx = stillUnresolved[0]
      const item = draft.items[nextIdx]
      addBotMessage(`Что вы имели в виду под «${item.name}»?`)
      setSessionState({
        step: 'catalog_choice',
        draft: { ...draft, resolvedChoiceIndices: resolved },
      })
    } else {
      addBotMessage('Ок. Создать черновик потребности?')
      setSessionState({
        step: 'ready_for_draft',
        draft: { ...draft, resolvedChoiceIndices: resolved },
      })
    }
  }

  const handleCreateDraft = () => {
    addBotMessage('(Черновик пока не создаётся — только диалог)')
    setSessionState({ step: 'idle', draft: null })
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

            {sessionState.step === 'need_date' && (
              <div style={{ marginBottom: '1.5rem', marginLeft: 0 }}>
                <button style={btnStyle} onClick={() => handleDateChoice('today')}>
                  Сегодня
                </button>
                <button style={btnStyle} onClick={() => handleDateChoice('tomorrow')}>
                  Завтра
                </button>
              </div>
            )}

            {sessionState.step === 'catalog_choice' && (
              <div style={{ marginBottom: '1.5rem', marginLeft: 0 }}>
                <button style={btnStyle} onClick={() => handleCatalogChoice('keep')}>
                  Оставить как есть
                </button>
              </div>
            )}

            {sessionState.step === 'ready_for_draft' && (
              <div style={{ marginBottom: '1.5rem', marginLeft: 0 }}>
                <button style={btnStyle} onClick={handleCreateDraft}>
                  Создать черновик
                </button>
              </div>
            )}

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
