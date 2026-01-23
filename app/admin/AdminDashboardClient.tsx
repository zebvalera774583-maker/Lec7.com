'use client'

import { useState, useEffect } from 'react'
import OwnerAgentClient from './owner-agent/OwnerAgentClient'
import BusinessActivationTable from './businesses/BusinessActivationTable'

interface OwnerAgentClientProps {
  gitBranch?: string
  environment: string
  notesPath: string
  tasksPath: string
}

interface Business {
  id: string
  name: string
  slug: string
  lifecycleStatus: string | null
  billingStatus: string | null
  createdAt: Date
}

interface AdminDashboardClientProps {
  agentProps: OwnerAgentClientProps
  businesses: Business[]
}

type Tab = 'agent' | 'businesses'

export default function AdminDashboardClient({ agentProps, businesses }: AdminDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>('agent')
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia('(max-width: 768px)').matches)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return (
    <main style={{ width: '100%', padding: isMobile ? '2rem' : '2rem 0' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', paddingLeft: isMobile ? 0 : '2rem', paddingRight: isMobile ? 0 : '2rem' }}>
        <h1 style={{ marginBottom: '2rem', fontSize: '1.875rem', fontWeight: 700 }}>Админ-панель</h1>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: '2rem',
          alignItems: 'flex-start',
          width: '100%',
        }}
      >
        {/* Табы - слева (на desktop) или сверху (на mobile) */}
        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'row' : 'column',
            gap: '0.5rem',
            minWidth: isMobile ? 'auto' : '200px',
            width: isMobile ? '100%' : 'auto',
            borderRight: isMobile ? 'none' : '1px solid #e5e7eb',
            borderBottom: isMobile ? '1px solid #e5e7eb' : 'none',
            paddingRight: isMobile ? '2rem' : '2rem',
            paddingLeft: isMobile ? '2rem' : '0',
            paddingBottom: isMobile ? '1rem' : 0,
            marginBottom: isMobile ? '1rem' : 0,
            marginLeft: 0,
            overflowX: isMobile ? 'auto' : 'visible',
            WebkitOverflowScrolling: isMobile ? 'touch' : 'auto',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('agent')}
            style={{
              padding: '0.75rem 1.5rem',
              background: activeTab === 'agent' ? '#ffffff' : 'transparent',
              border: 'none',
              borderLeft: !isMobile && activeTab === 'agent' ? '2px solid #111827' : '2px solid transparent',
              borderBottom: isMobile && activeTab === 'agent' ? '2px solid #111827' : '2px solid transparent',
              color: activeTab === 'agent' ? '#111827' : '#6b7280',
              fontSize: '0.95rem',
              fontWeight: activeTab === 'agent' ? 600 : 500,
              cursor: 'pointer',
              textAlign: 'left',
              whiteSpace: 'nowrap',
              borderRadius: 0,
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'agent') {
                e.currentTarget.style.color = '#111827'
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'agent') {
                e.currentTarget.style.color = '#6b7280'
              }
            }}
          >
            AI-агент
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('businesses')}
            style={{
              padding: '0.75rem 1.5rem',
              background: activeTab === 'businesses' ? '#ffffff' : 'transparent',
              border: 'none',
              borderLeft: !isMobile && activeTab === 'businesses' ? '2px solid #111827' : '2px solid transparent',
              borderBottom: isMobile && activeTab === 'businesses' ? '2px solid #111827' : '2px solid transparent',
              color: activeTab === 'businesses' ? '#111827' : '#6b7280',
              fontSize: '0.95rem',
              fontWeight: activeTab === 'businesses' ? 600 : 500,
              cursor: 'pointer',
              textAlign: 'left',
              whiteSpace: 'nowrap',
              borderRadius: 0,
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'businesses') {
                e.currentTarget.style.color = '#111827'
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'businesses') {
                e.currentTarget.style.color = '#6b7280'
              }
            }}
          >
            Бизнесы
          </button>
        </div>

        {/* Контент вкладок - справа */}
        <div
          style={{
            flex: 1,
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            padding: '2rem',
            borderRadius: 0,
            marginRight: isMobile ? '2rem' : '2rem',
            maxWidth: isMobile ? 'none' : 'calc(1200px - 200px - 2rem - 2rem)',
          }}
        >
          {activeTab === 'agent' && (
            <OwnerAgentClient
              gitBranch={agentProps.gitBranch}
              environment={agentProps.environment}
              notesPath={agentProps.notesPath}
              tasksPath={agentProps.tasksPath}
            />
          )}
          {activeTab === 'businesses' && <BusinessActivationTable businesses={businesses} />}
        </div>
      </div>
    </main>
  )
}
