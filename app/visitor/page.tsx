'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import BusinessCardLink from '@/components/BusinessCardLink'

export default function VisitorPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const [businesses, setBusinesses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [city, setCity] = useState(searchParams.get('city') || '')
  const [category, setCategory] = useState(searchParams.get('category') || '')

  // Получаем уникальные города и категории
  const cities = useMemo(() => {
    const citySet = new Set<string>()
    businesses.forEach(b => {
      if (b.city) citySet.add(b.city)
    })
    return Array.from(citySet).sort()
  }, [businesses])

  const categories = useMemo(() => {
    const categorySet = new Set<string>()
    businesses.forEach(b => {
      if (b.category) categorySet.add(b.category)
    })
    return Array.from(categorySet).sort()
  }, [businesses])

  // Загружаем бизнесы
  useEffect(() => {
    loadBusinesses()
  }, [])

  // Обновляем URL и загружаем при изменении фильтров
  useEffect(() => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (city) params.set('city', city)
    if (category) params.set('category', category)
    
    const queryString = params.toString()
    router.push(queryString ? `/visitor?${queryString}` : '/visitor', { scroll: false })
    
    loadBusinesses()
  }, [search, city, category])

  const loadBusinesses = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (city) params.set('city', city)
      if (category) params.set('category', category)

      const response = await fetch(`/api/businesses?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setBusinesses(data)
      }
    } catch (error) {
      console.error('Error loading businesses:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
  }

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCity(e.target.value)
  }

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategory(e.target.value)
  }

  const clearFilters = () => {
    setSearch('')
    setCity('')
    setCategory('')
  }

  return (
    <main style={{ 
      minHeight: '100vh',
      background: '#ffffff',
      padding: '2rem'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <header style={{ marginBottom: '3rem' }}>
          <Link 
            href="/"
            style={{
              display: 'inline-block',
              marginBottom: '2rem',
              color: '#0070f3',
              textDecoration: 'none',
              fontSize: '1rem'
            }}
          >
            ← На главную
          </Link>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: '700',
            color: '#1a1a1a',
            margin: 0
          }}>
            Предложения бизнесов
          </h1>
        </header>

        {/* Фильтры */}
        <div style={{
          marginBottom: '2rem',
          padding: '1.5rem',
          background: '#f5f5f5',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Поиск по названию..."
              value={search}
              onChange={handleSearchChange}
              style={{
                flex: '1',
                minWidth: '200px',
                padding: '0.75rem',
                border: '1px solid #e0e0e0',
                borderRadius: '6px',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
            />
            
            <select
              value={city}
              onChange={handleCityChange}
              style={{
                padding: '0.75rem',
                border: '1px solid #e0e0e0',
                borderRadius: '6px',
                fontSize: '1rem',
                minWidth: '150px',
                background: 'white',
                boxSizing: 'border-box'
              }}
            >
              <option value="">Все города</option>
              {cities.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select
              value={category}
              onChange={handleCategoryChange}
              style={{
                padding: '0.75rem',
                border: '1px solid #e0e0e0',
                borderRadius: '6px',
                fontSize: '1rem',
                minWidth: '150px',
                background: 'white',
                boxSizing: 'border-box'
              }}
            >
              <option value="">Все категории</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {(search || city || category) && (
              <button
                onClick={clearFilters}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#666',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
              >
                Сбросить
              </button>
            )}
          </div>
        </div>

        {/* Результаты */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#666' }}>
            <p>Загрузка...</p>
          </div>
        ) : businesses.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '2rem'
          }}>
            {businesses.map((business) => (
              <BusinessCardLink key={business.id} business={business} />
            ))}
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            color: '#666'
          }}>
            <p style={{ fontSize: '1.1rem' }}>
              {search || city || category 
                ? 'Ничего не найдено по заданным фильтрам'
                : 'Пока нет зарегистрированных бизнесов'}
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
