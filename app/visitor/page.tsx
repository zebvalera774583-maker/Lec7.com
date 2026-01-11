import { Suspense } from 'react'
import VisitorClient from './VisitorClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function VisitorPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff'
      }}>
        <p style={{ color: '#666', fontSize: '1.1rem' }}>Загрузка...</p>
      </div>
    }>
      <VisitorClient />
    </Suspense>
  )
}
