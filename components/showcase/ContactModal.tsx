'use client'

interface ContactModalProps {
  isOpen: boolean
  onClose: () => void
  phone: string | null
  telegramUsername: string | null
}

export default function ContactModal({ isOpen, onClose, phone, telegramUsername }: ContactModalProps) {
  if (!isOpen) return null

  const hasContacts = phone || telegramUsername

  const handlePhoneClick = () => {
    if (phone) {
      window.location.href = `tel:${phone.replace(/\s/g, '').replace(/[()]/g, '').replace(/-/g, '')}`
    }
  }

  const handleTelegramClick = () => {
    if (telegramUsername) {
      const username = telegramUsername.startsWith('@') ? telegramUsername.slice(1) : telegramUsername
      window.open(`https://t.me/${username}`, '_blank')
    }
  }

  return (
    <>
      {/* Overlay */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={onClose}
      >
        {/* Modal */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 0,
            padding: '2rem',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.5rem', fontWeight: 600, color: '#111827' }}>
            Связаться
          </h2>

          {!hasContacts ? (
            <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
              Контактная информация не указана
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {phone && (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
                    Телефон
                  </label>
                  <a
                    href={`tel:${phone.replace(/\s/g, '').replace(/[()]/g, '').replace(/-/g, '')}`}
                    onClick={handlePhoneClick}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: 0,
                      textDecoration: 'none',
                      color: '#111827',
                      fontSize: '1rem',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f9fafb'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    <span style={{ fontSize: '1.25rem' }}>📞</span>
                    <span style={{ fontWeight: 500 }}>{phone}</span>
                  </a>
                </div>
              )}

              {telegramUsername && (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
                    Telegram
                  </label>
                  <a
                    href={`https://t.me/${telegramUsername.startsWith('@') ? telegramUsername.slice(1) : telegramUsername}`}
                    onClick={handleTelegramClick}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: 0,
                      textDecoration: 'none',
                      color: '#111827',
                      fontSize: '1rem',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f9fafb'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    <span style={{ fontSize: '1.25rem' }}>✈️</span>
                    <span style={{ fontWeight: 500 }}>
                      @{telegramUsername.startsWith('@') ? telegramUsername.slice(1) : telegramUsername}
                    </span>
                  </a>
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.75rem 1.5rem',
                border: '1px solid #d1d5db',
                borderRadius: 0,
                background: '#ffffff',
                color: '#111827',
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
