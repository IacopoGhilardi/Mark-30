import { strToU8, zipSync } from 'fflate'
import type { ProofRow } from '../types/export'

const clean = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()

function extension(path: string) {
  const ext = path.includes('.') ? path.split('.').pop()! : 'bin'
  return ext.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

// Nome file leggibile: "TEAM 3/14-32 07 THE ALBUM COVER.jpg" (ora, id missione, titolo).
export function proofFileName(row: ProofRow, path: string) {
  const date = new Date(row.completedAt)
  const time = `${pad(date.getHours())}-${pad(date.getMinutes())}`
  const mission = String(row.missionId).padStart(2, '0')

  return `${clean(row.teamName)}/${time} ${mission} ${clean(row.title)}.${extension(path)}`
}

const csvCell = (value: unknown) => {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

// Indice di tutte le prove (anche quelle solo testuali, che stanno nel DB).
export function buildCsv(rows: ProofRow[]) {
  const header = ['squadra', 'missione_id', 'missione', 'categoria', 'punti', 'completata_il', 'testo', 'file']

  const lines = rows.map((row) =>
    [
      row.teamName,
      row.missionId,
      row.title,
      row.category,
      row.points,
      row.completedAt,
      row.proofText,
      row.proofPath ? proofFileName(row, row.proofPath) : '',
    ]
      .map(csvCell)
      .join(',')
  )

  // BOM iniziale: Excel apre correttamente gli accenti
  return '﻿' + [header.join(','), ...lines].join('\r\n') + '\r\n'
}

// ZIP con i file di una squadra più l'indice. I file sono già compressi
// (JPEG/MP4): livello 0, quindi niente tempo e memoria sprecati.
export async function buildZip(
  rows: ProofRow[],
  fetchFile: (path: string) => Promise<Uint8Array>,
  onProgress?: (done: number, total: number) => void
) {
  const withFile = rows.filter((row) => row.proofPath)
  const entries: Record<string, [Uint8Array, { level: 0 }]> = {}

  let done = 0
  onProgress?.(done, withFile.length)

  for (const row of withFile) {
    const data = await fetchFile(row.proofPath!)
    entries[proofFileName(row, row.proofPath!)] = [data, { level: 0 }]
    onProgress?.(++done, withFile.length)
  }

  entries['prove.csv'] = [strToU8(buildCsv(rows)), { level: 0 }]

  return zipSync(entries)
}

// Avvia il salvataggio di un file dal browser (anche su iOS/Android).
export function saveFile(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const link = document.createElement('a')

  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()

  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
