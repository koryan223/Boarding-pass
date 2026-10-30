type CsvValue = string | number | boolean | null | undefined

// Prefixing cells that start with formula characters stops spreadsheet apps from executing them.
function escapeCell(value: CsvValue): string {
  let text = value === null || value === undefined ? "" : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  return [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n")
}

export function downloadFile(filename: string, content: Blob | string, type = "text/csv;charset=utf-8") {
  const blob = typeof content === "string" ? new Blob(["\uFEFF", content], { type }) : content
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
