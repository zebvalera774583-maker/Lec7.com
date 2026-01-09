import React from 'react'

interface AIHeroProps {
  title?: string
  subtitle?: string
  className?: string
}

export default function AIHero({
  title = 'AI ведёт ваш бизнес',
  subtitle = 'Вы контролируете решения',
  className = '',
}: AIHeroProps) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: 'var(--spacing-2xl) var(--spacing-lg)',
      }}
      className={className}
    >
      <h1
        style={{
          fontSize: '2.5rem',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          marginBottom: 'var(--spacing-md)',
          lineHeight: 1.2,
        }}
      >
        {title}
      </h1>
      <p
        style={{
          fontSize: '1.25rem',
          color: 'var(--color-text-secondary)',
          lineHeight: 1.6,
        }}
      >
        {subtitle}
      </p>
    </div>
  )
}
