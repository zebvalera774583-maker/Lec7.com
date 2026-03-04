'use client'

import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'

interface AiSpecData {
  spec: string
  actions: string | null
  changelog: string | null
}

const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '1.5rem', marginBottom: '1rem' }}>
      {children}
    </h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginTop: '1.25rem', marginBottom: '0.75rem' }}>
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: '1rem', marginBottom: '0.5rem' }}>
      {children}
    </h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p style={{ marginBottom: '1rem', lineHeight: 1.6 }}>{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem', listStyleType: 'disc' }}>{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol style={{ marginLeft: '1.5rem', marginBottom: '1rem', listStyleType: 'decimal' }}>{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li style={{ marginBottom: '0.5rem' }}>{children}</li>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong style={{ fontWeight: 600 }}>{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em style={{ fontStyle: 'italic' }}>{children}</em>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
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
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre
      style={{
        background: '#f5f5f5',
        padding: '1rem',
        borderRadius: '6px',
        overflow: 'auto',
        fontSize: '0.875rem',
        marginBottom: '1rem',
      }}
    >
      {children}
    </pre>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
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
  hr: () => <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '1.5rem 0' }} />,
}

function MarkdownBlock({ content }: { content: string }) {
  return (
    <div style={{ lineHeight: 1.6 }}>
      <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown>
    </div>
  )
}

export default function AiSpecPage() {
  const [data, setData] = useState<AiSpecData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/tech/ai-spec')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ width: '100%' }}>
        <h1 style={{ marginBottom: '0.5rem', fontSize: '1.875rem', fontWeight: 700 }}>
          ТЗ AI агента
        </h1>
        <p style={{ color: '#6b7280' }}>Загрузка...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ width: '100%' }}>
        <h1 style={{ marginBottom: '0.5rem', fontSize: '1.875rem', fontWeight: 700 }}>
          ТЗ AI агента
        </h1>
        <p style={{ color: '#dc2626' }}>{error}</p>
      </div>
    )
  }

  if (!data) return null

  return (
    <div style={{ width: '100%', maxWidth: '900px' }}>
      <h1 style={{ marginBottom: '0.5rem', fontSize: '1.875rem', fontWeight: 700 }}>
        ТЗ AI агента
      </h1>
      <p style={{ margin: '0 0 1.5rem 0', color: '#6b7280', fontSize: '1rem' }}>
        Спецификация AI Orchestrator. Источник: <code>docs/ai-orchestrator-spec.md</code>
      </p>

      <div
        style={{
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '1.5rem 2rem',
          marginBottom: '2rem',
        }}
      >
        {data.spec ? (
          <MarkdownBlock content={data.spec} />
        ) : (
          <p style={{ color: '#6b7280' }}>Файл спецификации не найден.</p>
        )}
      </div>

      {data.actions && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ marginBottom: '0.75rem', fontSize: '1.25rem', fontWeight: 600 }}>
            AI Actions (детализация)
          </h2>
          <div
            style={{
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '1.5rem 2rem',
            }}
          >
            <MarkdownBlock content={data.actions} />
          </div>
        </div>
      )}

      {data.changelog && (
        <div>
          <h2 style={{ marginBottom: '0.75rem', fontSize: '1.25rem', fontWeight: 600 }}>
            Изменения
          </h2>
          <div
            style={{
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '1.5rem 2rem',
            }}
          >
            <MarkdownBlock content={data.changelog} />
          </div>
        </div>
      )}
    </div>
  )
}
