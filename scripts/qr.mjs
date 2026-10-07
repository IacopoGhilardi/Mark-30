// Genera i QR delle squadre: un SVG per squadra + una pagina da stampare.
// Uso: npm run qr -- https://il-tuo-sito.netlify.app
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import QRCode from 'qrcode'
import { teams } from '../app/datas/teams.ts'
import { buildSheetHtml, teamUrl } from './qr-sheet.mjs'

const baseUrl = process.argv[2]

if (!baseUrl) {
  console.error('Manca l\'indirizzo del sito. Esempio: npm run qr -- https://marcos30.netlify.app')
  process.exit(1)
}

const outDir = fileURLToPath(new URL('../qr/', import.meta.url))
mkdirSync(outDir, { recursive: true })

const items = []

for (const team of teams) {
  const url = teamUrl(baseUrl, team.id)
  // livello di correzione alto: il QR resta leggibile anche se stampato piccolo o rovinato
  const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'H', margin: 2 })

  writeFileSync(`${outDir}team-${team.id}.svg`, svg)
  items.push({ id: team.id, name: team.name, url, svg })
}

writeFileSync(`${outDir}stampa.html`, buildSheetHtml(items))

console.log(`Creati ${items.length} QR in qr/`)
console.log('Apri qr/stampa.html nel browser e stampa (o salva in PDF).')
console.log(`Esempio: ${items[0].url}`)
