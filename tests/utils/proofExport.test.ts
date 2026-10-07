import { describe, expect, it, vi } from 'vitest'
import { unzipSync, strFromU8 } from 'fflate'
import { buildCsv, buildZip, proofFileName } from '../../app/utils/proofExport'
import type { ProofRow } from '../../app/types/export'

const row = (overrides: Partial<ProofRow> = {}): ProofRow => ({
  id: '1',
  teamId: 3,
  teamName: 'TEAM 3',
  missionId: 7,
  title: 'THE ALBUM COVER',
  category: 'TAKE THE SHOT',
  points: 15,
  completedAt: '2026-10-10T21:32:00',
  proofText: null,
  proofPath: 'team-3/mission-7-1700000000000.jpg',
  sizeBytes: 1024,
  ...overrides,
})

describe('proofFileName', () => {
  it('usa squadra, ora, id missione e titolo', () => {
    expect(proofFileName(row(), 'team-3/x.jpg')).toBe('TEAM 3/21-32 07 THE ALBUM COVER.jpg')
  })

  it('toglie accenti e simboli dal titolo', () => {
    const name = proofFileName(row({ title: 'Così è più "bello"/ok?' }), 'x.jpg')
    expect(name).toBe('TEAM 3/21-32 07 Cosi e piu bello ok.jpg')
  })

  it('usa l\'estensione del file, o bin se manca', () => {
    expect(proofFileName(row(), 'a/b.MP4')).toMatch(/\.mp4$/)
    expect(proofFileName(row(), 'a/senza')).toMatch(/\.bin$/)
  })
})

describe('buildCsv', () => {
  it('ha intestazione, BOM e una riga per prova', () => {
    const csv = buildCsv([row(), row({ missionId: 8, proofPath: null, proofText: 'ciao' })])
    const lines = csv.split('\r\n').filter(Boolean)

    expect(csv.startsWith('﻿')).toBe(true)
    expect(lines[0]).toBe('﻿squadra,missione_id,missione,categoria,punti,completata_il,testo,file')
    expect(lines).toHaveLength(3)
  })

  it('protegge virgole, virgolette e a capo nel testo', () => {
    const csv = buildCsv([row({ proofText: 'ciao, "Marco"\nbuon compleanno' })])
    expect(csv).toContain('"ciao, ""Marco""\nbuon compleanno"')
  })

  it('lascia vuota la colonna file per le prove solo testuali', () => {
    const csv = buildCsv([row({ proofPath: null, proofText: 'x' })])
    expect(csv.trim().split('\r\n')[1]!.endsWith(',x,')).toBe(true)
  })
})

describe('buildZip', () => {
  it('contiene i file con nomi leggibili e l\'indice', async () => {
    const fetchFile = vi.fn(async (path: string) => new TextEncoder().encode(`dati di ${path}`))
    const zip = unzipSync(await buildZip([row()], fetchFile))

    expect(Object.keys(zip).sort()).toEqual(['TEAM 3/21-32 07 THE ALBUM COVER.jpg', 'prove.csv'])
    expect(strFromU8(zip['TEAM 3/21-32 07 THE ALBUM COVER.jpg']!)).toBe(
      'dati di team-3/mission-7-1700000000000.jpg'
    )
  })

  it('non scarica niente per le prove senza file e le tiene nell\'indice', async () => {
    const fetchFile = vi.fn()
    const zip = unzipSync(
      await buildZip([row({ proofPath: null, proofText: 'solo testo' })], fetchFile)
    )

    expect(fetchFile).not.toHaveBeenCalled()
    expect(strFromU8(zip['prove.csv']!)).toContain('solo testo')
  })

  it('segnala l\'avanzamento', async () => {
    const onProgress = vi.fn()
    const rows = [row(), row({ missionId: 8, proofPath: 'team-3/b.jpg' })]

    await buildZip(rows, async () => new Uint8Array([1]), onProgress)

    expect(onProgress.mock.calls).toEqual([[0, 2], [1, 2], [2, 2]])
  })

  it('si interrompe se un download fallisce', async () => {
    await expect(
      buildZip([row()], async () => {
        throw new Error('rete assente')
      })
    ).rejects.toThrow('rete assente')
  })
})
