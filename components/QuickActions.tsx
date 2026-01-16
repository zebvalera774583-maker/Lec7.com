'use client'

export default function QuickActions() {
  return (
    <div
      style={{
        padding: '1rem',
        background: 'white',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
      }}
    >
      <h3
        style={{
          margin: '0 0 1rem 0',
          fontSize: '1.125rem',
          fontWeight: 600,
        }}
      >
        Быстрые действия
      </h3>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <a
          href="/owner/admin"
          style={{
            display: 'block',
            padding: '0.75rem 1rem',
            background: '#f8fafc',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            textDecoration: 'none',
            color: '#374151',
            fontSize: '0.875rem',
            fontWeight: 500,
            transition: 'all 0.2s',
            textAlign: 'center',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#f1f5f9'
            e.currentTarget.style.borderColor = '#cbd5e1'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#f8fafc'
            e.currentTarget.style.borderColor = '#e5e7eb'
          }}
        >
          Админ-панель
        </a>

        <button
          type="button"
          onClick={() => {
            // Скролл к Owner Agent панели (она справа в layout)
            const panel = document.querySelector('[data-owner-ai-panel]')
            if (panel) {
              panel.scrollIntoView({ behavior: 'smooth', block: 'start' })
              // Попытка фокуса на input в панели
              setTimeout(() => {
                const input = panel.querySelector('input[type="text"]') as HTMLInputElement
                if (input) {
                  input.focus()
                }
              }, 500)
            }
          }}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            background: '#3b82f6',
            border: 'none',
            borderRadius: '6px',
            color: 'white',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#2563eb'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#3b82f6'
          }}
        >
          Новый диалог с Agent
        </button>

        <a
          href="/api/agent-playbook"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block',
            padding: '0.75rem 1rem',
            background: '#f8fafc',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            textDecoration: 'none',
            color: '#374151',
            fontSize: '0.875rem',
            fontWeight: 500,
            transition: 'all 0.2s',
            textAlign: 'center',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#f1f5f9'
            e.currentTarget.style.borderColor = '#cbd5e1'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#f8fafc'
            e.currentTarget.style.borderColor = '#e5e7eb'
          }}
        >
          Просмотреть Playbook API
        </a>
      </div>
    </div>
  )
}
