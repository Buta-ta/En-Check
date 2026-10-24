export const AVATAR_SIZE = 512
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024
export function validateAvatarSource(file) {
  if (
    !file ||
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size <= 0 ||
    file.size > AVATAR_MAX_BYTES
  ) {
    throw new Error('Choisissez une image JPG, PNG ou WebP de 2 Mo maximum.')
  }
}
export function avatarCropRect(
  width,
  height,
  zoom = 1,
  horizontal = 50,
  vertical = 50,
) {
  if (
    ![width, height, zoom, horizontal, vertical].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0 ||
    width * height > 20000000
  ) {
    throw new Error(
      'Image non prise en charge : dimensions invalides ou supérieures à 20 mégapixels.',
    )
  }
  const size = Math.min(width, height) / Math.min(3, Math.max(1, zoom))
  return {
    x: ((width - size) * Math.min(100, Math.max(0, horizontal))) / 100,
    y: ((height - size) * Math.min(100, Math.max(0, vertical))) / 100,
    size,
  }
}
export function drawAvatarCrop(canvas, image, zoom, horizontal, vertical) {
  const rect = avatarCropRect(
    image.naturalWidth,
    image.naturalHeight,
    zoom,
    horizontal,
    vertical,
  )
  const ctx = canvas.getContext('2d')
  if (!ctx)
    throw new Error('Le recadrage n’est pas disponible dans ce navigateur.')
  canvas.width = AVATAR_SIZE
  canvas.height = AVATAR_SIZE
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.clearRect(0, 0, AVATAR_SIZE, AVATAR_SIZE)
  ctx.drawImage(
    image,
    rect.x,
    rect.y,
    rect.size,
    rect.size,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE,
  )
}
export async function exportAvatarCrop(canvas) {
  const blob = await new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (result) =>
          result
            ? resolve(result)
            : reject(new Error('L’image n’a pas pu être préparée. Réessayez.')),
        'image/webp',
        0.92,
      )
    } catch {
      reject(
        new Error(
          'Impossible de préparer cette image. Choisissez un autre fichier.',
        ),
      )
    }
  })
  // Browsers without WebP encoding fall back to PNG. Do not mislabel those bytes.
  if (
    !['image/webp', 'image/png'].includes(blob.type) ||
    blob.size > AVATAR_MAX_BYTES ||
    !blob.size
  )
    throw new Error('Image exportée non prise en charge.')
  return new File(
    [blob],
    blob.type === 'image/webp' ? 'avatar.webp' : 'avatar.png',
    { type: blob.type },
  )
}
