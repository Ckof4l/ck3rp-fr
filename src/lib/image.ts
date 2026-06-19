import { supabase, IMAGE_BUCKET } from './supabase'

/* ============================================================================
   Images des lettres — compression côté client (canvas) puis envoi vers le
   bucket Storage. On ne stocke en base que le CHEMIN du fichier.
   ========================================================================== */

/** Compresse une image en JPEG, bornée à `maxDim` px sur son plus grand côté. */
export function compressImage(file: File, maxDim = 1280, quality = 0.72): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Image illisible.'))
      img.onload = () => {
        let { width: w, height: h } = img
        if (w > h && w > maxDim) {
          h = Math.round((h * maxDim) / w)
          w = maxDim
        } else if (h >= w && h > maxDim) {
          w = Math.round((w * maxDim) / h)
          h = maxDim
        }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Canvas indisponible.'))
        ctx.drawImage(img, 0, 0, w, h)
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Compression échouée.'))),
          'image/jpeg',
          quality,
        )
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

/**
 * Compresse puis téléverse l'image. Retourne le chemin stocké (à mettre dans
 * `ravens.image_path`). Le chemin est préfixé par l'id de l'expéditeur pour
 * rester rangé et conforme aux règles Storage.
 */
export async function uploadLetterImage(file: File, ownerId: string): Promise<string> {
  let blob = await compressImage(file)
  // Deuxième passe plus agressive si l'image reste lourde (> 1,5 Mo).
  if (blob.size > 1_500_000) blob = await compressImage(file, 900, 0.6)

  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
  const path = `${ownerId}/${stamp}.jpg`

  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: false,
  })
  if (error) throw error
  return path
}
