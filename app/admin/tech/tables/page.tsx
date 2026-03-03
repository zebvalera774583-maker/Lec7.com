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
  {
    num: 4,
    name: 'Сводная за период (Потребности)',
    location: '/office/businesses/[id]/partnership',
    path: 'Потребности → Сводная за период',
  },
  {
    num: 5,
    name: 'Просмотр заявки (MAX/Telegram)',
    location: '/office/businesses/[id]/request/[requestId]',
    path: 'Потребности → [заявка] → Просмотр',
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
  const fullOrderPiliev = SAMPLE_SUMMARY_ROWS.reduce((a, r) => {
    const qty = parseFloat(r.qty) || 0
    const p = r.piliev ?? (r.nep ?? 0)
    return a + p * qty
  }, 0)
  const fullOrderNep = SAMPLE_SUMMARY_ROWS.reduce((a, r) => {
    const qty = parseFloat(r.qty) || 0
    const p = r.nep ?? (r.piliev ?? 0)
    return a + p * qty
  }, 0)
  const sumByPiliev = SAMPLE_SUMMARY_ROWS.reduce((a, r) => {
    const piliev = r.piliev ?? null
    const nep = r.nep ?? null
    const min = [piliev, nep].filter((p): p is number => p != null)
    const rowMin = min.length > 0 ? Math.min(...min) : null
    const qty = parseFloat(r.qty) || 0
    return a + (rowMin != null && piliev === rowMin ? piliev * qty : 0)
  }, 0)
  const sumByNep = totalSum - sumByPiliev
  const savingPiliev = totalSum - fullOrderPiliev
  const savingNep = totalSum - fullOrderNep
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

        <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.875rem' }}>
          <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 600 }}>ТЗ к таблице №1</h3>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#475569', lineHeight: 1.6 }}>
            <li><strong>Назначение:</strong> Сводное сравнение цен поставщиков по позициям заявки и формирование заявки.</li>
            <li><strong>Колонки:</strong> №, Наименование, Кол-во, Ед., колонки поставщиков (с чекбоксом «В заявку»), Итоговая сумма.</li>
            <li><strong>Поставщики:</strong> Все подключённые контрагенты с активными прайсами в категории.</li>
            <li><strong>Выбор цены:</strong> Клик по ячейке — ручной выбор поставщика для позиции (зелёный фон). Позиции без цены можно включать в заявку (цена 0).</li>
            <li><strong>Редактирование:</strong> Наименование, Кол-во, Ед. — редактируемые. Добавление и удаление строк.</li>
            <li><strong>Кнопки:</strong> Назад, Пересопоставить прайсы, Сформировать заявку.</li>
            <li><strong>Подвал:</strong> Итого (по выбранным позициям), Сумма заказа у поставщика (полный заказ у каждого), Экономия (зелёный — выгода, красный — переплата).</li>
          </ul>
        </div>

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
                <td colSpan={4} style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>Итого (по выбранным позициям)</td>
                <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>{sumByPiliev > 0 ? formatPrice(sumByPiliev) : '—'}</td>
                <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>{sumByNep > 0 ? formatPrice(sumByNep) : '—'}</td>
                <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>{formatPrice(totalSum)}</td>
              </tr>
              <tr style={{ background: '#f9fafb', fontWeight: 500 }}>
                <td colSpan={4} style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>Сумма заказа у поставщика</td>
                <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>{fullOrderPiliev > 0 ? formatPrice(fullOrderPiliev) : '—'}</td>
                <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>{fullOrderNep > 0 ? formatPrice(fullOrderNep) : '—'}</td>
                <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>—</td>
              </tr>
              <tr style={{ background: '#f9fafb', fontWeight: 500 }}>
                <td colSpan={4} style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>Экономия</td>
                <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right', color: savingPiliev > 0 ? '#15803d' : savingPiliev < 0 ? '#dc2626' : '#6b7280', fontWeight: 600 }}>
                  {savingPiliev !== 0 ? (savingPiliev > 0 ? `+${formatPrice(savingPiliev)}` : `-${formatPrice(Math.abs(savingPiliev))}`) : '0'}
                </td>
                <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right', color: savingNep > 0 ? '#15803d' : savingNep < 0 ? '#dc2626' : '#6b7280', fontWeight: 600 }}>
                  {savingNep !== 0 ? (savingNep > 0 ? `+${formatPrice(savingNep)}` : `-${formatPrice(Math.abs(savingNep))}`) : '0'}
                </td>
                <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>—</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h2 style={{ marginBottom: '0.75rem', fontSize: '1.125rem', fontWeight: 600 }}>
          Таблица №4: Сводная за период (Потребности)
        </h2>
        <p style={{ margin: '0 0 1rem 0', color: '#6b7280', fontSize: '0.875rem' }}>
          Логика как у таблицы №1. Отличие: данные — агрегация потребностей за выбранный период (сумма по masterItemId/названию и ед.).
        </p>
        <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.875rem' }}>
          <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 600 }}>ТЗ к таблице №4</h3>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#475569', lineHeight: 1.6 }}>
            <li><strong>Назначение:</strong> Сводная таблица по потребностям за период. Кнопка «Сводная за период» в шапке Потребностей → модалка выбора дат.</li>
            <li><strong>Структура:</strong> Как таблица №1 (№, Наименование, Кол-во, Ед., поставщики, Итоговая сумма, подвал).</li>
            <li><strong>Данные:</strong> Группировка по masterItemId (или названию), суммирование qty. Разные ед. — отдельные строки.</li>
            <li><strong>Режим:</strong> Просмотр/отчёт на странице, без создания заявки.</li>
          </ul>
        </div>

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
                <td colSpan={4} style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>Итого (по выбранным позициям)</td>
                <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>{sumByPiliev > 0 ? formatPrice(sumByPiliev) : '—'}</td>
                <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>{sumByNep > 0 ? formatPrice(sumByNep) : '—'}</td>
                <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>{formatPrice(totalSum)}</td>
              </tr>
              <tr style={{ background: '#f9fafb', fontWeight: 500 }}>
                <td colSpan={4} style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>Сумма заказа у поставщика</td>
                <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>{fullOrderPiliev > 0 ? formatPrice(fullOrderPiliev) : '—'}</td>
                <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>{fullOrderNep > 0 ? formatPrice(fullOrderNep) : '—'}</td>
                <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>—</td>
              </tr>
              <tr style={{ background: '#f9fafb', fontWeight: 500 }}>
                <td colSpan={4} style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>Экономия</td>
                <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right', color: savingPiliev > 0 ? '#15803d' : savingPiliev < 0 ? '#dc2626' : '#6b7280', fontWeight: 600 }}>
                  {savingPiliev !== 0 ? (savingPiliev > 0 ? `+${formatPrice(savingPiliev)}` : `-${formatPrice(Math.abs(savingPiliev))}`) : '0'}
                </td>
                <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right', color: savingNep > 0 ? '#15803d' : savingNep < 0 ? '#dc2626' : '#6b7280', fontWeight: 600 }}>
                  {savingNep !== 0 ? (savingNep > 0 ? `+${formatPrice(savingNep)}` : `-${formatPrice(Math.abs(savingNep))}`) : '0'}
                </td>
                <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>—</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h2 style={{ marginBottom: '0.75rem', fontSize: '1.125rem', fontWeight: 600 }}>
          Таблица №5: Просмотр заявки (MAX/Telegram)
        </h2>
        <p style={{ margin: '0 0 1rem 0', color: '#6b7280', fontSize: '0.875rem' }}>
          Блок «Комментарий» + таблица позиций (Наименование, Вес). Данные из заявки MAX/Telegram.
        </p>
        <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.875rem' }}>
          <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 600 }}>ТЗ к таблице №5</h3>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#475569', lineHeight: 1.6 }}>
            <li><strong>Назначение:</strong> Просмотр заявки из MAX/Telegram. Блок «Комментарий» — не сопоставленные с каталогом строки (адрес, заведение и т.п.).</li>
            <li><strong>Таблица:</strong> Колонки Наименование, Вес (или Кол-во + Ед.).</li>
            <li><strong>Кнопка:</strong> «Сформировать сводную таблицу» — переход к созданию заявки с подбором цен.</li>
          </ul>
        </div>

        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ padding: '1rem', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: '0.875rem' }}>
            <strong>Комментарий:</strong>
            <div style={{ marginTop: '0.5rem', color: '#4b5563', whiteSpace: 'pre-wrap' }}>
              ООО блины юга
              Новая заря 7
              МКММ кухня
              !!!!
              Картофель 6 кг
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Наименование</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Вес</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>морковь</td>
                  <td style={{ padding: '0.75rem 1rem' }}>3 кг</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>помидор розовый</td>
                  <td style={{ padding: '0.75rem 1rem' }}>4 кг</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
