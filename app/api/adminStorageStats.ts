import type { StorageStats } from '../types/admin'

// Solo Irene: spazio usato dalle prove rispetto al limite, con avviso.
export function adminStorageStats(pin: string) {
  return callAdmin<StorageStats>('admin_storage_stats', pin)
}
