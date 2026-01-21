import Link from 'next/link'

const cards = [
  {
    title: 'Мебельный магазин «Forma»',
    city: 'Москва',
    category: 'Мебель на заказ',
  },
  {
    title: 'Дизайн агентство «Line Studio»',
    city: 'Санкт-Петербург',
    category: 'Дизайн и брендинг',
  },
  {
    title: 'Магазин одежды «Nord Wear»',
    city: 'Казань',
    category: 'Одежда и аксессуары',
  },
  {
    title: 'Юридическая компания «Право»',
    city: 'Москва',
    category: 'Юридические услуги',
  },
  {
    title: 'IT студия «CodePoint»',
    city: 'Новосибирск',
    category: 'Разработка',
  },
  {
    title: 'Студия интерьера «Space»',
    city: 'Екатеринбург',
    category: 'Интерьер',
  },
]

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f7f2ee',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Верхняя полоса с логотипом */}
      <div
        style={{
          borderBottom: '1px solid rgba(15, 23, 42, 0.06)',
          padding: '1.25rem 1.5rem',
        }}
      >
        <div
          style={{
            maxWidth: '1120px',
            margin: '0 auto',
          }}
        >
          <span
            style={{
              fontWeight: 700,
              fontSize: '1.15rem',
              letterSpacing: '0.02em',
              color: '#0f172a',
            }}
          >
            Lec7
          </span>
        </div>
      </div>

      {/* Основной контент */}
      <div
        style={{
          flex: 1,
          padding: '2.5rem 1.5rem 3rem',
        }}
      >
        <div
          style={{
            maxWidth: '1120px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '2.5rem',
          }}
        >
          {/* Hero-блок */}
          <section
            style={{
              textAlign: 'center',
              maxWidth: '720px',
              margin: '0 auto',
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: 'clamp(2.15rem, 3.2vw, 2.6rem)',
                lineHeight: 1.25,
                fontWeight: 500,
                color: '#0f172a',
              }}
            >
              <span
                style={{
                  fontWeight: 700,
                  color: '#111827',
                }}
              >
                AI&nbsp;
              </span>
              ведёт бизнес и клиента
              <br />
              друг к другу
            </h1>

            <p
              style={{
                marginTop: '1.25rem',
                marginBottom: '1.75rem',
                color: '#6b7280',
                fontSize: '0.98rem',
                lineHeight: 1.6,
              }}
            >
              <span
                style={{
                  fontWeight: 600,
                  color: '#111827',
                }}
              >
                Lec7
              </span>{' '}
              — AI-платформа для ведения сделок
              <br />
              между бизнесом и клиентом.
            </p>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: '1.5rem',
                fontSize: '0.95rem',
              }}
            >
              <Link
                href="/visitor"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: '#111827',
                  textDecoration: 'none',
                  padding: '0.35rem 0.1rem',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{ fontSize: '1.1rem', transform: 'translateY(-1px)' }}
                >
                  ←
                </span>
                <span
                  style={{
                    borderBottom: '1px solid rgba(15, 23, 42, 0.2)',
                    paddingBottom: '0.1rem',
                  }}
                >
                  Посмотреть предложения бизнесов
                </span>
              </Link>

              <Link
                href="/resident/welcome"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: '#111827',
                  textDecoration: 'none',
                  padding: '0.35rem 0.1rem',
                }}
              >
                <span
                  style={{
                    borderBottom: '1px solid rgba(15, 23, 42, 0.2)',
                    paddingBottom: '0.1rem',
                  }}
                >
                  Создать свой бизнес
                </span>
                <span
                  aria-hidden="true"
                  style={{ fontSize: '1.1rem', transform: 'translateY(-1px)' }}
                >
                  →
                </span>
              </Link>
            </div>
          </section>

          {/* Сетка карточек */}
          <section>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: '1.5rem',
              }}
            >
              {cards.map((card) => (
                <article
                  key={card.title}
                  style={{
                    background: '#f9fafb',
                    borderRadius: 0,
                    boxShadow: '0 18px 45px rgba(15, 23, 42, 0.08)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '140px',
                      background:
                        'linear-gradient(135deg, #e5e7eb 0%, #f3f4f6 40%, #e5e7eb 100%)',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        inset: '18px 20px 18px 20px',
                        borderRadius: 0,
                        background:
                          'radial-gradient(circle at 0% 0%, rgba(156,163,175,0.35), transparent 55%), radial-gradient(circle at 100% 100%, rgba(148,163,184,0.2), transparent 50%)',
                      }}
                    />
                  </div>
                  <div
                    style={{
                      padding: '0.9rem 1.1rem 1.05rem',
                      backgroundColor: '#fdfdfd',
                    }}
                  >
                    <h3
                      style={{
                        margin: 0,
                        marginBottom: '0.3rem',
                        fontSize: '0.98rem',
                        fontWeight: 600,
                        color: '#111827',
                      }}
                    >
                      {card.title}
                    </h3>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.82rem',
                        color: '#6b7280',
                      }}
                    >
                      {card.city} • {card.category}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Нижняя подпись */}
      <footer
        style={{
          padding: '1.5rem 1.5rem 2rem',
        }}
      >
        <div
          style={{
            maxWidth: '1120px',
            margin: '0 auto',
            textAlign: 'center',
            fontSize: '0.9rem',
            color: '#6b7280',
          }}
        >
          <span
            style={{
              fontWeight: 600,
              color: '#111827',
            }}
          >
            Lec7
          </span>{' '}
          — рабочая AI-инфраструктура для реальных сделок.
        </div>
      </footer>
    </main>
  )
}
