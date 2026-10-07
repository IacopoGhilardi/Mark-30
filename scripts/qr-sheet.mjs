const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

// Link a cui punta il QR di una squadra: /play/{id} sul dominio indicato.
export function teamUrl(baseUrl, teamId) {
  const base = String(baseUrl ?? '').trim().replace(/\/+$/, '')

  if (!/^https?:\/\/[^\s/]+/.test(base)) {
    throw new Error('Indirizzo non valido: usa per esempio https://marcos30.netlify.app')
  }

  return `${base}/play/${teamId}`
}

// Pagina da stampare: un riquadro per squadra (nome, QR grande, link), 2 per riga.
export function buildSheetHtml(items) {
  const cards = items
    .map(
      (item) => `    <section class="card">
      <p class="label">SQUADRA ${String(item.id).padStart(2, '0')}</p>
      <h2>${escapeHtml(item.name)}</h2>
      <div class="qr">${item.svg}</div>
      <p class="how">Scansionate con la fotocamera del telefono di squadra</p>
      <p class="url">${escapeHtml(item.url)}</p>
    </section>`
    )
    .join('\n')

  return `<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <title>QR delle squadre — Marco's 30th</title>
  <style>
    @page { size: A4; margin: 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, Arial, sans-serif; color: #111; }
    .sheet { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
    .card { border: 1.5px solid #111; border-radius: 6mm; padding: 6mm; text-align: center; break-inside: avoid; }
    .label { margin: 0; font-size: 11px; font-weight: 800; letter-spacing: .2em; color: #666; }
    h2 { margin: 2mm 0 4mm; font-size: 24px; letter-spacing: .04em; }
    .qr svg { width: 62mm; height: 62mm; }
    .how { margin: 3mm 0 1mm; font-size: 11px; font-weight: 700; }
    .url { margin: 0; font-size: 9px; color: #666; word-break: break-all; }
  </style>
</head>
<body>
  <main class="sheet">
${cards}
  </main>
</body>
</html>
`
}
