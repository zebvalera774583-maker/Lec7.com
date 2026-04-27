'use client'

import { useState } from 'react'

export default function TgCity() {
  const [log, setLog] = useState('Нажми кнопку, чтобы начать')

  function rand(max: number) {
    return Math.floor(Math.random() * max)
  }

  function makeMove() {
    const directions = ['север', 'юг', 'восток', 'запад']
    const places = ['магазин', 'казино', 'чёрный рынок', 'стройка']
    const events = ['хорошее', 'плохое']

    const direction = directions[rand(4)]
    const distance = rand(6) + 1
    const place = places[rand(4)]
    const event = events[rand(2)]

    const money = event === 'хорошее' ? '+500 ₽' : '-400 ₽'

    setLog(`
Ты пошёл на ${direction}
Прошёл: ${distance} клеток

📍 Попал в: ${place}
⚡ Событие: ${event}

💰 Изменение: ${money}
    `)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0f172a',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <h2>🏙 Город TG</h2>

      <button
        onClick={makeMove}
        style={{
          padding: '16px 24px',
          fontSize: 18,
          borderRadius: 10,
          border: 'none',
          background: '#22c55e',
          color: 'black',
          cursor: 'pointer',
          marginTop: 20,
        }}
      >
        🎲 Сделать ход
      </button>

      <div style={{ marginTop: 20, whiteSpace: 'pre-line', textAlign: 'center' }}>
        {log}
      </div>
    </div>
  )
}
