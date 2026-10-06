import * as XLSX from 'xlsx'
import { today } from './util'

export type CellValue = string | number | null

export interface SheetSpec {
  name: string
  rows: CellValue[][]
  /** column widths in characters */
  widths?: number[]
}

/** Write a real .xlsx file named `<screen>-<date>.xlsx` and trigger the download. */
export function exportXlsx(screen: string, sheets: SheetSpec[]): string {
  const wb = XLSX.utils.book_new()
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows)
    const widths =
      s.widths ??
      (s.rows[0] ?? []).map((_, c) => Math.min(48, Math.max(8, ...s.rows.map((r) => String(r[c] ?? '').length + 2))))
    ws['!cols'] = widths.map((w) => ({ wch: w }))
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '))
  }
  const file = `${screen}-${today()}.xlsx`
  XLSX.writeFile(wb, file)
  return file
}

export interface ParsedSheet {
  name: string
  headers: string[]
  rows: Record<string, string>[]
}

/** Read every sheet of an .xlsx/.xls workbook into header + row objects. */
export async function readWorkbook(file: File): Promise<ParsedSheet[]> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name]
    const aoa = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(ws, { header: 1, defval: '', raw: false, blankrows: false })
    const headerRow = (aoa[0] ?? []).map((h) => String(h ?? '').trim())
    const headers = headerRow.filter(Boolean)
    const rows = aoa.slice(1).map((r) => {
      const o: Record<string, string> = {}
      headerRow.forEach((h, i) => {
        if (h) o[h] = String(r[i] ?? '').trim()
      })
      return o
    })
    return { name, headers, rows: rows.filter((r) => Object.values(r).some((v) => v !== '')) }
  })
}
