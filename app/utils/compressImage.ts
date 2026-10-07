export type CompressOptions = {
  maxSide?: number
  quality?: number
}

const DEFAULT_MAX_SIDE = 1600
const DEFAULT_QUALITY = 0.8

async function drawToBlob(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  quality: number
): Promise<Blob | null> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height)
    return canvas.convertToBlob({ type: 'image/jpeg', quality })
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height)

  return new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality)
  )
}

// Ridimensiona e ricomprime una foto in JPEG nel browser.
// Se il file non è un'immagine, se la compressione fallisce o se il risultato
// non è più leggero, restituisce il file originale.
export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file
  }

  const maxSide = options.maxSide ?? DEFAULT_MAX_SIDE
  const quality = options.quality ?? DEFAULT_QUALITY

  try {
    // 'from-image' applica l'orientamento EXIF (foto scattate in verticale)
    const bitmap = await createImageBitmap(file, {
      imageOrientation: 'from-image',
    })

    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const blob = await drawToBlob(bitmap, width, height, quality)
    bitmap.close()

    if (!blob || blob.size >= file.size) {
      return file
    }

    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  } catch {
    return file
  }
}
