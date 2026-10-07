// 1536 -> "1,5 KB". Unità a base 1024, virgola decimale all'italiana.
export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes < 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index
  const text = index === 0 ? String(Math.round(value)) : value.toFixed(1).replace('.', ',')

  return `${text} ${units[index]}`
}
