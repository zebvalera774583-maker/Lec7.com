'use client'

import AgentLayout from '@/components/agent/AgentLayout'

export default function AdminDashboardClient() {
  return (
    <div style={{ width: '100%' }}>
      <h1 style={{ marginBottom: '2rem', fontSize: '1.875rem', fontWeight: 700 }}>
        AI-агент
      </h1>
      <AgentLayout />
    </div>
  )
}
