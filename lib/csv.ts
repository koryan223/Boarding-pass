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

// Reads CSV text into rows of cells. Cells wrapped in quotes may contain commas,
// doubled quotes and line breaks, which is how toCsv writes them.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char !== '"') cell += char
      else if (text[i + 1] === '"') {
        cell += '"'
        i++
      } else quoted = false
    } else if (char === '"' && cell.trim() === "") {
      cell = ""
      quoted = true
    } else if (char === ",") {
      row.push(cell)
      cell = ""
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
    } else cell += char
  }

  if (cell !== "" || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
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
