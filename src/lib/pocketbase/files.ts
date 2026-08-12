const baseUrl = (import.meta.env.VITE_POCKETBASE_URL || '').replace(/\/$/, '')

export function getFileUrl(
  recordId: string,
  filename: string,
  collection: string,
  thumb?: string,
): string {
  let url = `${baseUrl}/api/files/${collection}/${recordId}/${filename}`
  if (thumb) url += `?thumb=${thumb}`
  return url
}
