// Durata di un video letta dai metadati, senza caricarlo. null se il browser non la legge.
export function getVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    let done = false

    const finish = (value: number | null) => {
      if (done) return
      done = true
      clearTimeout(timer)
      URL.revokeObjectURL(url)
      resolve(value)
    }

    const timer = setTimeout(() => finish(null), 4000)

    video.preload = 'metadata'
    video.onloadedmetadata = () =>
      finish(Number.isFinite(video.duration) ? video.duration : null)
    video.onerror = () => finish(null)
    video.src = url
  })
}

// Un po' di tolleranza oltre i 10 secondi dichiarati.
export const MAX_VIDEO_SECONDS = 12
