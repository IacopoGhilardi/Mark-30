// Primi 8 caratteri dello SHA-256 del contenuto: stessi byte, stesso nome.
// Restituisce null se il browser non offre crypto.subtle (pagina non sicura).
export async function shortFileHash(file: File): Promise<string | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return null
  }

  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())

  return [...new Uint8Array(digest)]
    .slice(0, 4)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
