import Link from 'next/link'

const TABLES_CATALOG = [
  {
    num: 1,
    name: 'Сводная таблица (Заявки)',
    location: '/office/businesses/[id]/requests',
    path: 'Заявки → Создать заявку → Сводная таблица',
    href: '/office',
  },
  {
    num: 2,
    name: 'Управление бизнесами',
    location: '/admin/businesses',
    path: 'Админка → Бизнесы',
    href: '/admin/businesses',
  },
  {
    num: 3,
    name: 'Мастер каталог',
    location: '/admin/bot-tools',
    path: 'Админка → Мастер каталог',
    href: '/admin/bot-tools',
  },
]

export default function TechTablesPage() {
  return (
    <div style={{ width: '100%' }}>
      <h1 style={{ marginBottom: '0.5rem', fontSize: '1.875rem', fontWeight: 700 }}>
        Таблицы
      </h1>
      <p style={{ margin: '0 0 1.5rem 0', color: '#6b7280', fontSize: '1rem' }}>
        Каталог таблиц и быстрые ссылки на системные разделы.
      </p>
      <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px', background: 'white' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>№</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Название таблицы</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Расположение</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Путь в интерфейсе</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Ссылка</th>
            </tr>
          </thead>
          <tbody>
            {TABLES_CATALOG.map((t) => (
              <tr key={t.num} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{t.num}</td>
                <td style={{ padding: '0.75rem 1rem' }}>{t.name}</td>
                <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.8125rem', color: '#4b5563' }}>{t.location}</td>
                <td style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.8125rem' }}>{t.path}</td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <Link
                    href={t.href}
                    style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.875rem' }}
                  >
                    Открыть →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
