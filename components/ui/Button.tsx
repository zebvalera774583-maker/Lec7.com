'use client'

import React from 'react'

interface ButtonProps {
  children: React.ReactNode
  variant?: 'primary' | 'secondary'
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  className?: string
}

export default function Button({
  children,
  variant = 'primary',
  onClick,
  disabled = false,
  type = 'button',
  className = '',
}: ButtonProps) {
  const isPrimary = variant === 'primary'

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: 'var(--spacing-sm) var(--spacing-lg)',
        borderRadius: 'var(--radius-md)',
        border: 'none',
        fontSize: '1rem',
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        ...(isPrimary
          ? {
              backgroundColor: 'var(--color-ai-accent)',
              color: '#ffffff',
              ...(disabled
                ? {
                    opacity: 0.5,
                  }
                : {
                    ':hover': {
                      opacity: 0.9,
                      transform: 'translateY(-1px)',
                      boxShadow: 'var(--shadow-md)',
                    },
                  }),
            }
          : {
              backgroundColor: 'transparent',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-divider)',
              ...(disabled
                ? {
                    opacity: 0.5,
                  }
                : {
                    ':hover': {
                      backgroundColor: 'var(--color-bg)',
                      borderColor: 'var(--color-ai-accent)',
                    },
                  }),
            }),
      }}
      className={className}
    >
      {children}
    </button>
  )
}
