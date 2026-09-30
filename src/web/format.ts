export function compact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1e9) return (n / 1e9).toFixed(abs >= 1e10 ? 1 : 2).replace(/\.0+$/, '') + 'B'
  if (abs >= 1e6) return (n / 1e6).toFixed(abs >= 1e7 ? 1 : 2).replace(/\.0+$/, '') + 'M'
  if (abs >= 1e3) return (n / 1e3).toFixed(abs >= 1e4 ? 1 : 2).replace(/\.0+$/, '') + 'k'
  return String(Math.round(n))
}

export const int = (n: number) => n.toLocaleString('es-MX')

export const pct = (x: number) => (x * 100).toFixed(1) + '%'

export function hourLabel(h: number | null): string {
  if (h === null) return '-'
  const suffix = h >= 12 ? 'p. m.' : 'a. m.'
  return `${h % 12 === 0 ? 12 : h % 12} ${suffix}`
}

export function dayLabel(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }).replace('.', '')
}

export function niceMax(v: number): number {
  if (v <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  const n = v / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p
}

export function dateLabel(ts: number): string {
  return new Date(ts).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: '2-digit' }).replace('.', '')
}
