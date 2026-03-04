'use client'

import AdminOrchestratorChat from './AdminOrchestratorChat'

export default function AdminDashboardClient() {
  return (
    <div style={{ width: '100%' }}>
      <h1 style={{ marginBottom: '2rem', fontSize: '1.875rem', fontWeight: 700 }}>
        AI-агент
      </h1>
      <AdminOrchestratorChat />
    </div>
  )
}
