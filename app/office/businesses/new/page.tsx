'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { isLatinOnly } from '@/lib/slug'

export default function NewBusinessPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [nameError, setNameError] = useState('')

  const handleNameChange = (value: string) => {
    setName(value)
    if (value && !isLatinOnly(value)) {
      setNameError('Название бизнеса должно содержать только латинские буквы, цифры, пробелы и дефисы')
    } else {
      setNameError('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      setError('Название бизнеса обязательно')
      return
    }

    // Валидация латиницы
    if (!isLatinOnly(name.trim())) {
      setError('Название бизнеса должно содержать только латинские буквы, цифры, пробелы и дефисы')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/businesses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ name: name.trim() }),
      })

      if (!response.ok) {
        const data = await response.json()
        
        // Обработка 400: неверное имя (латиница)
        if (response.status === 400 && data.error === 'INVALID_NAME_LATIN_ONLY') {
          setError(data.message || 'Название бизнеса должно содержать только латинские буквы, цифры, пробелы и дефисы')
          setLoading(false)
          return
        }
        
        // Обработка 409: бизнес уже существует
        if (response.status === 409 && data.error === 'BUSINESS_ALREADY_EXISTS') {
          // Показываем сообщение
          setError('У вас уже есть бизнес. Открываем кабинет.')
          
          // Редирект на существующий бизнес или в кабинет
          if (data.businessId) {
            setTimeout(() => {
              router.push(`/office/businesses/${data.businessId}`)
            }, 1500)
          } else {
            setTimeout(() => {
              router.push('/office')
            }, 1500)
          }
          return
        }
        
        throw new Error(data.error || 'Ошибка создания бизнеса')
      }

      // Редирект в /office после успешного создания
      router.push('/office')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания бизнеса')
      setLoading(false)
    }
  }

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link 
          href="/office" 
          style={{ 
            color: '#666', 
            textDecoration: 'underline',
            display: 'inline-block',
            marginBottom: '1rem'
          }}
        >
          ← Назад в кабинет
        </Link>
      </div>

      <h1 style={{ marginBottom: '1rem' }}>Создать бизнес</h1>
      
      <p style={{ 
        color: '#666', 
        marginBottom: '2rem',
        fontSize: '1rem',
        lineHeight: '1.6'
      }}>
        Заполните данные, чтобы создать бизнес на Lec7.
      </p>

      <form 
        onSubmit={handleSubmit}
        style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '8px',
          border: '1px solid #e0e0e0',
          maxWidth: '600px'
        }}
      >
        {error && (
          <div style={{
            padding: '0.75rem',
            marginBottom: '1rem',
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            borderRadius: '4px',
            color: '#be123c',
            fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: '1.5rem' }}>
          <label 
            htmlFor="name"
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '500',
              fontSize: '0.9rem'
            }}
          >
            Название бизнеса <span style={{ color: '#ef4444' }}>*</span>
          </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              disabled={loading}
              placeholder="My Business"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: nameError ? '1px solid #ef4444' : '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '1rem',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = nameError ? '#ef4444' : '#0070f3'}
              onBlur={(e) => e.currentTarget.style.borderColor = nameError ? '#ef4444' : '#d1d5db'}
            />
            {nameError && (
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: '#ef4444' }}>
                {nameError}
              </p>
            )}
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: '#666' }}>
              Только латинские буквы, цифры, пробелы и дефисы
            </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '0.75rem 1.5rem',
            background: loading ? '#94a3b8' : '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '1rem',
            fontWeight: '500',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s'
          }}
        >
          {loading ? 'Создание...' : 'Создать'}
        </button>
      </form>
    </main>
  )
}
