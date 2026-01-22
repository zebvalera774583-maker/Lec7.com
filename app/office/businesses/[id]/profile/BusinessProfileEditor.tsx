'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { isLatinOnly } from '@/lib/slug'
import imageCompression from 'browser-image-compression'

interface BusinessProfileEditorProps {
  businessId: string
  businessSlug: string
}

interface BusinessProfile {
  id: string
  businessId: string
  displayName: string | null
  avatarUrl: string | null
  phone: string | null
  telegramUsername: string | null
  statsCases: number
  statsProjects: number
  statsCities: number
  cities: string[]
  services: string[]
}

interface BusinessPhoto {
  id: string
  url: string
  sortOrder: number
  createdAt: string
}

interface PortfolioItemPhoto {
  id: string
  url: string
  sortOrder: number
  createdAt: string
}

interface PortfolioItem {
  id: string
  businessId: string
  title: string | null
  comment: string | null
  coverUrl: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
  photos: PortfolioItemPhoto[]
}

export default function BusinessProfileEditor({
  businessId,
  businessSlug: initialSlug,
}: BusinessProfileEditorProps) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [phone, setPhone] = useState('')
  const [telegramUsername, setTelegramUsername] = useState('')
  const [cities, setCities] = useState<string[]>([])
  const [services, setServices] = useState<string[]>([])
  const [featuredServices, setFeaturedServices] = useState<string[]>(['', '', '', ''])
  const [metrics, setMetrics] = useState({
    cases: 40,
    projects: 2578,
    cities: 4,
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [displayNameError, setDisplayNameError] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [photos, setPhotos] = useState<BusinessPhoto[]>([])
  const [loadingPhotos, setLoadingPhotos] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [compressingPhoto, setCompressingPhoto] = useState(false)
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null)
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([])
  const [loadingPortfolioItems, setLoadingPortfolioItems] = useState(false)
  const [savingCommentItemId, setSavingCommentItemId] = useState<string | null>(null)
  const [uploadingPhotosItemId, setUploadingPhotosItemId] = useState<string | null>(null)
  const [compressingPhotosItemId, setCompressingPhotosItemId] = useState<string | null>(null)
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null)

  // Загрузка профиля при монтировании
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/office/businesses/${businessId}/profile`, {
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('Не удалось загрузить профиль')
        }

        const profile: BusinessProfile = await response.json()
        setDisplayName(profile.displayName || '')
        setAvatarUrl(profile.avatarUrl || '')
        setPhone(profile.phone || '')
        setTelegramUsername(profile.telegramUsername || '')
        setCities(profile.cities || [])
        setServices(profile.services || [])
        // Заполняем featuredServices из старых данных (обратная совместимость)
        const existingServices = profile.services || []
        const featured = [...existingServices.slice(0, 4), '', '', '', ''].slice(0, 4)
        setFeaturedServices(featured)
        setMetrics({
          cases: profile.statsCases,
          projects: profile.statsProjects,
          cities: profile.statsCities,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки профиля')
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
    loadPhotos()
    loadPortfolioItems()
  }, [businessId])

  // Загрузка фото портфолио
  const loadPhotos = async () => {
    try {
      setLoadingPhotos(true)
      const response = await fetch(`/api/office/businesses/${businessId}/photos`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Не удалось загрузить фото')
      }

      const photosData: BusinessPhoto[] = await response.json()
      setPhotos(photosData)
    } catch (err) {
      console.error('Failed to load photos:', err)
    } finally {
      setLoadingPhotos(false)
    }
  }

  // Загрузка кейсов портфолио
  const loadPortfolioItems = async () => {
    try {
      setLoadingPortfolioItems(true)
      const response = await fetch(`/api/office/businesses/${businessId}/portfolio-items`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Не удалось загрузить кейсы')
      }

      const itemsData: PortfolioItem[] = await response.json()
      setPortfolioItems(itemsData)
    } catch (err) {
      console.error('Failed to load portfolio items:', err)
    } finally {
      setLoadingPortfolioItems(false)
    }
  }

  // Создание нового кейса
  const handleCreatePortfolioItem = async () => {
    try {
      const response = await fetch(`/api/office/businesses/${businessId}/portfolio-items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ comment: '' }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Ошибка создания кейса')
      }

      const newItem: PortfolioItem = await response.json()
      setPortfolioItems([...portfolioItems, newItem])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания кейса')
    }
  }

  // Сохранение комментария кейса (с debounce)
  const commentSaveTimeouts = new Map<string, NodeJS.Timeout>()

  const handleCommentChange = (itemId: string, comment: string) => {
    // Обновляем локальное состояние сразу
    setPortfolioItems((items) =>
      items.map((item) => (item.id === itemId ? { ...item, comment } : item))
    )

    // Очищаем предыдущий timeout
    const existingTimeout = commentSaveTimeouts.get(itemId)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    // Устанавливаем новый timeout для сохранения через 800ms
    const timeout = setTimeout(async () => {
      setSavingCommentItemId(itemId)
      try {
        const response = await fetch(`/api/office/businesses/${businessId}/portfolio-items/${itemId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ comment }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Ошибка сохранения комментария')
        }

        const updatedItem: PortfolioItem = await response.json()
        setPortfolioItems((items) => items.map((item) => (item.id === itemId ? updatedItem : item)))
      } catch (err) {
        console.error('Failed to save comment:', err)
      } finally {
        setSavingCommentItemId(null)
        commentSaveTimeouts.delete(itemId)
      }
    }, 800)

    commentSaveTimeouts.set(itemId, timeout)
  }

  // Удаление кейса
  const handleDeletePortfolioItem = async (itemId: string) => {
    if (!confirm('Удалить этот кейс? Все фото будут удалены.')) return

    setDeletingItemId(itemId)
    setError('')

    try {
      const response = await fetch(`/api/office/businesses/${businessId}/portfolio-items/${itemId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Ошибка удаления кейса')
      }

      setPortfolioItems(portfolioItems.filter((item) => item.id !== itemId))
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления кейса')
    } finally {
      setDeletingItemId(null)
    }
  }

  // Загрузка фото в кейс (multiple)
  const handlePortfolioItemPhotosUpload = async (itemId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    // Проверка типов файлов
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setError('Все файлы должны быть изображениями')
        return
      }
    }

    // Проверка лимита фото на кейс
    const item = portfolioItems.find((i) => i.id === itemId)
    if (item && item.photos.length + files.length > 12) {
      setError(`Максимум 12 фото на кейс. Уже загружено: ${item.photos.length}`)
      return
    }

    setCompressingPhotosItemId(itemId)
    setError('')

    try {
      // Сжимаем все файлы
      const compressedFiles: File[] = []
      for (const file of files) {
        // Используем отдельную функцию сжатия для множественных файлов
        const maxSize = 5 * 1024 * 1024 // 5MB
        let fileToCompress = file

        if (file.size > maxSize) {
          const hasAlpha = await checkPngAlpha(file)
          const fileType = hasAlpha ? 'image/png' : 'image/jpeg'
          const originalName = file.name
          const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '')
          const newFileName = fileType === 'image/jpeg' ? `${nameWithoutExt}.jpg` : originalName

          const qualityLevels = [0.82, 0.72, 0.65]
          let compressed = null

          for (const quality of qualityLevels) {
            const options = {
              maxSizeMB: 5,
              maxWidthOrHeight: 1920,
              useWebWorker: true,
              fileType: fileType,
              initialQuality: quality,
            }

            const compressedFile = await imageCompression(file, options)
            if (compressedFile.size <= maxSize) {
              compressed = new File([compressedFile], newFileName, {
                type: fileType,
                lastModified: Date.now(),
              })
              break
            }
          }

          if (!compressed || compressed.size > maxSize) {
            throw new Error('Фото слишком большое даже после сжатия, выберите другое')
          }

          fileToCompress = compressed
        }

        compressedFiles.push(fileToCompress)
      }

      setCompressingPhotosItemId(null)
      setUploadingPhotosItemId(itemId)

      // Загружаем все файлы
      const formData = new FormData()
      compressedFiles.forEach((file) => {
        formData.append('files', file)
      })

      const response = await fetch(`/api/office/businesses/${businessId}/portfolio-items/${itemId}/photos`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Ошибка загрузки фото')
      }

      const result = await response.json()
      const newPhotos: PortfolioItemPhoto[] = result.photos

      // Обновляем кейс с новыми фото
      setPortfolioItems((items) =>
        items.map((item) =>
          item.id === itemId
            ? {
                ...item,
                photos: [...item.photos, ...newPhotos].sort((a, b) => a.sortOrder - b.sortOrder),
              }
            : item
        )
      )

      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки фото')
    } finally {
      setCompressingPhotosItemId(null)
      setUploadingPhotosItemId(null)
      event.target.value = ''
    }
  }

  // Удаление фото из кейса
  const handleDeletePortfolioItemPhoto = async (itemId: string, photoId: string) => {
    setDeletingPhotoId(photoId)
    setError('')

    try {
      const response = await fetch(
        `/api/office/businesses/${businessId}/portfolio-items/${itemId}/photos/${photoId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Ошибка удаления фото')
      }

      setPortfolioItems((items) =>
        items.map((item) =>
          item.id === itemId ? { ...item, photos: item.photos.filter((p) => p.id !== photoId) } : item
        )
      )

      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления фото')
    } finally {
      setDeletingPhotoId(null)
    }
  }

  // Индикатор веса страницы (MVP)
  const pageWeight =
    (avatarUrl ? 0.3 : 0) + photos.length * 0.5 + (displayName ? 0.2 : 0)

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value)
    if (value && !isLatinOnly(value)) {
      setDisplayNameError('Отображаемое имя должно содержать только латинские буквы, цифры, пробелы и дефисы')
    } else {
      setDisplayNameError('')
    }
  }

  const handleSave = async () => {
    // Валидация перед сохранением
    if (displayName && !isLatinOnly(displayName)) {
      setError('Отображаемое имя должно содержать только латинские буквы, цифры, пробелы и дефисы')
      return
    }

    setSaving(true)
    setError('')
    setSuccess(false)

    try {
      const response = await fetch(`/api/office/businesses/${businessId}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          displayName: displayName || null,
          avatarUrl: avatarUrl || null,
          phone: phone || null,
          telegramUsername: telegramUsername || null,
          statsCases: metrics.cases,
          statsProjects: metrics.projects,
          statsCities: metrics.cities,
          cities,
          services,
          featuredServices: featuredServices.filter((s) => s.trim() !== '').slice(0, 4),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Ошибка сохранения профиля')
      }

      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        router.refresh()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения профиля')
    } finally {
      setSaving(false)
    }
  }

  const handleAddCity = () => {
    const city = prompt('Введите название города:')
    if (city && !cities.includes(city)) {
      setCities([...cities, city])
    }
  }

  const handleRemoveCity = (city: string) => {
    setCities(cities.filter((c) => c !== city))
  }

  const handleToggleService = (service: string) => {
    if (services.includes(service)) {
      setServices(services.filter((s) => s !== service))
    } else {
      setServices([...services, service])
    }
  }

  const handleFeaturedServiceChange = (index: number, value: string) => {
    const newServices = [...featuredServices]
    newServices[index] = value
    setFeaturedServices(newServices)
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Проверка типа файла
    if (!file.type.startsWith('image/')) {
      setError('Файл должен быть изображением')
      return
    }

    setUploadingAvatar(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/office/businesses/${businessId}/profile/avatar`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Ошибка загрузки аватара')
      }

      const data = await response.json()
      setAvatarUrl(data.avatarUrl)
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки аватара')
    } finally {
      setUploadingAvatar(false)
      // Сбрасываем input, чтобы можно было загрузить тот же файл снова
      event.target.value = ''
    }
  }

  /**
   * Проверяет, есть ли у PNG изображения альфа-канал (прозрачность)
   */
  const checkPngAlpha = async (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      if (file.type !== 'image/png') {
        resolve(false)
        return
      }

      const img = new Image()
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { willReadFrequently: true })

      if (!ctx) {
        resolve(false)
        return
      }

      const objectUrl = URL.createObjectURL(file)

      img.onload = () => {
        try {
          canvas.width = img.width
          canvas.height = img.height
          ctx.drawImage(img, 0, 0)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const data = imageData.data

          // Проверяем альфа-канал (каждый 4-й байт, начиная с индекса 3)
          // Проверяем только первые 10000 пикселей для производительности
          const maxPixelsToCheck = Math.min(10000, data.length / 4)
          for (let i = 0; i < maxPixelsToCheck; i++) {
            const alphaIndex = i * 4 + 3
            if (data[alphaIndex] < 255) {
              // Найдена прозрачность
              URL.revokeObjectURL(objectUrl)
              resolve(true)
              return
            }
          }
          URL.revokeObjectURL(objectUrl)
          resolve(false)
        } catch (error) {
          URL.revokeObjectURL(objectUrl)
          resolve(false)
        }
      }

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        resolve(false)
      }

      img.src = objectUrl
    })
  }

  /**
   * Сжимает изображение, если оно больше 5MB
   */
  const compressIfNeeded = async (file: File): Promise<File> => {
    const maxSize = 5 * 1024 * 1024 // 5MB

    // Если файл уже <= 5MB, возвращаем как есть
    if (file.size <= maxSize) {
      return file
    }

    setCompressingPhoto(true)

    try {
      // Проверяем, есть ли у PNG альфа-канал
      const hasAlpha = await checkPngAlpha(file)
      const fileType = hasAlpha ? 'image/png' : 'image/jpeg'

      // Определяем имя файла с правильным расширением
      const originalName = file.name
      const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '')
      const newFileName = fileType === 'image/jpeg' ? `${nameWithoutExt}.jpg` : originalName

      // Пробуем разные уровни качества
      const qualityLevels = [0.82, 0.72, 0.65]

      for (const quality of qualityLevels) {
        const options = {
          maxSizeMB: 5,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
          fileType: fileType,
          initialQuality: quality,
        }

        const compressedFile = await imageCompression(file, options)

        // Если получилось уложиться в 5MB, возвращаем
        if (compressedFile.size <= maxSize) {
          // Создаём новый File с правильным именем
          const finalFile = new File([compressedFile], newFileName, {
            type: fileType,
            lastModified: Date.now(),
          })
          setCompressingPhoto(false)
          return finalFile
        }
      }

      // Если не удалось уложиться даже с минимальным качеством
      setCompressingPhoto(false)
      throw new Error('Фото слишком большое даже после сжатия, выберите другое')
    } catch (error) {
      setCompressingPhoto(false)
      if (error instanceof Error && error.message.includes('слишком большое')) {
        throw error
      }
      throw new Error('Ошибка сжатия изображения: ' + (error instanceof Error ? error.message : 'неизвестная ошибка'))
    }
  }

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Проверка типа файла
    if (!file.type.startsWith('image/')) {
      setError('Файл должен быть изображением')
      return
    }

    // Проверка лимита фото (максимум 12)
    if (photos.length >= 12) {
      setError('Максимум 12 фото')
      return
    }

    setError('')

    try {
      // Сжимаем фото, если нужно
      const fileToUpload = await compressIfNeeded(file)

      setUploadingPhoto(true)

      const formData = new FormData()
      formData.append('file', fileToUpload)

      const response = await fetch(`/api/office/businesses/${businessId}/photos`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Ошибка загрузки фото')
      }

      const newPhoto: BusinessPhoto = await response.json()
      setPhotos([...photos, newPhoto])
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки фото')
    } finally {
      setUploadingPhoto(false)
      setCompressingPhoto(false)
      // Сбрасываем input
      event.target.value = ''
    }
  }

  const handlePhotoDelete = async (photoId: string) => {
    if (!confirm('Удалить это фото?')) return

    setDeletingPhotoId(photoId)
    setError('')

    try {
      const response = await fetch(`/api/office/businesses/${businessId}/photos/${photoId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Ошибка удаления фото')
      }

      setPhotos(photos.filter((p) => p.id !== photoId))
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления фото')
    } finally {
      setDeletingPhotoId(null)
    }
  }


  if (loading) {
    return (
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p>Загрузка профиля...</p>
        </div>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      {/* Шапка */}
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: avatarUrl ? `url(${avatarUrl})` : '#e5e7eb',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              border: '2px solid #e5e7eb',
            }}
          />
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>{displayName || 'Бизнес'}</h1>
            <p style={{ margin: 0, color: '#666', fontSize: '0.875rem' }}>/{initialSlug}</p>
          </div>
        </div>
        <Link
          href={`/office/businesses/${businessId}/preview`}
          target="_blank"
          style={{
            padding: '0.5rem 1rem',
            background: '#0070f3',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '4px',
            fontSize: '0.875rem',
          }}
        >
          Открыть витрину →
        </Link>
      </div>

      {/* Сообщения об ошибках/успехе */}
      {error && (
        <div
          style={{
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            borderRadius: '4px',
            color: '#be123c',
            fontSize: '0.875rem',
          }}
        >
          {error}
        </div>
      )}
      {success && (
        <div
          style={{
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            background: '#d1fae5',
            border: '1px solid #86efac',
            borderRadius: '4px',
            color: '#065f46',
            fontSize: '0.875rem',
          }}
        >
          Профиль успешно сохранён
        </div>
      )}

      {/* Индикатор веса */}
      <div
        style={{
          padding: '1rem',
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '8px',
          marginBottom: '2rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.875rem', color: '#0369a1' }}>Вес страницы:</span>
          <span style={{ fontSize: '1rem', fontWeight: 600, color: '#0369a1' }}>
            {pageWeight.toFixed(1)} / 10
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        {/* Основной контент */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Аватар */}
          <section style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Аватар бизнеса</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <label
                htmlFor="avatar-upload"
                style={{
                  width: '100px',
                  height: '100px',
                  borderRadius: '9999px',
                  border: '2px solid #e5e7eb',
                  cursor: uploadingAvatar ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                  background: avatarUrl ? 'transparent' : '#e5e7eb',
                  flexShrink: 0,
                }}
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt="Аватар бизнеса"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      borderRadius: '9999px',
                    }}
                  />
                ) : (
                  <span style={{ fontSize: '0.75rem', color: '#666', textAlign: 'center', padding: '0.5rem' }}>
                    {uploadingAvatar ? 'Загрузка...' : 'А'}
                  </span>
                )}
                {uploadingAvatar && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'rgba(0, 0, 0, 0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '9999px',
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', color: 'white', textAlign: 'center', fontWeight: 500 }}>
                      Загрузка...
                    </span>
                  </div>
                )}
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  disabled={uploadingAvatar}
                  style={{
                    position: 'absolute',
                    width: 0,
                    height: 0,
                    opacity: 0,
                    overflow: 'hidden',
                    zIndex: -1,
                  }}
                />
              </label>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <label
                    htmlFor="avatar-upload"
                    style={{
                      padding: '0.5rem 1rem',
                      background: uploadingAvatar ? '#94a3b8' : '#0070f3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                      cursor: uploadingAvatar ? 'wait' : 'pointer',
                      textDecoration: 'none',
                      display: 'inline-block',
                    }}
                  >
                    {uploadingAvatar ? 'Загрузка...' : 'Загрузить аватар'}
                  </label>
                </div>
                <input
                  type="text"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="URL аватара (или загрузите файл)"
                  readOnly={false}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                    marginBottom: '0.5rem',
                  }}
                />
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#666' }}>
                  Нажмите кнопку выше или вставьте URL вручную
                </p>
              </div>
            </div>
          </section>

          {/* Логотип / имя */}
          <section style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Логотип / имя</h2>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                Отображаемое имя бизнеса
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => handleDisplayNameChange(e.target.value)}
                placeholder="Valeriy Zebelyan"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: displayNameError ? '1px solid #ef4444' : '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '1rem',
                }}
              />
              {displayNameError && (
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: '#ef4444' }}>
                  {displayNameError}
                </p>
              )}
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: '#666' }}>
                Только латинские буквы, цифры, пробелы и дефисы
              </p>
            </div>
          </section>

          {/* Контакты */}
          <section style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Контакты</h2>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                Номер телефона
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7 (999) 123-45-67"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '1rem',
                }}
              />
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: '#666' }}>
                Будет отображаться в кнопке &quot;Связаться&quot; на витрине
              </p>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                Telegram username
              </label>
              <input
                type="text"
                value={telegramUsername}
                onChange={(e) => setTelegramUsername(e.target.value)}
                placeholder="@username"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '1rem',
                }}
              />
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: '#666' }}>
                Без символа @, например: username
              </p>
            </div>
          </section>

          {/* Портфолио кейсы */}
          <section style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Портфолио</h2>
              <button
                onClick={handleCreatePortfolioItem}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#0070f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                + Добавить кейс
              </button>
            </div>
            {loadingPortfolioItems ? (
              <p style={{ color: '#666', fontSize: '0.875rem' }}>Загрузка кейсов...</p>
            ) : portfolioItems.length === 0 ? (
              <p style={{ color: '#666', fontSize: '0.875rem' }}>Нет кейсов. Добавьте первый кейс.</p>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '1.5rem',
                }}
              >
                {portfolioItems.map((item) => {
                  const coverPhoto = item.coverUrl
                    ? item.photos.find((p) => p.url === item.coverUrl) || null
                    : item.photos[0] || null
                  const previewPhotos = item.photos.slice(0, 4)

                  return (
                    <div
                      key={item.id}
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '1rem',
                        background: '#f9fafb',
                      }}
                    >
                      {/* Превью фото (первые 4) */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(2, 1fr)',
                          gap: '0.5rem',
                          marginBottom: '1rem',
                          aspectRatio: '1',
                        }}
                      >
                        {previewPhotos.length > 0 ? (
                          previewPhotos.map((photo, idx) => (
                            <div
                              key={photo.id}
                              style={{
                                position: 'relative',
                                borderRadius: '4px',
                                overflow: 'hidden',
                                background: '#e5e7eb',
                                border: coverPhoto && coverPhoto.id === photo.id ? '2px solid #0070f3' : '1px solid #d1d5db',
                              }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={photo.url}
                                alt={`Фото ${idx + 1}`}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                }}
                              />
                              <button
                                onClick={() => handleDeletePortfolioItemPhoto(item.id, photo.id)}
                                disabled={deletingPhotoId === photo.id}
                                style={{
                                  position: 'absolute',
                                  top: '0.25rem',
                                  right: '0.25rem',
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '50%',
                                  background: deletingPhotoId === photo.id ? '#94a3b8' : 'rgba(0, 0, 0, 0.7)',
                                  color: 'white',
                                  border: 'none',
                                  cursor: deletingPhotoId === photo.id ? 'not-allowed' : 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.75rem',
                                  lineHeight: 1,
                                  fontWeight: 600,
                                }}
                              >
                                ×
                              </button>
                            </div>
                          ))
                        ) : (
                          <div
                            style={{
                              gridColumn: '1 / -1',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: '#e5e7eb',
                              borderRadius: '4px',
                              color: '#6b7280',
                              fontSize: '0.875rem',
                            }}
                          >
                            Нет фото
                          </div>
                        )}
                      </div>

                      {/* Комментарий */}
                      <textarea
                        value={item.comment || ''}
                        onChange={(e) => handleCommentChange(item.id, e.target.value)}
                        placeholder="Добавьте комментарий к кейсу..."
                        disabled={savingCommentItemId === item.id}
                        style={{
                          width: '100%',
                          minHeight: '60px',
                          padding: '0.5rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '0.875rem',
                          resize: 'vertical',
                          marginBottom: '0.75rem',
                          fontFamily: 'inherit',
                        }}
                      />
                      {savingCommentItemId === item.id && (
                        <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.75rem', color: '#666' }}>Сохранение...</p>
                      )}

                      {/* Загрузка фото */}
                      <div style={{ marginBottom: '0.75rem' }}>
                        <label
                          htmlFor={`portfolio-photos-${item.id}`}
                          style={{
                            display: 'block',
                            padding: '0.5rem',
                            background:
                              uploadingPhotosItemId === item.id || compressingPhotosItemId === item.id
                                ? '#94a3b8'
                                : '#f3f4f6',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            cursor:
                              uploadingPhotosItemId === item.id || compressingPhotosItemId === item.id
                                ? 'not-allowed'
                                : 'pointer',
                            textAlign: 'center',
                            color: '#374151',
                          }}
                        >
                          {compressingPhotosItemId === item.id
                            ? 'Сжимаем фото...'
                            : uploadingPhotosItemId === item.id
                              ? 'Загрузка...'
                              : item.photos.length >= 12
                                ? 'Лимит: 12 фото'
                                : '+ Загрузить фото'}
                        </label>
                        <input
                          id={`portfolio-photos-${item.id}`}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => handlePortfolioItemPhotosUpload(item.id, e)}
                          disabled={
                            uploadingPhotosItemId === item.id ||
                            compressingPhotosItemId === item.id ||
                            item.photos.length >= 12
                          }
                          style={{
                            position: 'absolute',
                            width: 0,
                            height: 0,
                            opacity: 0,
                            overflow: 'hidden',
                            zIndex: -1,
                          }}
                        />
                      </div>

                      {/* Удалить кейс */}
                      <button
                        onClick={() => handleDeletePortfolioItem(item.id)}
                        disabled={deletingItemId === item.id}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          background: deletingItemId === item.id ? '#94a3b8' : '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          cursor: deletingItemId === item.id ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {deletingItemId === item.id ? 'Удаление...' : 'Удалить кейс'}
                      </button>

                      <p style={{ marginTop: '0.5rem', marginBottom: 0, fontSize: '0.75rem', color: '#666' }}>
                        Фото: {item.photos.length} / 12
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Метрики */}
          <section style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Метрики</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                  Уникальных кейсов
                </label>
                <input
                  type="number"
                  value={metrics.cases}
                  onChange={(e) => setMetrics({ ...metrics, cases: parseInt(e.target.value) || 0 })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                  Проектов
                </label>
                <input
                  type="number"
                  value={metrics.projects}
                  onChange={(e) => setMetrics({ ...metrics, projects: parseInt(e.target.value) || 0 })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                  Городов
                </label>
                <input
                  type="number"
                  value={metrics.cities}
                  onChange={(e) => setMetrics({ ...metrics, cities: parseInt(e.target.value) || 0 })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                  }}
                />
              </div>
            </div>
          </section>

          {/* Города */}
          <section style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Города присутствия</h2>
              <button
                onClick={handleAddCity}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#0070f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                + Добавить
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {cities.map((city) => (
                <div
                  key={city}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    background: '#f3f4f6',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                  }}
                >
                  <span>{city}</span>
                  <button
                    onClick={() => handleRemoveCity(city)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#666',
                      fontSize: '1.25rem',
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Услуги или товары */}
          <section style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h2 style={{ marginBottom: '0.5rem', fontSize: '1.125rem' }}>Услуги или товары</h2>
            <p
              style={{
                margin: '0 0 1rem 0',
                fontSize: '0.875rem',
                color: '#6b7280',
                lineHeight: 1.5,
              }}
            >
              Добавьте до 4 основных услуг или товаров — они будут показаны на главном экране вашей страницы
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[0, 1, 2, 3].map((index) => (
                <input
                  key={index}
                  type="text"
                  value={featuredServices[index] || ''}
                  onChange={(e) => handleFeaturedServiceChange(index, e.target.value)}
                  placeholder={`Услуга или товар ${index + 1}`}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit',
                  }}
                />
              ))}
            </div>
          </section>
        </div>

        {/* Боковая панель */}
        <div>
          <div
            style={{
              background: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              position: 'sticky',
              top: '2rem',
            }}
          >
            <button
              onClick={handleSave}
              disabled={saving || loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: saving || loading ? '#94a3b8' : '#0070f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: saving || loading ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                fontWeight: 500,
                marginBottom: '1rem',
              }}
            >
              {saving ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
            <Link
              href={`/office/businesses/${businessId}`}
              style={{
                display: 'block',
                textAlign: 'center',
                padding: '0.75rem',
                color: '#666',
                textDecoration: 'underline',
                fontSize: '0.875rem',
              }}
            >
              ← Назад в кабинет
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
