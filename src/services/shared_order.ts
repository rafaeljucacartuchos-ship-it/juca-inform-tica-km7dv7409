const PB_URL = import.meta.env.VITE_POCKETBASE_URL

export interface SharedOrderData {
  id: string
  number: string
  status: string
  title: string
  description: string
  service_report: string
  total: number
  attendance_date: string
  attendance_time: string
  created: string
  customer: {
    name: string
    phone: string
    street?: string
    number?: string
    city?: string
    state?: string
  } | null
  equipment: {
    name: string
    brand: string
    model: string
    type: string
  } | null
  items: Array<{
    description: string
    quantity: number
    unit_price: number
    total: number
  }>
  has_customer_signature: boolean
}

export const getSharedOrder = async (id: string): Promise<SharedOrderData> => {
  const res = await fetch(`${PB_URL}/backend/v1/shared-order/${id}`)
  if (!res.ok) throw new Error('Falha ao carregar ordem')
  return res.json()
}

export const saveCustomerSignaturePublic = async (id: string, blob: Blob) => {
  const formData = new FormData()
  formData.append('signature', blob, 'signature.png')
  const res = await fetch(`${PB_URL}/backend/v1/shared-order/${id}/sign`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) throw new Error('Falha ao salvar assinatura')
  return res.json()
}
