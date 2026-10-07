// Link a cui punta il QR di una squadra: /play/{id} sul dominio indicato.
export function teamUrl(baseUrl: string | undefined | null, teamId: number): string {
  const base = String(baseUrl ?? '').trim().replace(/\/+$/, '')

  if (!/^https?:\/\/[^\s/]+/.test(base)) {
    throw new Error('Indirizzo non valido: usa per esempio https://marcos30.netlify.app')
  }

  return `${base}/play/${teamId}`
}

// Indirizzi che un telefono fuori dalla rete locale non può raggiungere.
export function isLocalOrigin(baseUrl: string | undefined | null): boolean {
  const host = String(baseUrl ?? '')
    .trim()
    .replace(/^https?:\/\//, '')
    .split(/[/:?#]/)[0]
    ?.toLowerCase()

  if (!host) return false

  return (
    host === 'localhost' ||
    host.endsWith('.local') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  )
}

// SVG del QR. Livello di correzione alto: si legge anche se stampato piccolo o rovinato.
// La libreria si carica solo quando serve (pagina admin).
export async function makeQrSvg(url: string): Promise<string> {
  const QRCode = await import('qrcode')

  return QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'H', margin: 2 })
}
