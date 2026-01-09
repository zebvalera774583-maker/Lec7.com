import React from 'react'

type AIState = 
  | 'AI_ACTIVE'
  | 'AI_COMPLETED'
  | 'AI_WAITING_DECISION'
  | 'AI_ATTENTION_REQUIRED'
  | 'AI_PAUSED'

interface AIBadgeProps {
  state: AIState
  className?: string
}

const stateLabels: Record<AIState, string> = {
  AI_ACTIVE: 'AI ведёт процесс',
  AI_COMPLETED: 'Выполнено AI',
  AI_WAITING_DECISION: 'Ожидает решения',
  AI_ATTENTION_REQUIRED: 'Требует внимания',
  AI_PAUSED: 'Приостановлено',
}

const stateColors: Record<AIState, { bg: string; text: string }> = {
  AI_ACTIVE: {
    bg: 'var(--color-ai-accent)',
    text: '#ffffff',
  },
  AI_COMPLETED: {
    bg: 'var(--color-success)',
    text: '#ffffff',
  },
  AI_WAITING_DECISION: {
    bg: 'var(--color-warning)',
    text: '#ffffff',
  },
  AI_ATTENTION_REQUIRED: {
    bg: 'var(--color-danger)',
    text: '#ffffff',
  },
  AI_PAUSED: {
    bg: 'var(--color-text-secondary)',
    text: '#ffffff',
  },
}

export default function AIBadge({ state, className = '' }: AIBadgeProps) {
  const colors = stateColors[state]
  const label = stateLabels[state]

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: 'var(--spacing-xs) var(--spacing-sm)',
        borderRadius: 'var(--radius-sm)',
        backgroundColor: colors.bg,
        color: colors.text,
        fontSize: '0.75rem',
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}
      className={className}
    >
      {label}
    </span>
  )
}
