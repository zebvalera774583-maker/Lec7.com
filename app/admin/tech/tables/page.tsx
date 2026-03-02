const TABLES_CATALOG = [
  {
    num: 1,
    name: 'Сводная таблица (Заявки)',
    location: '/office/businesses/[id]/requests',
    path: 'Заявки → Создать заявку → Сводная таблица',
  },
  {
    num: 2,
    name: 'Управление бизнесами',
    location: '/admin/businesses',
    path: 'Админка → Бизнесы',
  },
  {
    num: 3,
    name: 'Мастер каталог',
    location: '/admin/bot-tools',
    path: 'Админка → Мастер каталог',
  },
]

const SAMPLE_SUMMARY_ROWS = [
  { name: 'Грибы шампиньоны', qty: '1', unit: 'кг', piliev: null, nep: 290, sum: 290 },
  { name: 'Перец красный-болгарский', qty: '1', unit: 'кг', piliev: 315, nep: 455, sum: 315 },
  { name: 'Помидоры розовые', qty: '2', unit: 'кг', piliev: null, nep: null, sum: null },
  { name: 'Лист салата', qty: '1', unit: 'кг', piliev: null, nep: 664, sum: 664 },
  { name: 'Картофель очищенный', qty: '2', unit: 'кг', piliev: null, nep: 129, sum: 258 },
]

function formatPrice(n: number): string {
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export default function TechTablesPage() {
  const totalSum = SAMPLE_SUMMARY_ROWS.reduce((a, r) => {
    const piliev = r.piliev ?? null
    const nep = r.nep ?? null
    const min = [piliev, nep].filter((p): p is number => p != null)
    const rowMin = min.length > 0 ? Math.min(...min) : null
    const qty = parseFloat(r.qty) || 0
    return a + (rowMin != null ? rowMin * qty : 0)
  }, 0)
  const suppliers = [
    { id: 'piliev', name: 'ИП Пилиев Г.З.' },
    { id: 'nep', name: 'ООО «НЭП»' },
  ]
  return (
    <div style={{ width: '100%' }}>
      <h1 style={{ marginBottom: '0.5rem', fontSize: '1.875rem', fontWeight: 700 }}>
        Таблицы
      </h1>
      <p style={{ margin: '0 0 1.5rem 0', color: '#6b7280', fontSize: '1rem' }}>
        Каталог таблиц и образцы. Таблицы открываются здесь, без перехода на другие страницы.
      </p>

      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '0.75rem', fontSize: '1.125rem', fontWeight: 600 }}>Каталог</h2>
        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px', background: 'white' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>№</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Название таблицы</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Расположение</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Путь в интерфейсе</th>
              </tr>
            </thead>
            <tbody>
              {TABLES_CATALOG.map((t) => (
                <tr key={t.num} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{t.num}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>{t.name}</td>
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.8125rem', color: '#4b5563' }}>{t.location}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.8125rem' }}>{t.path}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 style={{ marginBottom: '0.75rem', fontSize: '1.125rem', fontWeight: 600 }}>
          Образец №1: Сводная таблица (Заявки)
        </h2>
        <p style={{ margin: '0 0 1rem 0', color: '#6b7280', fontSize: '0.875rem' }}>
          Только просмотр, без редактирования.
        </p>
        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px', background: 'white' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr>
                <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500, minWidth: '48px' }}>№</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500, minWidth: '140px' }}>Наименование</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500, minWidth: '80px' }}>Кол-во</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500, minWidth: '60px' }}>Ед.</th>
                {suppliers.map((s) => (
                  <th key={s.id} style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500, minWidth: '100px' }}>{s.name}</th>
                ))}
                <th style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 500, minWidth: '100px' }}>Итоговая сумма</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_SUMMARY_ROWS.map((r, idx) => {
                const pilievPrice = r.piliev ?? null
                const nepPrice = r.nep ?? null
                const minPrice = [pilievPrice, nepPrice].filter((p): p is number => p != null)
                const rowMin = minPrice.length > 0 ? Math.min(...minPrice) : null
                const isPilievMin = pilievPrice != null && pilievPrice === rowMin
                const isNepMin = nepPrice != null && nepPrice === rowMin
                const qty = parseFloat(r.qty) || 0
                const rowSum = rowMin != null ? rowMin * qty : null
                return (
                  <tr key={idx}>
                    <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'center', background: '#f9fafb' }}>{idx + 1}</td>
                    <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>{r.name}</td>
                    <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'center' }}>{r.qty}</td>
                    <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}>{r.unit}</td>
                    <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right', backgroundColor: isPilievMin ? '#dcfce7' : 'white' }}>
                      {pilievPrice != null ? formatPrice(pilievPrice) : '—'}
                    </td>
                    <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right', backgroundColor: isNepMin ? '#dcfce7' : 'white' }}>
                      {nepPrice != null ? formatPrice(nepPrice) : '—'}
                    </td>
                    <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right', fontWeight: (rowSum ?? 0) > 0 ? 600 : 400 }}>
                      {rowSum != null ? formatPrice(rowSum) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f3f4f6', fontWeight: 600 }}>
                <td colSpan={4} style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>Итого</td>
                {suppliers.map((s) => (
                  <td key={s.id} style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>—</td>
                ))}
                <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>{formatPrice(totalSum)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
