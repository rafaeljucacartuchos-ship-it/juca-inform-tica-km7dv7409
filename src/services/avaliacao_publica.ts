const PB_URL = import.meta.env.VITE_POCKETBASE_URL

export interface PublicAvaliacaoData {
  id: string
  token: string
  customerName: string
  firstName: string
  orderNumber: string
  equipment?: string
  technicianName?: string
  jaAvaliado: boolean
  nota?: number | null
  statusFunil: string
  googleReviewUrl: string
}

export interface SubmitAvaliacaoResult {
  success?: boolean
  alreadyEvaluated?: boolean
  nota: number
  statusFunil: string
  isSatisfied: boolean
  googleReviewUrl: string
  customerName?: string
  orderNumber?: string
  message: string
}

/**
 * Busca dados da avaliação pública pelo token opaco
 */
export async function getAvaliacaoPublica(token: string): Promise<PublicAvaliacaoData> {
  const res = await fetch(`${PB_URL}/backend/v1/avaliar/${encodeURIComponent(token)}`)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Avaliação não encontrada ou link expirado.')
  }
  return res.json()
}

/**
 * Registra a nota da avaliação de 0 a 5 automaticamente ao clique do cliente
 */
export async function submitAvaliacaoPublica(
  token: string,
  nota: number,
  feedback?: string,
): Promise<SubmitAvaliacaoResult> {
  const res = await fetch(`${PB_URL}/backend/v1/avaliar/${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nota, feedback: feedback || '' }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao registrar avaliação.')
  }
  return data
}
