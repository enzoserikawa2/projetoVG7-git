import type { PhotoRotation } from '../domain/types'

async function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Não foi possível gerar a cópia da fotografia.'))),
      'image/jpeg',
      quality
    )
  })
}

async function loadImage(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' })
    } catch {
      // Alguns formatos suportados pela galeria não são decodificados por createImageBitmap.
    }
  }

  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = url
    await image.decode()
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function resize(
  blob: Blob,
  maxDimension: number,
  quality: number,
  rotationDegrees: PhotoRotation
): Promise<Blob> {
  const source = await loadImage(blob)
  const sourceWidth = source.width
  const sourceHeight = source.height
  const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight))
  const drawWidth = Math.max(1, Math.round(sourceWidth * scale))
  const drawHeight = Math.max(1, Math.round(sourceHeight * scale))
  const swapsDimensions = rotationDegrees === 90 || rotationDegrees === 270
  const width = swapsDimensions ? drawHeight : drawWidth
  const height = swapsDimensions ? drawWidth : drawHeight
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new Error('Processamento de imagem indisponível neste navegador.')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.translate(width / 2, height / 2)
  context.rotate((rotationDegrees * Math.PI) / 180)
  context.drawImage(source, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
  if ('close' in source && typeof source.close === 'function') source.close()
  return canvasToBlob(canvas, quality)
}

export async function createImageCopies(original: Blob, rotationDegrees: PhotoRotation = 0) {
  const [reportBlob, thumbnailBlob] = await Promise.all([
    resize(original, 2000, 0.84, rotationDegrees),
    resize(original, 560, 0.72, rotationDegrees)
  ])
  return { reportBlob, thumbnailBlob }
}
