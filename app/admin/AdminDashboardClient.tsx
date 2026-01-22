'use client'

import { useState } from 'react'
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

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ marginBottom: '2rem', fontSize: '1.875rem', fontWeight: 700 }}>Админ-панель</h1>

      {/* Табы */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid #e5e7eb',
          marginBottom: '2rem',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('agent')}
          style={{
            padding: '0.75rem 1.5rem',
            background: activeTab === 'agent' ? '#ffffff' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'agent' ? '2px solid #111827' : '2px solid transparent',
            color: activeTab === 'agent' ? '#111827' : '#6b7280',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'agent' ? 600 : 500,
            cursor: 'pointer',
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
            borderBottom: activeTab === 'businesses' ? '2px solid #111827' : '2px solid transparent',
            color: activeTab === 'businesses' ? '#111827' : '#6b7280',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'businesses' ? 600 : 500,
            cursor: 'pointer',
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

      {/* Контент вкладок */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          padding: '2rem',
          borderRadius: 0,
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
    </main>
  )
}
