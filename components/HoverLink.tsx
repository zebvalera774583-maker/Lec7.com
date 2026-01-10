'use client'

import Link from 'next/link'
import { ReactNode } from 'react'

interface HoverLinkProps {
  href: string
  children: ReactNode
  className?: string
  style?: React.CSSProperties
  variant?: 'primary' | 'secondary'
}

export default function HoverLink({ 
  href, 
  children, 
  className = '', 
  style = {},
  variant = 'secondary'
}: HoverLinkProps) {
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem 2rem',
    textDecoration: 'none',
    fontSize: '1rem',
    fontWeight: variant === 'primary' ? '600' : '500',
    borderRadius: '8px',
    border: '2px solid',
    transition: 'all 0.2s ease',
    ...style,
  }

  const variantStyles = {
    primary: {
      background: '#0070f3',
      color: 'white',
      borderColor: '#0070f3',
      boxShadow: '0 2px 8px rgba(0, 112, 243, 0.3)',
    },
    secondary: {
      background: '#f5f5f5',
      color: '#1a1a1a',
      borderColor: '#e0e0e0',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
    },
  }

  const currentStyle = {
    ...baseStyle,
    ...variantStyles[variant],
  }

  return (
    <Link
      href={href}
      className={className}
      style={currentStyle}
      onMouseEnter={(e) => {
        if (variant === 'primary') {
          e.currentTarget.style.background = '#0051cc'
          e.currentTarget.style.borderColor = '#0051cc'
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 112, 243, 0.4)'
        } else {
          e.currentTarget.style.background = '#e8e8e8'
          e.currentTarget.style.borderColor = '#d0d0d0'
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)'
        }
      }}
      onMouseLeave={(e) => {
        if (variant === 'primary') {
          e.currentTarget.style.background = '#0070f3'
          e.currentTarget.style.borderColor = '#0070f3'
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 112, 243, 0.3)'
        } else {
          e.currentTarget.style.background = '#f5f5f5'
          e.currentTarget.style.borderColor = '#e0e0e0'
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)'
        }
      }}
    >
      {children}
    </Link>
  )
}
