import type { ProofRow } from '../types/export'

// Missioni completate con l'eventuale prova (per l'esportazione).
export function adminListProofs(pin: string) {
  return callAdmin<ProofRow[]>('admin_list_proofs', pin)
}
