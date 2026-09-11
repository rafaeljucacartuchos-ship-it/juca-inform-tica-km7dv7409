export type UserRole = 'admin' | 'attendant' | 'technician'

export type NotificationType = 'service_order' | 'appointment' | 'payment' | 'system'

export interface AppNotification {
  id: string
  user: string
  title: string
  message: string
  type: NotificationType
  read: boolean
  link?: string
  created?: string
  updated?: string
}

export type ServiceCategory =
  | 'hardware'
  | 'software'
  | 'rede'
  | 'manutencao_preventiva'
  | 'instalacao'
  | 'outros'

export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  hardware: 'Hardware',
  software: 'Software',
  rede: 'Rede',
  manutencao_preventiva: 'Manutenção Preventiva',
  instalacao: 'Instalação',
  outros: 'Outros',
}

export interface User {
  id: string
  email: string
  username?: string
  name: string
  role: UserRole
  phone?: string
  avatar?: string
  permissions?: Record<string, boolean> | null
  ativo?: boolean
  created?: string
  updated?: string
}

export interface Customer {
  id: string
  // Novos campos padronizados conforme planilha:
  razao_social?: string
  nome_fantasia?: string
  endereco?: string
  bairro?: string
  celular?: string
  rg_ie?: string
  cpf_cnpj?: string
  whatsapp_consent?: boolean
  // Campos de compatibilidade legado (mantidos no banco)
  name?: string
  email?: string
  phone?: string
  street?: string
  number?: string
  city?: string
  state?: string
  zip?: string
  notes?: string
  created?: string
  updated?: string
}

export type AppointmentStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'

export interface Appointment {
  id: string
  customer: string
  technician: string
  date: string
  start_time?: string
  end_time?: string
  status: AppointmentStatus
  address_note?: string
  notes?: string
  created?: string
  updated?: string
  expand?: {
    customer?: Customer
    technician?: User
  }
}

export type OrderStatus =
  | 'open'
  | 'in_progress'
  | 'paused'
  | 'waiting_parts'
  | 'completed'
  | 'closed'
  | 'cancelled'
  | 'aguardando_orcamento'
  | 'orcamento_enviado'
  | 'orcamento_aprovado'
  | 'orcamento_rejeitado'
export type OrderPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface ServiceType {
  id: string
  name: string
  active?: boolean
  created?: string
  updated?: string
}

export interface ServiceOrder {
  id: string
  number: string
  customer: string
  technician?: string
  appointment?: string
  attendance_type?: string
  status: OrderStatus
  priority: OrderPriority
  title: string
  description?: string
  equipment?: string
  diagnostic?: string
  estimated_cost?: number
  total?: number
  notes?: string
  service_report?: string
  technician_signature?: string
  customer_signature?: string
  equipment_ref?: string
  attendance_date?: string
  attendance_time?: string
  started_at?: string
  signed_at?: string
  /** Indica se o estoque dos produtos da O.S. já foi descontado (uma única vez). */
  stock_deducted?: boolean
  desconto?: number
  acrescimo?: number
  created?: string
  updated?: string
  expand?: {
    customer?: Customer
    technician?: User
    appointment?: Appointment
    equipment_ref?: Equipment
    attendance_type?: ServiceType
  }
}

export interface CatalogService {
  id: string
  name?: string
  title?: string
  description?: string
  price: number
  estimated_duration: number
  active: boolean
  category: ServiceCategory
  created?: string
  updated?: string
}

/**
 * Serviço importado da planilha (tabela `services` estendida).
 * Inclui os campos da planilha: title, description, price, external_code,
 * status, obs, obs_template, obs_editable, cnae — além dos campos de catálogo.
 */
export interface Service {
  id: string
  name?: string
  title?: string
  description?: string
  price?: number
  external_code?: string
  status?: string
  obs?: string
  obs_template?: string
  obs_editable?: boolean
  cnae?: string
  active?: boolean
  category?: ServiceCategory
  estimated_duration?: number
  created?: string
  updated?: string
}

export interface ServiceOrderItem {
  id: string
  service_order: string
  service?: string
  /** Produto vinculado (peça/produto, não serviço) — usado para baixa de estoque. */
  product?: string
  description: string
  quantity: number
  unit_price: number
  total: number
  created?: string
  updated?: string
  expand?: {
    service?: CatalogService
    product?: Product
  }
}

export interface StatusHistory {
  id: string
  service_order: string
  status: OrderStatus
  note?: string
  changed_by?: string
  created?: string
  updated?: string
  expand?: {
    changed_by?: User
  }
}

export type PaymentMethod = 'cash' | 'pix' | 'credit_card' | 'debit_card' | 'transfer'
export type PaymentStatus = 'pending' | 'paid' | 'refunded'

export interface Payment {
  id: string
  service_order: string
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  paid_at?: string
  notes?: string
  created?: string
  updated?: string
}

export type ProductType = 'produto' | 'servico'

export interface Product {
  id: string
  name: string
  description?: string
  sku?: string
  barcode?: string
  codigo_barras?: string
  search_text?: string
  price?: number
  cost?: number
  category?: string
  fabricante?: string
  type?: ProductType
  /** URL externa da foto (ex: Pexels). */
  photo?: string
  /** Foto enviada como arquivo (câmera/galeria) — exibida via getFileUrl. */
  photo_file?: string
  stock_quantity?: number
  active?: boolean
  created?: string
  updated?: string
}

export type EquipmentType =
  | 'notebook'
  | 'desktop'
  | 'monitor'
  | 'printer'
  | 'smartphone'
  | 'tablet'
  | 'network'
  | 'other'

export interface Equipment {
  id: string
  customer: string
  name: string
  type?: EquipmentType
  brand?: string
  model?: string
  serial_number?: string
  notes?: string
  photos?: string[]
  created?: string
  updated?: string
  expand?: {
    customer?: Customer
  }
}

export interface ServiceAttachment {
  id: string
  service_order: string
  file: string
  caption?: string
  created?: string
  updated?: string
}

export type PosVendaTipo =
  | 'resumo_finalizacao'
  | 'checkin_pos_venda'
  | 'avaliacao_tecnico'
  | 'avaliacao_google'
  | 'avaliacao_30min'
  | 'pos_venda_7d'
  | 'oferta_30d'
export type PosVendaStatus = 'pending' | 'ready' | 'sent' | 'dismissed'

export interface PosVendaMessage {
  id: string
  customer: string
  service_order?: string
  tipo: PosVendaTipo
  status: PosVendaStatus
  scheduled_at?: string
  sent_at?: string
  texto_gerado?: string
  wa_me_link?: string
  channel?: string
  cliente_respondeu?: boolean
  cliente_respondeu_em?: string
  avaliacoes_liberadas?: boolean
  created?: string
  updated?: string
  expand?: {
    customer?: Customer
    service_order?: ServiceOrder
  }
}

export interface SystemSetting {
  id: string
  key: string
  value: string
  description?: string
  created?: string
  updated?: string
}

export type CampaignStatus = 'draft' | 'active' | 'archived'

export interface Campaign {
  id: string
  title: string
  description?: string
  target_audience?: string
  template_text: string
  flyer?: string
  status: CampaignStatus
  created?: string
  updated?: string
}

export type CampanhaMessageStatus = 'pending' | 'sent' | 'dismissed'

export interface CampanhaMessage {
  id: string
  campaign: string
  customer: string
  status: CampanhaMessageStatus
  sent_at?: string
  texto_gerado?: string
  wa_me_link?: string
  channel?: string
  created?: string
  updated?: string
  expand?: {
    campaign?: Campaign
    customer?: Customer
  }
}

export type OrcamentoStatus =
  | 'rascunho'
  | 'enviado'
  | 'aguardando_aprovacao'
  | 'aprovado'
  | 'rejeitado'
  | 'substituido'
  | 'faturado'

export type OrcamentoDescontoTipo = 'percentual' | 'valor'
export type OrcamentoFormaPagamento =
  | 'dinheiro'
  | 'pix'
  | 'cartao_debito'
  | 'cartao_credito'
  | 'boleto'
  | 'crediario'
  | 'outros'
export type OrcamentoStatusPagamento = 'pendente' | 'parcial' | 'pago'

export interface Orcamento {
  id: string
  id_os?: string
  numero_orcamento: string
  status: OrcamentoStatus
  validade?: number
  observacoes?: string
  id_usuario_criador?: string
  // Campos para orçamentos independentes (v0.0.146)
  cliente_id?: string
  nome_cliente_livre?: string
  telefone_cliente_livre?: string
  responsavel_id?: string
  equipamento_independente?: string
  defeito_independente?: string
  desconto_total_valor?: number
  desconto_total_tipo?: OrcamentoDescontoTipo
  desconto_total_percentual?: number
  justificativa_desconto?: string
  forma_pagamento?: OrcamentoFormaPagamento
  parcelas?: number
  entrada?: number
  restante?: number
  status_pagamento?: OrcamentoStatusPagamento
  assinatura_cliente?: string
  assinatura_tecnico?: string
  data_assinatura_cliente?: string
  data_assinatura_tecnico?: string
  ip_dispositivo?: string
  motivo_rejeicao?: string
  subtotal?: number
  total_geral?: number
  token_acesso?: string
  created?: string
  updated?: string
  expand?: {
    id_os?: ServiceOrder
    id_usuario_criador?: User
    cliente_id?: Customer
    responsavel_id?: User
  }
}

export type OrcamentoItemTipo = 'produto' | 'servico'

export interface OrcamentoItem {
  id: string
  id_orcamento: string
  tipo: OrcamentoItemTipo
  id_produto?: string
  descricao: string
  quantidade: number
  valor_unitario: number
  desconto_item?: number
  desconto_item_tipo?: OrcamentoDescontoTipo
  valor_total_item: number
  created?: string
  updated?: string
  expand?: {
    id_produto?: Product
  }
}

export type OrcamentoAnexoTipo = 'foto_equipamento' | 'foto_defeito' | 'documento'

export interface OrcamentoAnexo {
  id: string
  id_orcamento: string
  tipo: OrcamentoAnexoTipo
  caminho_arquivo: string
  legenda?: string
  created?: string
  updated?: string
}
