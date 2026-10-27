import { useMemo, useState, type ReactNode } from 'react'

export type Dir = 'asc' | 'desc'

/** Orden por columna. Textos arrancan A-Z; numeros arrancan de mayor a menor. */
export function useSort<T>(rows: T[], get: Record<string, (r: T) => string | number>, init: string, initDir: Dir = 'desc') {
  const [key, setKey] = useState(init)
  const [dir, setDir] = useState<Dir>(initDir)

  const sorted = useMemo(() => {
    const f = get[key]
    if (!f) return rows
    const m = dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const x = f(a)
      const y = f(b)
      return (typeof x === 'string' && typeof y === 'string' ? x.localeCompare(y, 'es') : Number(x) - Number(y)) * m
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, key, dir])

  const pick = (k: string) => {
    if (k === key) return setDir(dir === 'asc' ? 'desc' : 'asc')
    const sample = rows[0] ? get[k]?.(rows[0]) : 0
    setKey(k)
    setDir(typeof sample === 'string' ? 'asc' : 'desc')
  }

  const th = (k: string, label: ReactNode, num = false) => (
    <th key={k} className={num ? 'num' : ''} aria-sort={key === k ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button className="sort" onClick={() => pick(k)} title="Ordenar">
        {label}
        <span aria-hidden="true">{key === k ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
      </button>
    </th>
  )

  return { sorted, th }
}
