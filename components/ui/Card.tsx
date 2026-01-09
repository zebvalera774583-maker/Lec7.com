import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

export default function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-sm)',
        padding: 'var(--spacing-lg)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.2s ease',
        ...(onClick && {
          ':hover': {
            boxShadow: 'var(--shadow-md)',
          },
        }),
      }}
      className={className}
    >
      {children}
    </div>
  )
}
