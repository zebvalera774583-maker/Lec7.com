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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {phone && (
                <a
                  href={`tel:${phone.replace(/\s/g, '').replace(/[()]/g, '').replace(/-/g, '')}`}
                  onClick={handlePhoneClick}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    textDecoration: 'none',
                    color: '#111827',
                    fontSize: '1.125rem',
                    cursor: 'pointer',
                    transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.7'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1'
                  }}
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ flexShrink: 0 }}
                  >
                    <path
                      d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                  <span style={{ fontWeight: 500 }}>{phone}</span>
                </a>
              )}

              {telegramUsername && (
                <a
                  href={`https://t.me/${telegramUsername.startsWith('@') ? telegramUsername.slice(1) : telegramUsername}`}
                  onClick={handleTelegramClick}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    textDecoration: 'none',
                    color: '#111827',
                    fontSize: '1.125rem',
                    cursor: 'pointer',
                    transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.7'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1'
                  }}
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ flexShrink: 0 }}
                  >
                    <path
                      d="M21.5 2L2 10.5l7.5 2L17 7l-6.5 5.5 2.5 7.5 4-4.5 4.5 2.5L21.5 2z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                  <span style={{ fontWeight: 500 }}>
                    @{telegramUsername.startsWith('@') ? telegramUsername.slice(1) : telegramUsername}
                  </span>
                </a>
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
