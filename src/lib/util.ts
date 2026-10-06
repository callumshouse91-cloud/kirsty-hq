let counter = 0

export function uid(prefix: string): string {
  counter = (counter + 1) % 1_000_000
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'tool'
  )
}

export function uniqueId(base: string, taken: Set<string>): string {
  let id = base
  let n = 2
  while (taken.has(id)) id = `${base}-${n++}`
  taken.add(id)
  return id
}

export function today(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function fmtDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`
}

export function fmtNum(n: number, dp = 0): string {
  return n.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}

/** £k with thousands separators, e.g. "£1,250k". Values ≥ £10m shown as £m. */
export function fmtK(n: number): string {
  if (Math.abs(n) >= 10_000) return `£${fmtNum(n / 1000, 1)}m`
  return `£${fmtNum(n, n % 1 === 0 ? 0 : 1)}k`
}

export function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 100)
}

/** Lower-case alphanumerics only — for comparing headers like "Est Annual Cost (£k)". */
export function headerKey(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function splitMulti(v: string): string[] {
  return v
    .split('&')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function joinMulti(vs: string[]): string {
  return vs.join(' & ')
}

export function uniq<T>(xs: Iterable<T>): T[] {
  return [...new Set(xs)]
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${fmtNum(n)} ${n === 1 ? one : many}`
}

export function byName<T extends { name: string }>(a: T, b: T): number {
  return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
}
