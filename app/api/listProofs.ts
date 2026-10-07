import type { ProofRow } from '../types/export'

// Tutte le missioni completate con la prova (solo admin).
export function listProofs() {
  return callRpc<ProofRow[]>('admin_list_proofs')
}
