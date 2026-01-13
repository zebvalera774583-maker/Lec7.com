'use client'

import { useState } from 'react'

interface Portfolio {
  id: string
  title: string
  description: string | null
  imageUrl: string
  order: number
}

interface PortfolioGalleryProps {
  portfolios: Portfolio[]
}

export default function PortfolioGallery({ portfolios }: PortfolioGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  if (portfolios.length === 0) {
    return <p style={{ color: '#666' }}>Портфолио пока пусто</p>
  }

  return (
    <>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
        gap: '1rem' 
      }}>
        {portfolios.map((portfolio) => (
          <div
            key={portfolio.id}
            onClick={() => setSelectedImage(portfolio.imageUrl)}
            style={{
              cursor: 'pointer',
              aspectRatio: '1',
              overflow: 'hidden',
              borderRadius: '8px',
              position: 'relative',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={portfolio.imageUrl}
              alt={portfolio.title}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
              color: 'white',
              padding: '1rem',
            }}>
              <h4 style={{ margin: 0, fontSize: '1rem' }}>{portfolio.title}</h4>
            </div>
          </div>
        ))}
      </div>

      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            cursor: 'pointer',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedImage}
            alt="Fullscreen"
            style={{
              maxWidth: '90%',
              maxHeight: '90%',
              objectFit: 'contain',
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
