export interface RentalContractPhoto {
  id: string
  name: string
  caption: string
  dataUrl: string
}

export const MAX_CONTRACT_PHOTOS = 6
export const MAX_PHOTO_CHARACTERS = 130000

export function validateContractPhotos(photos: RentalContractPhoto[]): void {
  if (photos.length > MAX_CONTRACT_PHOTOS) throw new Error('Inclua no máximo 6 fotos por contrato.')
  for (const photo of photos) {
    if (
      !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(photo.dataUrl) ||
      photo.dataUrl.length > MAX_PHOTO_CHARACTERS ||
      photo.caption.length > 200 ||
      photo.name.length > 160
    ) {
      throw new Error('Foto inválida ou muito grande. Remova e selecione novamente.')
    }
  }
}

export async function prepareContractPhoto(file: File): Promise<RentalContractPhoto> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Selecione fotos JPG, PNG ou WebP. Converta HEIC para JPG antes de anexar.')
  }
  if (file.size > 12 * 1024 * 1024) throw new Error('Cada arquivo deve ter até 12 MB.')
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const canvas = document.createElement('canvas')
    let dataUrl = ''
    for (const side of [1600, 1280, 1024, 800]) {
      const ratio = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight))
      canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio))
      canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio))
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Não foi possível preparar a imagem.')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      dataUrl = canvas.toDataURL('image/jpeg', 0.78)
      if (dataUrl.length <= MAX_PHOTO_CHARACTERS) break
    }
    const photo = { id: crypto.randomUUID(), name: file.name.slice(0, 160), caption: '', dataUrl }
    validateContractPhotos([photo])
    return photo
  } finally {
    URL.revokeObjectURL(url)
  }
}
