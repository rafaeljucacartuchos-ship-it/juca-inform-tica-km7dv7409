const PB_URL = import.meta.env.VITE_POCKETBASE_URL

export interface PropostaItem {
  id: string
  tipo: 'produto' | 'servico'
  descricao: string
  quantidade: number
  valor_unitario: number
  desconto_item: number
  desconto_item_tipo: string
  valor_total_item: number
}

export interface PropostaAnexo {
  id: string
  tipo: string
  legenda?: string
  caminho_arquivo: string
  url: string
}

export interface PropostaData {
  id: string
  token_acesso: string
  numero_orcamento: string
  status: string
  validade?: number
  observacoes?: string
  created: string
  updated: string
  forma_pagamento?: string
  parcelas?: number
  entrada?: number
  restante?: number
  status_pagamento?: string
  subtotal: number
  desconto_total_valor: number
  desconto_total_tipo: string
  desconto_total_percentual: number
  total_geral: number
  data_assinatura_cliente?: string
  ip_dispositivo?: string
  motivo_rejeicao?: string
  assinatura_cliente_url?: string | null
  assinatura_tecnico_url?: string | null
  data_assinatura_tecnico?: string
  has_customer_signature: boolean
  has_technician_signature?: boolean
  os: {
    id: string
    number: string
    title?: string
    description?: string
    equipment?: string
    status?: string
    diagnostic?: string
    service_report?: string
    notes?: string
    priority?: string
    created?: string
    attendance_date?: string
    attendance_time?: string
    started_at?: string
  } | null
  customer: {
    id: string
    name: string
    phone: string
    cpf_cnpj?: string
    street?: string
    number?: string
    city?: string
    state?: string
  } | null
  technician: {
    id: string
    name: string
  } | null
  equipment: {
    id: string
    name: string
    brand: string
    model: string
    type: string
  } | null
  items: PropostaItem[]
  anexos: PropostaAnexo[]
}

export interface AprovarPropostaResult {
  success?: boolean
  alreadyApproved?: boolean
  status: string
  data_assinatura_cliente?: string
  numero_orcamento?: string
  os_number?: string
  customer_name?: string
  equipment_name?: string
  message?: string
}

/**
 * Busca os dados públicos da proposta pelo token_acesso
 */
export async function getPropostaByToken(token: string): Promise<PropostaData> {
  const res = await fetch(`${PB_URL}/backend/v1/proposta/${encodeURIComponent(token)}`)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Proposta não encontrada ou link inválido')
  }
  return res.json()
}

/**
 * Aprova a proposta com assinatura digital (base64)
 */
export async function aprovarPropostaByToken(
  token: string,
  signatureBase64?: string,
): Promise<AprovarPropostaResult> {
  const res = await fetch(`${PB_URL}/backend/v1/proposta/${encodeURIComponent(token)}/aprovar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signature: signatureBase64 || '' }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao aprovar proposta')
  }
  return data
}
