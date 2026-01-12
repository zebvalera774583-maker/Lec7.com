'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'

interface OwnerAgentResponse {
  mode: 'NEXT_STEP' | 'CURSOR_TASK' | 'RISK_CHECK'
  answer: string
}

interface OwnerAgentClientProps {
  gitBranch?: string
  environment: string
  notesPath: string
  tasksPath: string
}

export default function OwnerAgentClient({
  gitBranch,
  environment,
  notesPath,
  tasksPath,
}: OwnerAgentClientProps) {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<OwnerAgentResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!message.trim()) {
      setError('Сообщение не может быть пустым')
      return
    }

    setLoading(true)
    setError(null)
    setResponse(null)

    try {
      const res = await fetch('/api/owner-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Ошибка сервера' }))
        throw new Error(errorData.error || `HTTP ${res.status}`)
      }

      const data = await res.json() as OwnerAgentResponse
      setResponse(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка')
    } finally {
      setLoading(false)
    }
  }

  const getModeLabel = (mode: OwnerAgentResponse['mode']) => {
    switch (mode) {
      case 'NEXT_STEP':
        return 'Следующий шаг'
      case 'CURSOR_TASK':
        return 'Задание для Cursor'
      case 'RISK_CHECK':
        return 'Проверка рисков'
      default:
        return mode
    }
  }

  const getModeColor = (mode: OwnerAgentResponse['mode']) => {
    switch (mode) {
      case 'NEXT_STEP':
        return '#0070f3'
      case 'CURSOR_TASK':
        return '#10b981'
      case 'RISK_CHECK':
        return '#f59e0b'
      default:
        return '#666'
    }
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ marginBottom: '2rem', fontSize: '2rem', fontWeight: '700' }}>
        Owner Agent
      </h1>

      {/* Контекст */}
      <div
        style={{
          marginBottom: '2rem',
          padding: '1rem',
          background: '#f5f5f5',
          borderRadius: '8px',
          fontSize: '0.875rem',
          color: '#666',
        }}
      >
        <div style={{ marginBottom: '0.5rem' }}>
          <strong>Контекст:</strong>
        </div>
        <div style={{ marginLeft: '1rem' }}>
          {gitBranch && (
            <div>
              <strong>Git branch:</strong> {gitBranch}
            </div>
          )}
          <div>
            <strong>Environment:</strong> {environment}
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <strong>Файлы памяти:</strong>
            <div style={{ marginLeft: '1rem', marginTop: '0.25rem' }}>
              <div>{notesPath}</div>
              <div>{tasksPath}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Форма */}
      <form onSubmit={handleSubmit} style={{ marginBottom: '2rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Напиши задачу или вопрос..."
            rows={6}
            style={{
              width: '100%',
              padding: '1rem',
              border: '1px solid #e0e0e0',
              borderRadius: '6px',
              fontSize: '1rem',
              fontFamily: 'inherit',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          disabled={loading || !message.trim()}
          style={{
            padding: '0.75rem 1.5rem',
            background: loading || !message.trim() ? '#999' : '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '1rem',
            fontWeight: '500',
            cursor: loading || !message.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Обработка...' : 'Сформировать план / ответ'}
        </button>
      </form>

      {/* Ошибка */}
      {error && (
        <div
          style={{
            marginBottom: '2rem',
            padding: '1rem',
            background: '#fee',
            border: '1px solid #fcc',
            borderRadius: '6px',
            color: '#c33',
          }}
        >
          <strong>Ошибка:</strong> {error}
        </div>
      )}

      {/* Ответ */}
      {response && (
        <div
          style={{
            marginTop: '2rem',
            padding: '1.5rem',
            background: 'white',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
          }}
        >
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.5rem 1rem',
              background: getModeColor(response.mode),
              color: 'white',
              borderRadius: '4px',
              display: 'inline-block',
              fontSize: '0.875rem',
              fontWeight: '600',
            }}
          >
            {getModeLabel(response.mode)}
          </div>

          <div
            style={{
              marginTop: '1rem',
              lineHeight: '1.6',
            }}
            className="markdown-content"
          >
            <ReactMarkdown
              components={{
                h1: ({ children }) => (
                  <h1 style={{ fontSize: '1.75rem', fontWeight: '700', marginTop: '1.5rem', marginBottom: '1rem' }}>
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginTop: '1.25rem', marginBottom: '0.75rem' }}>
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginTop: '1rem', marginBottom: '0.5rem' }}>
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p style={{ marginBottom: '1rem' }}>{children}</p>
                ),
                ul: ({ children }) => (
                  <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem', listStyleType: 'disc' }}>
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol style={{ marginLeft: '1.5rem', marginBottom: '1rem', listStyleType: 'decimal' }}>
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li style={{ marginBottom: '0.5rem' }}>{children}</li>
                ),
                strong: ({ children }) => (
                  <strong style={{ fontWeight: '600' }}>{children}</strong>
                ),
                em: ({ children }) => (
                  <em style={{ fontStyle: 'italic' }}>{children}</em>
                ),
                code: ({ children }) => (
                  <code
                    style={{
                      background: '#f5f5f5',
                      padding: '0.125rem 0.375rem',
                      borderRadius: '3px',
                      fontSize: '0.875em',
                      fontFamily: 'monospace',
                    }}
                  >
                    {children}
                  </code>
                ),
                blockquote: ({ children }) => (
                  <blockquote
                    style={{
                      borderLeft: '4px solid #e0e0e0',
                      paddingLeft: '1rem',
                      marginLeft: 0,
                      marginBottom: '1rem',
                      color: '#666',
                    }}
                  >
                    {children}
                  </blockquote>
                ),
              }}
            >
              {response.answer}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}
