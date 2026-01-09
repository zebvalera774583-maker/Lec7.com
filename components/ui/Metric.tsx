import React from 'react'

interface MetricProps {
  value: number | string
  label: string
  className?: string
}

export default function Metric({ value, label, className = '' }: MetricProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-xs)',
      }}
      className={className}
    >
      <div
        style={{
          fontSize: '2rem',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: '0.875rem',
          color: 'var(--color-text-secondary)',
        }}
      >
        {label}
      </div>
    </div>
  )
}
