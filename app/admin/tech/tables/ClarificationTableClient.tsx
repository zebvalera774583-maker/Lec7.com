'use client'

import { useState, useEffect } from 'react'

type Row = { id: string; word: string; question: string }

export default function ClarificationTableClient() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [word, setWord] = useState('')
  const [question, setQuestion] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRows = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/clarification-questions', { credentials: 'include' })
      const data = await res.json()
      if (res.ok) setRows(data)
      else setError(data.error || 'Ошибка загрузки')
    } catch {
      setError('Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRows()
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!word.trim() || !question.trim()) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/clarification-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ word: word.trim(), question: question.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setRows((prev) => [...prev, data].sort((a, b) => a.word.localeCompare(b.word, 'ru')))
        setWord('')
        setQuestion('')
      } else {
        setError(data.error || 'Ошибка')
      }
    } catch {
      setError('Ошибка')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/clarification-questions/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) setRows((prev) => prev.filter((r) => r.id !== id))
    } catch {
      setError('Ошибка удаления')
    }
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{ marginBottom: '1rem', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
        Справочник: слово → вопрос
      </div>
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Слово</label>
          <input
            type="text"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="перец"
            style={{ padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.875rem', minWidth: '120px' }}
          />
        </div>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Вопрос</label>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="перец красный, перец желтый, перец зеленый?"
            style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.875rem' }}
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !word.trim() || !question.trim()}
          style={{
            padding: '0.5rem 1rem',
            background: submitting ? '#9ca3af' : '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: submitting ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          {submitting ? '...' : 'Добавить'}
        </button>
      </form>
      {error && <p style={{ marginBottom: '0.5rem', color: '#dc2626', fontSize: '0.875rem' }}>{error}</p>}
      {loading ? (
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Загрузка...</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px', background: 'white' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr>
                <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500 }}>Слово</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500 }}>Вопрос</th>
                <th style={{ padding: '0.75rem', width: '60px', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>{r.word}</td>
                  <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', fontStyle: 'italic', color: '#92400e' }}>{r.question}</td>
                  <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>
                    <button
                      type="button"
                      onClick={() => handleDelete(r.id)}
                      style={{
                        padding: '0.25rem 0.5rem',
                        background: 'none',
                        border: '1px solid #e5e7eb',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        color: '#dc2626',
                      }}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ padding: '1rem', color: '#9ca3af', fontSize: '0.875rem', textAlign: 'center' }}>
                    Нет записей. Добавьте слово и вопрос выше.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
