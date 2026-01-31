'use client'

import { useState, useMemo, useEffect, useRef } from 'react'

interface Column {
  id: string
  title: string
  kind: 'text' | 'number'
  isBase: boolean // базовые колонки нельзя удалить
}

interface Row {
  [columnId: string]: string
}

interface PriceUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (rows: Row[], columns: Column[]) => void
  initialRows?: Row[]
  initialColumns?: Column[]
  readOnly?: boolean // Режим только просмотра (для назначенных прайсов)
}

const BASE_COLUMNS: Column[] = [
  { id: 'name', title: 'Наименование', kind: 'text', isBase: true },
  { id: 'unit', title: 'Ед. изм', kind: 'text', isBase: true },
  { id: 'priceWithVat', title: 'Цена за ед. изм. С НДС', kind: 'number', isBase: true },
  { id: 'priceWithoutVat', title: 'Цена за ед. изм. без НДС', kind: 'number', isBase: true },
]

export default function PriceUploadModal({ isOpen, onClose, onSave, initialRows, initialColumns, readOnly = false }: PriceUploadModalProps) {
  const [columns, setColumns] = useState<Column[]>(initialColumns || BASE_COLUMNS)
  const [rows, setRows] = useState<Row[]>(initialRows && initialRows.length > 0 ? initialRows : [{}])
  const [showAddColumnForm, setShowAddColumnForm] = useState(false)
  const [newColumnTitle, setNewColumnTitle] = useState('')
  const [newColumnKind, setNewColumnKind] = useState<'text' | 'number'>('text')
  const lastRowFirstInputRef = useRef<HTMLInputElement | null>(null)
  const [focusNewRow, setFocusNewRow] = useState(false)

  const handleAddRow = () => {
    setRows([...rows, {}])
    setFocusNewRow(true)
  }

  useEffect(() => {
    if (focusNewRow && rows.length > 0 && lastRowFirstInputRef.current) {
      lastRowFirstInputRef.current.focus()
      setFocusNewRow(false)
    }
  }, [focusNewRow, rows.length])

  const handleDeleteRow = (index: number) => {
    setRows(rows.filter((_, i) => i !== index))
  }

  const handleCellChange = (rowIndex: number, columnId: string, value: string) => {
    const newRows = [...rows]
    if (!newRows[rowIndex]) {
      newRows[rowIndex] = {}
    }
    newRows[rowIndex][columnId] = value
    setRows(newRows)
  }

  const handleAddColumn = () => {
    if (!newColumnTitle.trim()) return

    const newColumn: Column = {
      id: `col_${Date.now()}`,
      title: newColumnTitle.trim(),
      kind: newColumnKind,
      isBase: false,
    }

    setColumns([...columns, newColumn])
    setNewColumnTitle('')
    setNewColumnKind('text')
    setShowAddColumnForm(false)
  }

  const handleDeleteColumn = (columnId: string) => {
    const column = columns.find((c) => c.id === columnId)
    if (!column || column.isBase) return

    setColumns(columns.filter((c) => c.id !== columnId))
    const newRows = rows.map((row) => {
      const { [columnId]: _, ...rest } = row
      return rest
    })
    setRows(newRows)
  }

  const handleSave = () => {
    onSave(rows, columns)
    onClose()
  }

  // Синхронизация данных при открытии модалки
  useEffect(() => {
    if (isOpen) {
      if (initialColumns) {
        setColumns(initialColumns)
      } else {
        setColumns(BASE_COLUMNS)
      }
      if (initialRows && initialRows.length > 0) {
        setRows(initialRows)
      } else {
        setRows([{}])
      }
    }
  }, [isOpen, initialRows, initialColumns])

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={onClose}
      >
        {/* Modal */}
        <div
          style={{
            background: 'white',
            borderRadius: '8px',
            padding: '1.5rem',
            maxWidth: '90vw',
            maxHeight: '90vh',
            overflow: 'auto',
            zIndex: 1001,
            minWidth: '800px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{readOnly ? 'Просмотр прайса' : 'Загрузка прайса'}</h2>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: '#666',
                padding: '0.25rem 0.5rem',
              }}
            >
              ×
            </button>
          </div>

          {/* Кнопки управления сверху */}
          {!readOnly && (
            <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleAddRow}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#0070f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Добавить строку
              </button>
              <button
                onClick={() => setShowAddColumnForm(!showAddColumnForm)}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#f3f4f6',
                  color: '#111827',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Добавить столбец
              </button>
            </div>
          )}

          {/* Форма добавления столбца */}
          {showAddColumnForm && (
            <div
              style={{
                marginBottom: '1rem',
                padding: '1rem',
                background: '#f9fafb',
                borderRadius: '4px',
                border: '1px solid #e5e7eb',
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
              }}
            >
              <input
                type="text"
                placeholder="Название столбца"
                value={newColumnTitle}
                onChange={(e) => setNewColumnTitle(e.target.value)}
                style={{
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  flex: 1,
                }}
              />
              <select
                value={newColumnKind}
                onChange={(e) => setNewColumnKind(e.target.value as 'text' | 'number')}
                style={{
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              >
                <option value="text">Текст</option>
                <option value="number">Число</option>
              </select>
              <button
                onClick={handleAddColumn}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#0070f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Добавить
              </button>
              <button
                onClick={() => {
                  setShowAddColumnForm(false)
                  setNewColumnTitle('')
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#f3f4f6',
                  color: '#111827',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Отмена
              </button>
            </div>
          )}

          {/* Таблица */}
          <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.875rem',
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      padding: '0.75rem',
                      textAlign: 'left',
                      border: '1px solid #e5e7eb',
                      background: '#f9fafb',
                      fontWeight: 500,
                      minWidth: '60px',
                    }}
                  >
                    № п/п
                  </th>
                  {columns.map((column) => (
                    <th
                      key={column.id}
                      style={{
                        padding: '0.75rem',
                        textAlign: 'left',
                        border: '1px solid #e5e7eb',
                        background: '#f9fafb',
                        fontWeight: 500,
                        position: 'relative',
                        minWidth: '150px',
                      }}
                    >
                      {column.title}
                      {!readOnly && !column.isBase && (
                        <button
                          onClick={() => handleDeleteColumn(column.id)}
                          style={{
                            position: 'absolute',
                            right: '0.25rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            padding: '0.25rem',
                          }}
                          title="Удалить столбец"
                        >
                          ×
                        </button>
                      )}
                    </th>
                  ))}
                  {!readOnly && (
                    <th
                      style={{
                        padding: '0.75rem',
                        textAlign: 'center',
                        border: '1px solid #e5e7eb',
                        background: '#f9fafb',
                        fontWeight: 500,
                        minWidth: '80px',
                      }}
                    >
                      Действия
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    <td
                      style={{
                        padding: '0.75rem',
                        border: '1px solid #e5e7eb',
                        textAlign: 'center',
                        background: '#f9fafb',
                      }}
                    >
                      {rowIndex + 1}
                    </td>
                    {columns.map((column, colIndex) => (
                      <td key={column.id} style={{ padding: '0.5rem', border: '1px solid #e5e7eb' }}>
                        <input
                          ref={colIndex === 0 && rowIndex === rows.length - 1 ? lastRowFirstInputRef : undefined}
                          type={column.kind === 'number' ? 'number' : 'text'}
                          value={row[column.id] || ''}
                          onChange={(e) => handleCellChange(rowIndex, column.id, e.target.value)}
                          readOnly={readOnly}
                          placeholder={
                            column.id === 'unit' ? 'кг/шт/л/упак' : column.id === 'name' ? 'Наименование' : ''
                          }
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            fontSize: '0.875rem',
                            boxSizing: 'border-box',
                            backgroundColor: readOnly ? '#f9fafb' : 'white',
                            cursor: readOnly ? 'default' : 'text',
                          }}
                        />
                      </td>
                    ))}
                    {!readOnly && (
                      <td style={{ padding: '0.5rem', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                        <button
                          onClick={() => handleDeleteRow(rowIndex)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            background: '#fee2e2',
                            color: '#991b1b',
                            border: '1px solid #fecaca',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                          }}
                        >
                          Удалить
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Кнопки внизу: Добавить строку слева, Закрыть и Сохранить справа */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div>
              {!readOnly && (
                <button
                  onClick={handleAddRow}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#0070f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  Добавить строку
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={onClose}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#f3f4f6',
                  color: '#111827',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Закрыть
              </button>
              {!readOnly && (
                <button
                  onClick={handleSave}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#0070f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  Сохранить
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
