'use client'

interface AgentMessageProps {
  role: 'USER' | 'ASSISTANT'
  content: string
}

export default function AgentMessage({ role, content }: AgentMessageProps) {
  const isUser = role === 'USER'

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: '1.5rem',
        padding: '0 1rem',
      }}
    >
      <div
        style={{
          maxWidth: '85%',
          padding: '0.75rem 1rem',
          background: isUser ? '#0070f3' : '#f7f7f8',
          color: isUser ? '#ffffff' : '#353740',
          borderRadius: 0,
          fontSize: '0.9375rem',
          lineHeight: '1.6',
          wordWrap: 'break-word',
        }}
      >
        {content}
      </div>
    </div>
  )
}
