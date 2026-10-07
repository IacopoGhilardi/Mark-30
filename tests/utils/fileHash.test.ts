import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { shortFileHash } from '../../app/utils/fileHash'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('shortFileHash', () => {
  it('sono i primi 8 caratteri dello SHA-256 del contenuto', async () => {
    const expected = createHash('sha256').update('ciao').digest('hex').slice(0, 8)
    await expect(shortFileHash(new File(['ciao'], 'a.jpg'))).resolves.toBe(expected)
  })

  it('non dipende dal nome del file', async () => {
    await expect(shortFileHash(new File(['x'], 'a.jpg'))).resolves.toBe(
      await shortFileHash(new File(['x'], 'altro.png'))
    )
  })

  it('contenuti diversi danno hash diversi', async () => {
    expect(await shortFileHash(new File(['uno'], 'a'))).not.toBe(await shortFileHash(new File(['due'], 'a')))
  })

  it('restituisce null senza crypto.subtle', async () => {
    vi.stubGlobal('crypto', {})
    await expect(shortFileHash(new File(['x'], 'a'))).resolves.toBeNull()
  })
})
