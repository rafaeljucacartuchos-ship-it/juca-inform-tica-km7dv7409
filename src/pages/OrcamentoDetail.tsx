import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit,
  ScanLine,
  Search,
  MessageCircle,
  Share2,
  Printer,
  FileCheck,
  CheckCircle,
  XCircle,
  CreditCard,
  DollarSign,
  AlertTriangle,
  Send,
  Loader2,
  FileText,
  Lock,
  Link as LinkIcon,
  Copy,
  ExternalLink,
  Package,
  Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Orcamento,
  OrcamentoItem,
  OrcamentoAnexo,
  OrcamentoStatus,
  OrcamentoFormaPagamento,
  OrcamentoDescontoTipo,
  Product,
  User,
  Customer,
} from '@/types'
import {
  getOrcamento,
  getOrcamentoItens,
  getOrcamentoAnexos,
  updateOrcamento,
  deleteOrcamentoItem,
  createOrcamentoItem,
  recalculateOrcamentoTotals,
  sendOrcamentoToFaturamento,
  updateOsStatus,
} from '@/services/orcamentos'
import { getServiceOrder } from '@/services/service_orders'
import { getProduct } from '@/services/products'
import { getCustomerPhone, getCustomerDisplayName, getCustomers } from '@/services/customers'
import { getUsers } from '@/services/users'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { BarcodeScanner } from '@/components/BarcodeScanner'
import { OrcamentoItemModal } from '@/components/OrcamentoItemModal'
import {
  OrcamentoServicoSelectModal,
  SelectedServicoCadastrado,
} from '@/components/OrcamentoServicoSelectModal'
import { OrcamentoPhotos } from '@/components/OrcamentoPhotos'
import { OrcamentoAssinaturaModal } from '@/components/OrcamentoAssinaturaModal'
import {
  openWhatsApp,
  buildWhatsAppUrl,
  buildOrcamentoPropostaMessage,
  buildOrcamentoAprovadoAgradecimentoMessage,
} from '@/lib/whatsapp'
import { generateRandomToken } from '@/services/orcamentos'

const STATUS_CONFIG: Record<
  OrcamentoStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  rascunho: {
    label: 'Rascunho',
    color: 'text-slate-700',
    bg: 'bg-slate-100',
    border: 'border-slate-300',
  },
  enviado: {
    label: 'Enviado',
    color: 'text-blue-700',
    bg: 'bg-blue-100',
    border: 'border-blue-300',
  },
  aguardando_aprovacao: {
    label: 'Aguardando Aprovação',
    color: 'text-amber-700',
    bg: 'bg-amber-100',
    border: 'border-amber-300',
  },
  aprovado: {
    label: 'Aprovado',
    color: 'text-emerald-700',
    bg: 'bg-emerald-100',
    border: 'border-emerald-300',
  },
  rejeitado: {
    label: 'Rejeitado',
    color: 'text-rose-700',
    bg: 'bg-rose-100',
    border: 'border-rose-300',
  },
  substituido: {
    label: 'Substituído',
    color: 'text-zinc-600',
    bg: 'bg-zinc-100',
    border: 'border-zinc-300',
  },
  faturado: {
    label: 'Faturado',
    color: 'text-purple-700',
    bg: 'bg-purple-100',
    border: 'border-purple-300',
  },
}

export default function OrcamentoDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()

  const [orcamento, setOrcamento] = useState<Orcamento | null>(null)
  const [items, setItems] = useState<OrcamentoItem[]>([])
  const [anexos, setAnexos] = useState<OrcamentoAnexo[]>([])
  const [loading, setLoading] = useState(true)
  const [parcelasInput, setParcelasInput] = useState<string>('1')

  // Modais auxiliares
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [modalDefaultKind, setModalDefaultKind] = useState<'produto' | 'servico'>('produto')
  const [modalLockKind, setModalLockKind] = useState(false)
  const [servicoSelectModalOpen, setServicoSelectModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<OrcamentoItem | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [signatureModalOpen, setSignatureModalOpen] = useState(false)
  const [signerRole, setSignerRole] = useState<'customer' | 'technician'>('customer')
  const [faturamentoConfirmOpen, setFaturamentoConfirmOpen] = useState(false)
  const [faturamentoSuccessModalOpen, setFaturamentoSuccessModalOpen] = useState(false)
  const [faturamentoSuccessData, setFaturamentoSuccessData] = useState<{
    mensagem: string
    isReenvio: boolean
    osNumber: string
    orcNumber: string
    copiedSuccessfully: boolean
    documentoUrl?: string
  } | null>(null)
  const [rejeicaoModalOpen, setRejeicaoModalOpen] = useState(false)
  const [motivoRejeicao, setMotivoRejeicao] = useState('')
  const [printSelectOpen, setPrintSelectOpen] = useState(false)

  // Usuários para seleção de responsável e clientes para busca/autocomplete
  const [systemUsers, setSystemUsers] = useState<User[]>([])
  const [customerSearchQuery, setCustomerSearchQuery] = useState('')
  const [customerSearchResults, setCustomerSearchResults] = useState<Customer[]>([])
  const [searchingCustomers, setSearchingCustomers] = useState(false)
  const [customerSearchDropdownOpen, setCustomerSearchDropdownOpen] = useState(false)

  // Observação / justificativa opcional de desconto
  const [justificativaDesconto, setJustificativaDesconto] = useState('')

  // Permissões
  const isManagerOrAdmin = user?.role === 'admin'
  const isLocked = orcamento?.status === 'faturado' || orcamento?.status === 'substituido'
  const canEdit = !isLocked

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadAll = useCallback(async () => {
    if (!id) return
    try {
      // 1. Tenta buscar o orçamento diretamente pelo ID
      let o: Orcamento | null = null
      try {
        o = await getOrcamento(id)
      } catch (errFirst) {
        console.warn('getOrcamento direto falhou, tentando fallback:', errFirst)
        // Fallback: se 'id' for na verdade um id_os ou número de OS, tenta buscar o orçamento da OS
        try {
          const list = await pb.collection('orcamentos').getFullList<Orcamento>({
            filter: `id_os = "${id}" || numero_orcamento = "${id}"`,
            sort: '-created',
            expand:
              'id_os,id_usuario_criador,cliente_id,responsavel_id,id_os.customer,id_os.technician,id_os.equipment_ref',
          })
          if (list.length > 0) {
            o = list[0]
          }
        } catch {
          /* intentionally ignored */
        }
      }

      if (!o) {
        toast({ title: 'Orçamento não encontrado', variant: 'destructive' })
        setLoading(false)
        return
      }

      const realOrcId = o.id
      const [it, an] = await Promise.all([
        getOrcamentoItens(realOrcId).catch(() => []),
        getOrcamentoAnexos(realOrcId).catch(() => []),
      ])

      setOrcamento(o)
      setParcelasInput(String(Math.max(1, o.parcelas || 1)))
      setItems(it)
      setAnexos(an)
      setJustificativaDesconto(o.justificativa_desconto || '')
    } catch (errTotal) {
      console.error('Erro total ao carregar orçamento:', errTotal)
      toast({ title: 'Erro ao carregar orçamento', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  useEffect(() => {
    loadAll()
    getUsers()
      .then((u) => setSystemUsers(u))
      .catch(() => {})
  }, [loadAll])

  // Busca de clientes para autocomplete
  useEffect(() => {
    if (!customerSearchQuery.trim() || customerSearchQuery.trim().length < 2) {
      setCustomerSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearchingCustomers(true)
      try {
        const res = await getCustomers(customerSearchQuery.trim())
        setCustomerSearchResults(res.slice(0, 8))
      } catch {
        setCustomerSearchResults([])
      } finally {
        setSearchingCustomers(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [customerSearchQuery])

  useRealtime('orcamentos', (e) => {
    // Evita sobrescrever estado local se usuário estiver digitando
    if (e.record?.id === id && !autoSaveTimerRef.current) {
      loadAll()
    }
  })
  useRealtime('orcamento_itens', () => loadAll())
  useRealtime('orcamento_anexos', () => loadAll())

  // Salvamento automático com debounce de 600ms
  const triggerAutoSave = (fields: Partial<Orcamento>) => {
    if (!id || isLocked) return
    setOrcamento((prev) => (prev ? { ...prev, ...fields } : prev))
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(async () => {
      autoSaveTimerRef.current = null
      try {
        await updateOrcamento(id, fields)
        await recalculateOrcamentoTotals(id)
      } catch {
        /* best-effort */
      }
    }, 600)
  }

  // Cálculos financeiros em tempo real com separação de Produtos e Serviços
  const financialSummary = useMemo(() => {
    const subtotalProdutos = items
      .filter((it) => it.tipo !== 'servico')
      .reduce((sum, it) => sum + (Number(it.valor_unitario) || 0) * (Number(it.quantidade) || 0), 0)
    const subtotalServicos = items
      .filter((it) => it.tipo === 'servico')
      .reduce((sum, it) => sum + (Number(it.valor_unitario) || 0) * (Number(it.quantidade) || 0), 0)
    const subtotal = subtotalProdutos + subtotalServicos

    const totalItensComDesconto = items.reduce(
      (sum, it) => sum + (Number(it.valor_total_item) || 0),
      0,
    )
    const somaDescontosItens = Math.max(0, subtotal - totalItensComDesconto)

    let descTotal = Number(orcamento?.desconto_total_valor) || 0
    if (orcamento?.desconto_total_tipo === 'percentual') {
      const pct = Number(orcamento.desconto_total_percentual) || 0
      descTotal = (totalItensComDesconto * pct) / 100
    }

    const totalGeral = Math.max(0, totalItensComDesconto - descTotal)
    const pctDoTotal = subtotal > 0 ? ((somaDescontosItens + descTotal) / subtotal) * 100 : 0
    const numParcelas = Math.max(1, orcamento?.parcelas || 1)
    const valorParcela = totalGeral / numParcelas

    return {
      subtotal,
      subtotalProdutos,
      subtotalServicos,
      somaDescontosItens,
      totalItensComDesconto,
      descTotal,
      totalGeral,
      pctDoTotal,
      valorParcela,
    }
  }, [items, orcamento])

  // Aplicação direta de desconto sem modal de aprovação nem limite de permissão (v0.0.157)
  const handleApplyTotalDiscount = async (val: number, tipo: OrcamentoDescontoTipo) => {
    if (!orcamento || !id || isLocked) return
    const sanitizedVal = Math.max(0, isNaN(val) ? 0 : val)

    let descValor = sanitizedVal
    let descPct = 0
    if (tipo === 'percentual') {
      descPct = sanitizedVal
      descValor = (financialSummary.totalItensComDesconto * sanitizedVal) / 100
    } else {
      descValor = sanitizedVal
      descPct =
        financialSummary.totalItensComDesconto > 0
          ? (sanitizedVal / financialSummary.totalItensComDesconto) * 100
          : 0
    }

    const payload: Partial<Orcamento> = {
      desconto_total_tipo: tipo,
      desconto_total_valor: descValor,
      desconto_total_percentual: descPct,
    }

    setOrcamento((prev) => (prev ? { ...prev, ...payload } : prev))

    try {
      await updateOrcamento(id, payload)
      await recalculateOrcamentoTotals(id)
      await loadAll()
    } catch {
      /* best-effort */
    }
  }

  // Scanner de código de barras
  const handleBarcodeScanned = async (code: string) => {
    if (!id || isLocked) return
    try {
      let found: Product | null = null
      try {
        found = await getProduct(code)
      } catch {
        /* fallback */
      }
      if (!found) {
        const trimmed = code.trim().replace(/"/g, '')
        const list = await pb.collection('products').getFullList<Product>({
          filter: `barcode = "${trimmed}" || codigo_barras = "${trimmed}" || sku = "${trimmed}"`,
        })
        found = list[0] || null
      }
      if (!found) {
        toast({
          title: 'Produto não cadastrado',
          description: 'Código de barras não encontrado no estoque.',
          variant: 'destructive',
        })
        return
      }

      const unitPrice = found.price || 0
      await createOrcamentoItem({
        id_orcamento: id,
        tipo: 'produto',
        id_produto: found.id,
        descricao: found.name,
        quantidade: 1,
        valor_unitario: unitPrice,
        desconto_item: 0,
        desconto_item_tipo: 'valor',
        valor_total_item: unitPrice,
      })
      await recalculateOrcamentoTotals(id)
      toast({
        title: 'Produto adicionado com sucesso!',
        description: `${found.name} (Qtd: 1)`,
      })
      await loadAll()
    } catch {
      toast({ title: 'Erro ao incluir produto escaneado', variant: 'destructive' })
    }
  }

  // Exclusão de item com confirmação
  const handleDeleteItem = async (itemId: string, desc: string) => {
    if (!confirm(`Deseja remover o item "${desc}" do orçamento?`)) return
    try {
      await deleteOrcamentoItem(itemId)
      if (id) await recalculateOrcamentoTotals(id)
      toast({ title: 'Item removido do orçamento' })
      loadAll()
    } catch {
      toast({ title: 'Erro ao remover item', variant: 'destructive' })
    }
  }

  // Adição direta de linha de serviço cadastrado
  const handleSelectServicoCadastrado = async (servico: SelectedServicoCadastrado) => {
    if (!id || isLocked) return
    try {
      const unitPrice = servico.valorUnitario || 0
      await createOrcamentoItem({
        id_orcamento: id,
        tipo: 'servico',
        id_produto: servico.id,
        descricao: servico.descricao,
        quantidade: 1,
        valor_unitario: unitPrice,
        desconto_item: 0,
        desconto_item_tipo: 'valor',
        valor_total_item: unitPrice,
      })
      await recalculateOrcamentoTotals(id)
      toast({
        title: 'Serviço adicionado!',
        description: `${servico.descricao} (R$ ${unitPrice.toFixed(2)})`,
      })
      await loadAll()
    } catch {
      toast({ title: 'Erro ao incluir serviço selecionado', variant: 'destructive' })
    }
  }

  // Helpers para resolver cliente e responsável independente vs vinculado
  const activeCustomer = useMemo(() => {
    if (!orcamento) return null
    if (orcamento.id_os) {
      return orcamento.expand?.id_os?.expand?.customer || null
    }
    if (orcamento.cliente_id && orcamento.expand?.cliente_id) {
      return orcamento.expand.cliente_id
    }
    if (orcamento.nome_cliente_livre) {
      return {
        id: '',
        name: orcamento.nome_cliente_livre,
        phone: orcamento.telefone_cliente_livre || '',
        celular: orcamento.telefone_cliente_livre || '',
      } as Customer
    }
    return null
  }, [orcamento])

  const activeCustomerName = useMemo(() => {
    if (orcamento?.id_os) {
      return getCustomerDisplayName(orcamento.expand?.id_os?.expand?.customer)
    }
    if (orcamento?.expand?.cliente_id) {
      return getCustomerDisplayName(orcamento.expand.cliente_id)
    }
    if (orcamento?.nome_cliente_livre) {
      return orcamento.nome_cliente_livre
    }
    return 'Cliente não informado'
  }, [orcamento])

  const activeCustomerPhone = useMemo(() => {
    if (orcamento?.id_os) {
      return getCustomerPhone(orcamento.expand?.id_os?.expand?.customer)
    }
    if (orcamento?.expand?.cliente_id) {
      return getCustomerPhone(orcamento.expand.cliente_id)
    }
    return orcamento?.telefone_cliente_livre || ''
  }, [orcamento])

  const activeResponsibleName = useMemo(() => {
    if (orcamento?.id_os) {
      return orcamento.expand?.id_os?.expand?.technician?.name || 'Não atribuído'
    }
    return (
      orcamento?.expand?.responsavel_id?.name ||
      orcamento?.expand?.id_usuario_criador?.name ||
      'Não atribuído'
    )
  }, [orcamento])

  const activeEquipmentName = useMemo(() => {
    if (orcamento?.id_os) {
      return (
        orcamento.expand?.id_os?.expand?.equipment_ref?.name ||
        orcamento.expand?.id_os?.equipment ||
        'Não especificado'
      )
    }
    return orcamento?.equipamento_independente || 'Não especificado'
  }, [orcamento])

  // 1. WhatsApp: wa.me NÃO anexa arquivos. Solução: link do PDF do orçamento + Compartilhamento Nativo
  const handleWhatsApp = async () => {
    if (!orcamento) return
    const phone = activeCustomerPhone
    if (!phone) {
      toast({ title: 'Cliente sem telefone cadastrado', variant: 'destructive' })
      return
    }

    const custName = activeCustomerName
    const token = orcamento.token_acesso || ''
    const propostaUrl = token
      ? `${window.location.origin}/proposta/${token}`
      : `${window.location.origin}/orcamentos/${orcamento.id}/imprimir`

    const equipmentName = activeEquipmentName
    const osNum = orcamento.expand?.id_os?.number
    const defaultMsg = buildOrcamentoPropostaMessage({
      customerName: custName,
      numeroOrcamento: orcamento.numero_orcamento,
      osNumber: osNum,
      propostaUrl,
      equipment: equipmentName,
      subtotalProdutos: financialSummary.subtotalProdutos,
      subtotalServicos: financialSummary.subtotalServicos,
      totalGeral: financialSummary.totalGeral,
    })

    // Registra no histórico do cliente / pos_venda_messages se houver cliente cadastrado
    try {
      const custId = orcamento.cliente_id || orcamento.expand?.id_os?.customer
      if (custId) {
        await pb.collection('pos_venda_messages').create({
          customer: custId,
          service_order: orcamento.id_os || null,
          tipo: 'resumo_finalizacao',
          status: 'sent',
          scheduled_at: new Date().toISOString(),
          sent_at: new Date().toISOString(),
          texto_gerado: defaultMsg,
          wa_me_link: buildWhatsAppUrl(phone, defaultMsg),
          channel: 'whatsapp',
        })
      }
    } catch {
      /* intentionally ignored */
    }

    // Transição de status do orçamento: rascunho -> enviado
    if (orcamento.status === 'rascunho') {
      try {
        await updateOrcamento(orcamento.id, { status: 'enviado' })
        if (orcamento.id_os) {
          await updateOsStatus(
            orcamento.id_os,
            'orcamento_enviado',
            `Orçamento ${orcamento.numero_orcamento} enviado ao cliente via WhatsApp`,
            user?.id,
          )
        }
      } catch {
        /* intentionally ignored */
      }
    }

    openWhatsApp(phone, defaultMsg)
    loadAll()
  }

  // Enviar link da proposta online ao cliente (copia URL e abre WhatsApp)
  const handleEnviarLinkCliente = async () => {
    if (!orcamento) return
    const phone = activeCustomerPhone
    if (!phone) {
      toast({
        title: 'Cliente sem WhatsApp informado',
        description: 'Informe o celular do cliente antes de enviar o link.',
        variant: 'destructive',
      })
      return
    }

    let token = orcamento.token_acesso
    if (!token) {
      try {
        const generated = await generateRandomToken(32)
        const updated = await updateOrcamento(orcamento.id, { token_acesso: generated })
        token = updated.token_acesso || generated
      } catch {
        /* fallback */
      }
    }

    const propostaUrl = `${window.location.origin}/proposta/${token || orcamento.id}`

    // Copia URL para a área de transferência
    try {
      await navigator.clipboard.writeText(propostaUrl)
      toast({
        title: 'Link da proposta copiado!',
        description: 'URL pública copiada para a área de transferência e abrindo WhatsApp...',
      })
    } catch {
      /* ignore clipboard rejection */
    }

    const custName = activeCustomerName
    const equipmentName = activeEquipmentName
    const osNum = orcamento.expand?.id_os?.number
    const msg = buildOrcamentoPropostaMessage({
      customerName: custName,
      numeroOrcamento: orcamento.numero_orcamento,
      osNumber: osNum,
      propostaUrl,
      equipment: equipmentName,
      subtotalProdutos: financialSummary.subtotalProdutos,
      subtotalServicos: financialSummary.subtotalServicos,
      totalGeral: financialSummary.totalGeral,
    })

    // Registra no histórico do cliente / pos_venda_messages
    try {
      const custId = orcamento.cliente_id || orcamento.expand?.id_os?.customer
      if (custId) {
        await pb.collection('pos_venda_messages').create({
          customer: custId,
          service_order: orcamento.id_os || null,
          tipo: 'resumo_finalizacao',
          status: 'sent',
          scheduled_at: new Date().toISOString(),
          sent_at: new Date().toISOString(),
          texto_gerado: msg,
          wa_me_link: buildWhatsAppUrl(phone, msg),
          channel: 'whatsapp',
        })
      }
    } catch {
      /* intentionally ignored */
    }

    // Transição de status do orçamento: rascunho -> enviado
    if (orcamento.status === 'rascunho') {
      try {
        await updateOrcamento(orcamento.id, { status: 'enviado' })
        if (orcamento.id_os) {
          await updateOsStatus(
            orcamento.id_os,
            'orcamento_enviado',
            `Link da proposta online ${orcamento.numero_orcamento} enviado ao cliente via WhatsApp`,
            user?.id,
          )
        }
      } catch {
        /* intentionally ignored */
      }
    }

    openWhatsApp(phone, msg)
    loadAll()
  }

  // Compartilhamento nativo (navigator.share) para envio direto do link/arquivo
  const handleNativeShare = async () => {
    if (!orcamento) return
    const custName = activeCustomerName
    const pdfUrl = `${window.location.origin}/orcamentos/${orcamento.id}/imprimir`

    const shareData = {
      title: `Orçamento ${orcamento.numero_orcamento} - Juca Informática`,
      text: `Olá ${custName}, segue o orçamento do seu atendimento na Juca Cartuchos e Informática.`,
      url: pdfUrl,
    }

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData)
        toast({ title: 'Orçamento compartilhado com sucesso!' })
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          navigator.clipboard.writeText(pdfUrl)
          toast({ title: 'Link do orçamento copiado para a área de transferência!' })
        }
      }
    } else {
      navigator.clipboard.writeText(pdfUrl)
      toast({ title: 'Link do orçamento copiado para a área de transferência!' })
    }
  }

  // Aprovação do cliente: SOMENTE com assinatura confirmada
  const handleAprovar = async () => {
    if (!orcamento) return
    if (!orcamento.assinatura_cliente) {
      toast({
        title: 'Assinatura obrigatória para aprovação',
        description: 'Colete a assinatura do cliente antes de registrar a aprovação do orçamento.',
        variant: 'destructive',
      })
      setSignerRole('customer')
      setSignatureModalOpen(true)
      return
    }

    try {
      await updateOrcamento(orcamento.id, {
        status: 'aprovado',
        data_assinatura_cliente: orcamento.data_assinatura_cliente || new Date().toISOString(),
      })
      // Status da OS controlado (se vinculado): aprovado+assinado -> 'orcamento_aprovado'
      if (orcamento.id_os) {
        await updateOsStatus(
          orcamento.id_os,
          'orcamento_aprovado',
          `Orçamento ${orcamento.numero_orcamento} aprovado e assinado pelo cliente.`,
          user?.id,
        )
      }
      toast({
        title: 'Orçamento aprovado!',
        description: 'Orçamento assinado e aprovado pelo cliente com sucesso.',
      })
      loadAll()
    } catch {
      toast({ title: 'Erro ao aprovar orçamento', variant: 'destructive' })
    }
  }

  // Rejeição com motivo OBRIGATÓRIO
  const handleRejeitar = async () => {
    if (!orcamento) return
    if (!motivoRejeicao.trim()) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Informe a justificativa de recusa do orçamento pelo cliente.',
        variant: 'destructive',
      })
      return
    }

    try {
      await updateOrcamento(orcamento.id, {
        status: 'rejeitado',
        motivo_rejeicao: motivoRejeicao.trim(),
      })
      if (orcamento.id_os) {
        await updateOsStatus(
          orcamento.id_os,
          'orcamento_rejeitado',
          `Orçamento ${orcamento.numero_orcamento} rejeitado. Motivo: ${motivoRejeicao.trim()}`,
          user?.id,
        )
      }
      toast({ title: 'Orçamento marcado como rejeitado.' })
      setRejeicaoModalOpen(false)
      loadAll()
    } catch {
      toast({ title: 'Erro ao rejeitar orçamento', variant: 'destructive' })
    }
  }

  // URL fixa do grupo do WhatsApp de Faturamento da JUCA Informática
  const WHATSAPP_FATURAMENTO_GROUP_URL = 'https://chat.whatsapp.com/GfUlsLlK9SBLa7BUfxS4J3'

  // Helper síncrono para cópia imediata no gesto do clique (essencial para iOS/Safari)
  const copyToClipboardSync = (text: string): boolean => {
    let textArea: HTMLTextAreaElement | null = null
    try {
      textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-9999px'
      textArea.style.top = '0'
      textArea.style.opacity = '0'
      textArea.setAttribute('readonly', '')
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      const successful = document.execCommand('copy')
      if (successful) return true
    } catch {
      /* ignore */
    } finally {
      if (textArea && textArea.parentNode) {
        try {
          textArea.parentNode.removeChild(textArea)
        } catch {
          // nó já removido
        }
      }
    }

    // Tenta também navigator.clipboard.writeText síncronamente disparado no clique
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => {})
        return true
      }
    } catch {
      /* ignore */
    }

    return false
  }

  // Helper com fallback robusto de cópia para a área de transferência (mesmo em navegadores restritivos/iOS)
  const copyToClipboardWithFallback = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text)
        return true
      }
    } catch {
      /* fallback to execCommand */
    }

    return copyToClipboardSync(text)
  }

  // Montador da mensagem formatada para o grupo de faturamento do WhatsApp (v0.0.150: inclui link do documento online da proposta)
  const buildFaturamentoTextMessage = (params: {
    isReenvio: boolean
    osNumberDisplay: string
    orcNumber: string
    clientName: string
    equipmentName: string
    responsibleName: string
    itensList: OrcamentoItem[]
    totalGeral: number
    formaPagamento?: string
    parcelas?: number
    isLinkedToOs: boolean
    documentoUrl?: string
  }): string => {
    const {
      isReenvio,
      osNumberDisplay,
      orcNumber,
      clientName,
      equipmentName,
      responsibleName,
      itensList,
      totalGeral,
      formaPagamento,
      parcelas,
      isLinkedToOs,
      documentoUrl,
    } = params

    const prodsList = itensList.filter((it) => it.tipo !== 'servico')
    const servsList = itensList.filter((it) => it.tipo === 'servico')

    const subProds = prodsList.reduce(
      (s, it) => s + (Number(it.valor_unitario) || 0) * (Number(it.quantidade) || 0),
      0,
    )
    const subServs = servsList.reduce(
      (s, it) => s + (Number(it.valor_unitario) || 0) * (Number(it.quantidade) || 0),
      0,
    )

    const fmt = (v: number) =>
      v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    const formatList = (list: OrcamentoItem[]) =>
      list.length > 0
        ? list
            .map((it) => {
              const qtd = it.quantidade || 1
              const rawTotal =
                typeof it.valor_total_item === 'number'
                  ? it.valor_total_item
                  : (it.valor_unitario || 0) * qtd
              return `  • ${qtd}x ${it.descricao}: R$ ${fmt(rawTotal)}`
            })
            .join('\n')
        : '  • Nenhum'

    const totalFmt = totalGeral.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

    const formaPag = (formaPagamento || 'pix').toUpperCase()
    const numParc = parcelas || 1
    const parcelasFmt =
      numParc > 1
        ? `${numParc}x de R$ ${(totalGeral / numParc).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : 'À vista'

    const documentoLinha = documentoUrl
      ? `\n📄 *Documento completo para conferência e impressão:*\n👉 ${documentoUrl}\n`
      : ''

    return (
      `📄 *${isReenvio ? 'REENVIO DE FATURAMENTO' : 'FATURAMENTO CONCLUÍDO'} - JUCA INFORMÁTICA*\n\n` +
      `🔢 *O.S. / Orçamento:* ${osNumberDisplay} / ${orcNumber}\n` +
      `👤 *Cliente:* ${clientName}\n` +
      `💻 *Equipamento:* ${equipmentName}\n` +
      `👨‍💼 *Responsável:* ${responsibleName}\n\n` +
      `📦 *Produtos & Peças (Subtotal: R$ ${fmt(subProds)}):*\n` +
      `${formatList(prodsList)}\n\n` +
      `🛠️ *Serviços & Mão de Obra (Subtotal: R$ ${fmt(subServs)}):*\n` +
      `${formatList(servsList)}\n\n` +
      `💰 *Total Geral:* R$ ${totalFmt}\n` +
      `💳 *Forma de Pagamento:* ${formaPag} (${parcelasFmt})\n\n` +
      (isLinkedToOs ? `✅ *Status O.S.:* Finalizada (Closed)\n` : '') +
      `✅ *Status Orçamento:* Faturado\n` +
      documentoLinha
    ).trimEnd()
  }

  // Faturamento (Permite faturar e reenviar ao grupo sem duplicar registros)
  const handleSendToFaturamento = async () => {
    if (!orcamento) return
    if (orcamento.status !== 'aprovado' && orcamento.status !== 'faturado') {
      toast({
        title: 'Disponível após aprovação do cliente',
        description: 'O orçamento precisa estar com status Aprovado para ser faturado.',
        variant: 'destructive',
      })
      return
    }

    const isReenvio = orcamento.status === 'faturado'
    const osNumberInitial =
      orcamento.expand?.id_os?.number || (orcamento.id_os ? 'O.S. Vinculada' : '— (Independente)')
    const orcNumber = orcamento.numero_orcamento || '—'

    // =========================================================================
    // ETAPA CRÍTICA PARA iOS / SAFARI (v0.0.148 + v0.0.149 + v0.0.150):
    // 1) DISPARO SÍNCRONO DA CÓPIA NO GESTO DO TOQUE (ANTES DE QUALQUER AWAIT).
    // O Safari revoga permissão de clipboard e bloqueia popups após o primeiro await.
    // O link público da proposta/documento é montado síncronamente a partir do token
    // (ou id) já carregados em memória (window.location.origin + /proposta/[token]).
    // Isso garante que a mensagem copiada imediatamente contenha SEMPRE o link do documento
    // tanto para orçamento vinculado à O.S. quanto independente.
    // =========================================================================
    const initialToken = orcamento.token_acesso || orcamento.id
    const immediateDocumentoUrl = `${window.location.origin}/proposta/${initialToken}`

    const immediateMessage = buildFaturamentoTextMessage({
      isReenvio,
      osNumberDisplay: osNumberInitial,
      orcNumber,
      clientName: activeCustomerName,
      equipmentName: activeEquipmentName,
      responsibleName: activeResponsibleName,
      itensList: items,
      totalGeral: financialSummary.totalGeral,
      formaPagamento: orcamento.forma_pagamento,
      parcelas: orcamento.parcelas,
      isLinkedToOs: Boolean(orcamento.id_os),
      documentoUrl: immediateDocumentoUrl,
    })

    // Cópia síncrona imediata no gesto do clique
    let initialCopySuccess = copyToClipboardSync(immediateMessage)
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(immediateMessage).then(
          () => {
            initialCopySuccess = true
          },
          () => {},
        )
      }
    } catch {
      /* ignore */
    }

    // DISPARO SÍNCRONO NO GESTO DO USUÁRIO (Evita bloqueio de popup no Safari / iOS):
    // Abrimos a janela de imediato para preservar a permissão do clique.
    let popupWindow: Window | null = null
    try {
      popupWindow = window.open(WHATSAPP_FATURAMENTO_GROUP_URL, '_blank')
    } catch {
      popupWindow = null
    }

    try {
      // 1. Garante que os dados da O.S. vinculada estejam resolvidos (busca direta se expand não trouxe)
      let resolvedOsNumber = orcamento.expand?.id_os?.number || ''
      let resolvedClientName = activeCustomerName
      let resolvedEquipName = activeEquipmentName
      let resolvedRespName = activeResponsibleName

      if (orcamento.id_os) {
        try {
          // Se orcamento.expand.id_os estiver ausente ou sem number, busca a OS diretamente
          if (!resolvedOsNumber) {
            const fetchedOs = await getServiceOrder(orcamento.id_os)
            if (fetchedOs) {
              resolvedOsNumber = fetchedOs.number || ''
              if (!resolvedClientName || resolvedClientName === 'Cliente não informado') {
                resolvedClientName = getCustomerDisplayName(fetchedOs.expand?.customer)
              }
              if (!resolvedEquipName || resolvedEquipName === 'Não especificado') {
                resolvedEquipName =
                  fetchedOs.expand?.equipment_ref?.name || fetchedOs.equipment || 'Não especificado'
              }
              if (!resolvedRespName || resolvedRespName === 'Não atribuído') {
                resolvedRespName = fetchedOs.expand?.technician?.name || 'Não atribuído'
              }
            }
          }
        } catch (fetchErr) {
          console.warn('Erro ao resolver O.S. vinculada:', fetchErr)
        }
      }

      const osNumberDisplay =
        resolvedOsNumber || (orcamento.id_os ? 'O.S. Vinculada' : '— (Independente)')

      // Garante que o orçamento tenha token_acesso persistido e recarregado no objeto local
      let resolvedToken = orcamento.token_acesso
      if (!resolvedToken) {
        try {
          const generated = await generateRandomToken(32)
          const updated = await updateOrcamento(orcamento.id, { token_acesso: generated })
          resolvedToken = updated.token_acesso || generated
          setOrcamento((prev) => (prev ? { ...prev, token_acesso: resolvedToken } : prev))
        } catch {
          resolvedToken = orcamento.id
        }
      }
      const finalDocumentoUrl = `${window.location.origin}/proposta/${resolvedToken || orcamento.id}`

      // 2. Executa faturamento no backend (idempotente: se já faturado, não duplica pagamento nem baixa de estoque e fecha OS)
      await sendOrcamentoToFaturamento(orcamento.id, user?.id)

      // 3. Reconstrói a mensagem caso algum dado da OS tenha sido resolvido durante o fetch
      const finalMessage = buildFaturamentoTextMessage({
        isReenvio,
        osNumberDisplay,
        orcNumber,
        clientName: resolvedClientName,
        equipmentName: resolvedEquipName,
        responsibleName: resolvedRespName,
        itensList: items,
        totalGeral: financialSummary.totalGeral,
        formaPagamento: orcamento.forma_pagamento,
        parcelas: orcamento.parcelas,
        isLinkedToOs: Boolean(orcamento.id_os),
        documentoUrl: finalDocumentoUrl,
      })

      // 4. Revalidação pós-awaits: garante cópia com link definitivo
      let finalCopySuccess = initialCopySuccess
      if (finalMessage !== immediateMessage || !initialCopySuccess) {
        const recheckOk = await copyToClipboardWithFallback(finalMessage)
        finalCopySuccess = recheckOk || initialCopySuccess
      }

      // Se a popup foi aberta com sucesso e estava em about:blank, redireciona
      if (popupWindow && !popupWindow.closed) {
        try {
          popupWindow.location.href = WHATSAPP_FATURAMENTO_GROUP_URL
        } catch {
          /* ignore cross-origin */
        }
      }

      setFaturamentoConfirmOpen(false)

      // 5. Exibe modal informativo pós-faturamento com passo a passo 1-2-3, status da cópia e botões de ação
      setFaturamentoSuccessData({
        mensagem: finalMessage,
        isReenvio,
        osNumber: osNumberDisplay,
        orcNumber,
        copiedSuccessfully: finalCopySuccess,
        documentoUrl: finalDocumentoUrl,
      })
      setFaturamentoSuccessModalOpen(true)

      toast({
        title: isReenvio
          ? finalCopySuccess
            ? 'Mensagem copiada e grupo pronto!'
            : 'Faturamento reenviado!'
          : finalCopySuccess
            ? 'Resumo copiado e grupo pronto!'
            : 'Orçamento faturado!',
        description: finalCopySuccess
          ? 'Texto do faturamento copiado para a área de transferência. Toque no botão para abrir o grupo se o WhatsApp não abriu automaticamente.'
          : 'Toque em "Copiar Novamente" no modal e abra o grupo para colar o resumo.',
      })

      loadAll()
    } catch (e: any) {
      if (popupWindow && !popupWindow.closed) {
        try {
          popupWindow.close()
        } catch {
          /* ignore */
        }
      }
      toast({
        title: 'Erro ao enviar para faturamento',
        description: e.message || 'Tente novamente.',
        variant: 'destructive',
      })
    }
  }
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-xs text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando orçamento...
      </div>
    )
  }

  if (!orcamento) {
    return <div className="p-8 text-center text-xs text-slate-500">Orçamento não encontrado.</div>
  }

  const os = orcamento.expand?.id_os
  const cust = os?.expand?.customer
  const statusCfg = STATUS_CONFIG[orcamento.status] || STATUS_CONFIG.rascunho

  return (
    <div className="space-y-6 pb-12">
      {/* Top Bar e Navegação */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              orcamento.id_os ? navigate(`/ordens/${orcamento.id_os}`) : navigate('/orcamentos')
            }
            className="h-9 w-9 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 font-mono">
                {orcamento.numero_orcamento}
              </h1>
              <Badge
                className={`${statusCfg.bg} ${statusCfg.color} ${statusCfg.border} border text-xs font-semibold`}
              >
                {statusCfg.label}
              </Badge>
              {!orcamento.id_os && (
                <Badge
                  variant="outline"
                  className="text-[10px] bg-slate-50 text-slate-600 border-slate-300"
                >
                  Orçamento Independente
                </Badge>
              )}
              {orcamento.status === 'substituido' && (
                <span className="text-[11px] text-slate-400 italic">
                  (Histórico - substituído por novo orçamento)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 truncate">
              {orcamento.id_os
                ? `Vinculado à O.S. #${os?.number || '—'} • Cliente: ${activeCustomerName}`
                : `Cliente: ${activeCustomerName} • Resp: ${activeResponsibleName}`}
            </p>
          </div>
        </div>

        {/* Resumo compacto de Alertas / Ações de Status */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
          <span className="font-semibold text-slate-700">Fluxo do Orçamento:</span>
          {orcamento.status === 'rascunho' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                updateOrcamento(orcamento.id, { status: 'aguardando_aprovacao' })
                loadAll()
              }}
              className="h-8 text-xs border-amber-300 bg-amber-50 text-amber-800"
            >
              Marcar como "Aguardando Aprovação"
            </Button>
          )}

          {/* Botão Enviar link ao cliente (copia URL e abre WhatsApp) */}
          <Button
            size="sm"
            onClick={handleEnviarLinkCliente}
            className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-xs font-semibold"
            title="Copiar URL pública da proposta e abrir WhatsApp do cliente"
          >
            <LinkIcon className="h-3.5 w-3.5" /> Enviar link ao cliente
          </Button>

          {/* Se aprovado ou faturado, oferece botão de enviar ou reenviar mensagem de agradecimento */}
          {(orcamento.status === 'aprovado' || orcamento.status === 'faturado') && (
            <Button
              size="sm"
              onClick={async () => {
                const cust = orcamento.expand?.id_os?.expand?.customer
                const phone = getCustomerPhone(cust)
                if (!phone) {
                  toast({
                    title: 'Cliente sem telefone cadastrado',
                    description: 'Cadastre o celular do cliente para enviar a mensagem.',
                    variant: 'destructive',
                  })
                  return
                }
                const custName = getCustomerDisplayName(cust)
                const equip =
                  orcamento.expand?.id_os?.expand?.equipment_ref?.name ||
                  orcamento.expand?.id_os?.equipment ||
                  ''
                const msg = buildOrcamentoAprovadoAgradecimentoMessage({
                  customerName: custName,
                  numeroOrcamento: orcamento.numero_orcamento,
                  equipment: equip,
                })
                openWhatsApp(phone, msg)
                try {
                  if (cust?.id) {
                    await pb.collection('pos_venda_messages').create({
                      customer: cust.id,
                      service_order: orcamento.id_os,
                      tipo: 'resumo_finalizacao',
                      status: 'sent',
                      scheduled_at: new Date().toISOString(),
                      sent_at: new Date().toISOString(),
                      texto_gerado: msg,
                      wa_me_link: buildWhatsAppUrl(phone, msg),
                      channel: 'whatsapp',
                    })
                  }
                } catch {
                  /* ignore */
                }
                toast({
                  title: 'WhatsApp aberto!',
                  description: 'Mensagem de agradecimento pronta enviada para o cliente.',
                })
              }}
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-bold shadow-xs"
              title="Enviar mensagem de agradecimento ao cliente pelo WhatsApp"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Enviar Agradecimento WhatsApp
            </Button>
          )}

          {orcamento.status !== 'aprovado' && orcamento.status !== 'faturado' && (
            <Button
              size="sm"
              onClick={() => {
                if (!orcamento.assinatura_cliente) {
                  setSignerRole('customer')
                  setSignatureModalOpen(true)
                } else {
                  handleAprovar()
                }
              }}
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
            >
              <CheckCircle className="h-3.5 w-3.5" /> Aprovar Orçamento (com Assinatura)
            </Button>
          )}

          {orcamento.status !== 'rejeitado' && orcamento.status !== 'faturado' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRejeicaoModalOpen(true)}
              className="h-8 text-xs border-rose-300 text-rose-700 hover:bg-rose-50 gap-1"
            >
              <XCircle className="h-3.5 w-3.5" /> Rejeitar Orçamento
            </Button>
          )}

          {orcamento.motivo_rejeicao && (
            <div className="w-full mt-1 p-2 bg-rose-50 border border-rose-200 rounded text-rose-800 text-[11px]">
              <strong>Motivo da rejeição:</strong> {orcamento.motivo_rejeicao}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Card dos Dados Principais e Resumo da OS / Orçamento Independente */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-900">
                {orcamento.id_os
                  ? 'Informações do Atendimento (O.S.)'
                  : 'Dados do Orçamento Independente'}
              </CardTitle>
              {!orcamento.id_os && (
                <span className="text-[11px] text-slate-500 font-medium">
                  Sem vínculo com Ordem de Serviço
                </span>
              )}
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              {orcamento.id_os ? (
                // Orçamento VINCULADO: dados herdados da O.S. (preservados exatamente como antes)
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="font-semibold text-slate-500">Cliente (da O.S.):</span>
                      <p className="font-medium text-slate-900">{getCustomerDisplayName(cust)}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-500">Equipamento:</span>
                      <p className="font-medium text-slate-900">
                        {os?.expand?.equipment_ref?.name || os?.equipment || 'Não especificado'}
                      </p>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-500">Técnico Responsável:</span>
                      <p className="font-medium text-slate-900">
                        {os?.expand?.technician?.name || 'Não atribuído'}
                      </p>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-500">
                        Validade do Orçamento (dias):
                      </span>
                      <Input
                        type="number"
                        min="1"
                        disabled={!canEdit}
                        value={orcamento.validade || 15}
                        onChange={(e) =>
                          triggerAutoSave({ validade: parseInt(e.target.value, 10) || 15 })
                        }
                        className="h-8 w-24 text-xs font-mono mt-0.5"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="font-semibold text-slate-500">Defeito Relatado na OS:</span>
                    <p className="text-slate-700 mt-0.5 bg-slate-50 p-2 rounded border border-slate-100">
                      {os?.description || 'Nenhuma descrição fornecida.'}
                    </p>
                  </div>
                </>
              ) : (
                // Orçamento INDEPENDENTE (v0.0.146)
                // 1) Cliente: autocomplete ou texto livre
                // 2) Responsável: técnico ou vendedor
                // 3) Defeito e Equipamento: campos opcionais
                <div className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* 1) Campo de busca / cliente */}
                    <div className="space-y-1 relative">
                      <label className="font-semibold text-slate-700 block">
                        Cliente (Buscar cadastrado ou digitar livremente)
                      </label>
                      {orcamento.cliente_id && orcamento.expand?.cliente_id ? (
                        <div className="flex items-center justify-between p-2 rounded border border-emerald-300 bg-emerald-50/50">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate">
                              {getCustomerDisplayName(orcamento.expand.cliente_id)}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">
                              Tel:{' '}
                              {getCustomerPhone(orcamento.expand.cliente_id) || 'Não informado'} •
                              CPF/CNPJ: {orcamento.expand.cliente_id.cpf_cnpj || '—'}
                            </p>
                          </div>
                          {canEdit && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                triggerAutoSave({
                                  cliente_id: null as any,
                                  nome_cliente_livre: '',
                                  telefone_cliente_livre: '',
                                })
                              }}
                              className="h-7 text-xs text-rose-600 hover:bg-rose-50"
                            >
                              Trocar
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="relative">
                            <Input
                              type="text"
                              disabled={!canEdit}
                              placeholder="Digite o nome do cliente..."
                              value={customerSearchQuery || orcamento.nome_cliente_livre || ''}
                              onChange={(e) => {
                                const val = e.target.value
                                setCustomerSearchQuery(val)
                                setCustomerSearchDropdownOpen(true)
                                triggerAutoSave({
                                  cliente_id: null as any,
                                  nome_cliente_livre: val,
                                })
                              }}
                              onFocus={() => {
                                if (customerSearchResults.length > 0) {
                                  setCustomerSearchDropdownOpen(true)
                                }
                              }}
                              className="h-9 text-xs"
                            />
                            {searchingCustomers && (
                              <Loader2 className="h-4 w-4 animate-spin absolute right-2.5 top-2.5 text-slate-400" />
                            )}
                          </div>

                          {/* Dropdown de autocomplete com clientes encontrados */}
                          {customerSearchDropdownOpen && customerSearchResults.length > 0 && (
                            <div className="absolute z-20 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-md shadow-lg divide-y divide-slate-100 text-xs">
                              <div className="p-1.5 bg-slate-50 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                                Clientes Cadastrados Encontrados:
                              </div>
                              {customerSearchResults.map((cust) => (
                                <button
                                  key={cust.id}
                                  type="button"
                                  onClick={() => {
                                    triggerAutoSave({
                                      cliente_id: cust.id,
                                      nome_cliente_livre: getCustomerDisplayName(cust),
                                      telefone_cliente_livre: getCustomerPhone(cust) || '',
                                    })
                                    setCustomerSearchQuery('')
                                    setCustomerSearchDropdownOpen(false)
                                    loadAll()
                                  }}
                                  className="w-full text-left p-2 hover:bg-indigo-50 transition-colors flex items-center justify-between"
                                >
                                  <div>
                                    <div className="font-semibold text-slate-900">
                                      {getCustomerDisplayName(cust)}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      {getCustomerPhone(cust) || 'Sem telefone'} •{' '}
                                      {cust.cpf_cnpj || 'Sem CPF/CNPJ'}
                                    </div>
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] border-indigo-200 text-indigo-700"
                                  >
                                    Vincular
                                  </Badge>
                                </button>
                              ))}
                              <div className="p-2 bg-slate-50 text-[11px] text-slate-600 flex items-center justify-between">
                                <span>
                                  Não é nenhum destes? O nome digitado será salvo sem cadastro.
                                </span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 text-[10px]"
                                  onClick={() => setCustomerSearchDropdownOpen(false)}
                                >
                                  Fechar
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Telefone do cliente livre */}
                          <div className="pt-1">
                            <label className="font-semibold text-slate-500 block text-[11px] mb-0.5">
                              Telefone / WhatsApp do Cliente (opcional):
                            </label>
                            <Input
                              type="text"
                              disabled={!canEdit}
                              placeholder="(00) 00000-0000"
                              value={orcamento.telefone_cliente_livre || ''}
                              onChange={(e) =>
                                triggerAutoSave({ telefone_cliente_livre: e.target.value })
                              }
                              className="h-8 text-xs font-mono"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 2) Técnico OU Vendedor responsável */}
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700 block">
                        Técnico / Vendedor Responsável
                      </label>
                      <select
                        disabled={!canEdit}
                        value={orcamento.responsavel_id || orcamento.id_usuario_criador || ''}
                        onChange={(e) =>
                          triggerAutoSave({ responsavel_id: e.target.value || (null as any) })
                        }
                        className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs text-slate-900 shadow-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Selecione um responsável...</option>
                        {systemUsers.map((u) => {
                          const roleLabel =
                            u.role === 'technician'
                              ? 'Técnico'
                              : u.role === 'admin'
                                ? 'Administrador'
                                : 'Vendedor/Atendente'
                          return (
                            <option key={u.id} value={u.id}>
                              {u.name} ({roleLabel})
                            </option>
                          )
                        })}
                      </select>
                      <p className="text-[11px] text-slate-400">
                        Selecione o profissional que conduziu a negociação ou orçamento.
                      </p>

                      <div className="pt-2">
                        <label className="font-semibold text-slate-500 block text-[11px] mb-0.5">
                          Validade do Orçamento (dias):
                        </label>
                        <Input
                          type="number"
                          min="1"
                          disabled={!canEdit}
                          value={orcamento.validade || 15}
                          onChange={(e) =>
                            triggerAutoSave({ validade: parseInt(e.target.value, 10) || 15 })
                          }
                          className="h-8 w-24 text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3) Campos opcionais: Equipamento e Defeito Relacionado */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-slate-700">
                        Equipamento e Defeito (Campos Opcionais)
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        Opcional em orçamento independente
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-slate-500 block text-[11px] font-medium mb-1">
                          Equipamento (Opcional):
                        </label>
                        <Input
                          type="text"
                          disabled={!canEdit}
                          placeholder="Ex: Notebook Dell Inspiron, Impressora Epson..."
                          value={orcamento.equipamento_independente || ''}
                          onChange={(e) =>
                            triggerAutoSave({ equipamento_independente: e.target.value })
                          }
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-slate-500 block text-[11px] font-medium mb-1">
                          Defeito / Observação do Atendimento (Opcional):
                        </label>
                        <Input
                          type="text"
                          disabled={!canEdit}
                          placeholder="Ex: Não liga, tela trincada, orçamento balcão..."
                          value={orcamento.defeito_independente || ''}
                          onChange={(e) =>
                            triggerAutoSave({ defeito_independente: e.target.value })
                          }
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* SEÇÃO 1: PRODUTOS & PEÇAS */}
          <Card className="border-slate-200 shadow-xs overflow-hidden">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 bg-gradient-to-r from-indigo-50/70 via-white to-white border-b border-indigo-100/60">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Package className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-bold text-slate-900">
                      Produtos & Peças
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200"
                    >
                      {items.filter((it) => it.tipo !== 'servico').length}{' '}
                      {items.filter((it) => it.tipo !== 'servico').length === 1 ? 'item' : 'itens'}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Peças físicas, componentes e suprimentos (com baixa automática de estoque no
                    faturamento)
                  </p>
                </div>
              </div>

              {canEdit && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setScannerOpen(true)}
                    className="h-8 text-xs gap-1.5 border-slate-200"
                    title="Ler código de barras ou bipar leitor físico"
                  >
                    <ScanLine className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Código de Barras</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingItem(null)
                      setModalDefaultKind('produto')
                      setModalLockKind(true)
                      setItemModalOpen(true)
                    }}
                    className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-xs font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar Produto
                  </Button>
                </div>
              )}
            </CardHeader>

            <CardContent className="p-0">
              {/* Tabela de Produtos */}
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Descrição do Produto / Peça</th>
                      <th className="py-2.5 px-3 text-center">Qtd</th>
                      <th className="py-2.5 px-3 text-right">Vlr. Unit.</th>
                      <th className="py-2.5 px-3 text-right">Desconto</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                      {canEdit && <th className="py-2.5 px-3 text-right">Ações</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items
                      .filter((it) => it.tipo !== 'servico')
                      .map((it) => {
                        let itemDescVal = 0
                        if (it.desconto_item && it.desconto_item > 0) {
                          const raw = (it.valor_unitario || 0) * (it.quantidade || 0)
                          itemDescVal =
                            it.desconto_item_tipo === 'percentual'
                              ? (raw * it.desconto_item) / 100
                              : it.desconto_item
                        }
                        return (
                          <tr key={it.id} className="hover:bg-indigo-50/30 transition-colors">
                            <td className="py-2.5 px-3">
                              <div className="font-medium text-slate-900">{it.descricao}</div>
                              {it.id_produto && (
                                <span className="text-[10px] text-slate-400">Do catálogo</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-medium">
                              {it.quantidade}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                              R${' '}
                              {(it.valor_unitario || 0).toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-rose-600">
                              {itemDescVal > 0
                                ? `- R$ ${itemDescVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                              R${' '}
                              {(it.valor_total_item || 0).toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            {canEdit && (
                              <td className="py-2.5 px-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setEditingItem(it)
                                      setModalDefaultKind('produto')
                                      setModalLockKind(false)
                                      setItemModalOpen(true)
                                    }}
                                    className="h-7 w-7 text-slate-500 hover:text-indigo-600"
                                    title="Editar produto"
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteItem(it.id, it.descricao)}
                                    className="h-7 w-7 text-red-500 hover:bg-red-50"
                                    title="Excluir produto"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    {items.filter((it) => it.tipo !== 'servico').length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-7 text-center text-slate-400 text-xs">
                          Nenhum produto ou peça adicionado. Clique em "+ Adicionar Produto" ou use
                          o código de barras.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Rodapé do Subtotal de Produtos */}
              <div className="px-4 py-2.5 bg-indigo-50/50 border-t border-indigo-100 flex items-center justify-between text-xs">
                <span className="font-semibold text-indigo-950 flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Subtotal Produtos:</span>
                </span>
                <span className="font-mono tabular-nums font-bold text-sm text-indigo-900">
                  R${' '}
                  {financialSummary.subtotalProdutos.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* SEÇÃO 2: SERVIÇOS & MÃO DE OBRA */}
          <Card className="border-slate-200 shadow-xs overflow-hidden">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 bg-gradient-to-r from-emerald-50/70 via-white to-white border-b border-emerald-100/60">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Wrench className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-bold text-slate-900">
                      Serviços & Mão de Obra
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
                    >
                      {items.filter((it) => it.tipo === 'servico').length}{' '}
                      {items.filter((it) => it.tipo === 'servico').length === 1
                        ? 'serviço'
                        : 'serviços'}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Mão de obra e serviços prestados (sem movimentação de estoque físico)
                  </p>
                </div>
              </div>

              {canEdit && (
                <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setServicoSelectModalOpen(true)}
                    className="h-8 text-xs gap-1.5 border-emerald-300 bg-emerald-50/60 text-emerald-800 hover:bg-emerald-100/70"
                    title="Buscar serviço cadastrado no catálogo JUCA"
                  >
                    <Search className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Selecionar serviço cadastrado</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingItem(null)
                      setModalDefaultKind('servico')
                      setModalLockKind(true)
                      setItemModalOpen(true)
                    }}
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs font-semibold"
                    title="Adicionar serviço digitando descrição, quantidade e valor livremente"
                  >
                    <Plus className="h-3.5 w-3.5" /> + Adicionar serviço
                  </Button>
                </div>
              )}
            </CardHeader>

            <CardContent className="p-0">
              {/* Tabela de Serviços */}
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Descrição do Serviço / Mão de Obra</th>
                      <th className="py-2.5 px-3 text-center">Qtd</th>
                      <th className="py-2.5 px-3 text-right">Vlr. Unit.</th>
                      <th className="py-2.5 px-3 text-right">Desconto</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                      {canEdit && <th className="py-2.5 px-3 text-right">Ações</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items
                      .filter((it) => it.tipo === 'servico')
                      .map((it) => {
                        let itemDescVal = 0
                        if (it.desconto_item && it.desconto_item > 0) {
                          const raw = (it.valor_unitario || 0) * (it.quantidade || 0)
                          itemDescVal =
                            it.desconto_item_tipo === 'percentual'
                              ? (raw * it.desconto_item) / 100
                              : it.desconto_item
                        }
                        return (
                          <tr key={it.id} className="hover:bg-emerald-50/30 transition-colors">
                            <td className="py-2.5 px-3">
                              <div className="font-medium text-slate-900">{it.descricao}</div>
                              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded font-medium">
                                Serviço livre
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-medium">
                              {it.quantidade}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                              R${' '}
                              {(it.valor_unitario || 0).toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-rose-600">
                              {itemDescVal > 0
                                ? `- R$ ${itemDescVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                              R${' '}
                              {(it.valor_total_item || 0).toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            {canEdit && (
                              <td className="py-2.5 px-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setEditingItem(it)
                                      setModalDefaultKind('servico')
                                      setModalLockKind(false)
                                      setItemModalOpen(true)
                                    }}
                                    className="h-7 w-7 text-slate-500 hover:text-emerald-700"
                                    title="Editar serviço"
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteItem(it.id, it.descricao)}
                                    className="h-7 w-7 text-red-500 hover:bg-red-50"
                                    title="Excluir serviço"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    {items.filter((it) => it.tipo === 'servico').length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-7 text-center text-slate-400 text-xs">
                          Nenhum serviço ou mão de obra adicionado. Clique em "+ Adicionar serviço"
                          (digitação livre) ou "Selecionar serviço cadastrado".
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Rodapé do Subtotal de Serviços */}
              <div className="px-4 py-2.5 bg-emerald-50/50 border-t border-emerald-100 flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-950 flex items-center gap-1.5">
                  <Wrench className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Subtotal Serviços:</span>
                </span>
                <span className="font-mono tabular-nums font-bold text-sm text-emerald-900">
                  R${' '}
                  {financialSummary.subtotalServicos.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* CARD DE RESUMO CONSOLIDADO: PRODUTOS + SERVIÇOS - DESCONTOS = TOTAL GERAL */}
          <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-white via-slate-50/50 to-indigo-50/30 overflow-hidden">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center justify-between">
                <span>Resumo Consolidado do Orçamento</span>
                <span className="text-[11px] font-normal text-slate-500">
                  Produtos ({items.filter((it) => it.tipo !== 'servico').length}) + Serviços (
                  {items.filter((it) => it.tipo === 'servico').length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-xs">
              {/* Grid com subtotais independentes lado a lado */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-white border border-indigo-100 rounded-lg shadow-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center">
                      <Package className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        Subtotal Produtos
                      </div>
                      <div className="text-xs font-semibold text-slate-800">
                        {items.filter((it) => it.tipo !== 'servico').length}{' '}
                        {items.filter((it) => it.tipo !== 'servico').length === 1
                          ? 'item'
                          : 'itens'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono tabular-nums font-bold text-sm text-indigo-900">
                      R${' '}
                      {financialSummary.subtotalProdutos.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-white border border-emerald-100 rounded-lg shadow-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <Wrench className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        Subtotal Serviços
                      </div>
                      <div className="text-xs font-semibold text-slate-800">
                        {items.filter((it) => it.tipo === 'servico').length}{' '}
                        {items.filter((it) => it.tipo === 'servico').length === 1
                          ? 'item'
                          : 'itens'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono tabular-nums font-bold text-sm text-emerald-900">
                      R${' '}
                      {financialSummary.subtotalServicos.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Linha da soma bruta */}
              <div className="flex justify-between items-center text-slate-600 font-medium pt-1">
                <span>Subtotal Bruto (Produtos + Serviços):</span>
                <span className="font-mono tabular-nums font-bold text-slate-800">
                  R${' '}
                  {financialSummary.subtotal.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              {financialSummary.somaDescontosItens > 0 && (
                <div className="flex justify-between items-center text-rose-600 font-medium">
                  <span>Soma de Descontos nos Itens:</span>
                  <span className="font-mono tabular-nums font-bold">
                    - R${' '}
                    {financialSummary.somaDescontosItens.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}

              {/* Desconto no Total do Orçamento (Nível 2) */}
              <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">
                    Desconto no Total Geral (Percentual ou Valor Fixo):
                  </span>
                  <div className="flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-[10px]">
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() =>
                        handleApplyTotalDiscount(orcamento.desconto_total_valor || 0, 'valor')
                      }
                      className={`px-2 py-0.5 rounded font-semibold ${
                        orcamento.desconto_total_tipo === 'valor'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600'
                      }`}
                    >
                      R$ Fixo
                    </button>
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() =>
                        handleApplyTotalDiscount(
                          orcamento.desconto_total_percentual || 0,
                          'percentual',
                        )
                      }
                      className={`px-2 py-0.5 rounded font-semibold ${
                        orcamento.desconto_total_tipo === 'percentual'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600'
                      }`}
                    >
                      % Percentual
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={!canEdit}
                    value={
                      orcamento.desconto_total_tipo === 'percentual'
                        ? orcamento.desconto_total_percentual || ''
                        : orcamento.desconto_total_valor || ''
                    }
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0
                      handleApplyTotalDiscount(val, orcamento.desconto_total_tipo || 'valor')
                    }}
                    placeholder="0,00"
                    className="h-8 w-32 font-mono tabular-nums font-bold text-rose-700"
                  />
                  <span className="font-semibold text-slate-600">
                    {orcamento.desconto_total_tipo === 'percentual' ? '%' : 'R$'}
                  </span>

                  {financialSummary.pctDoTotal > 0 && (
                    <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                      {financialSummary.pctDoTotal.toFixed(1)}% de desconto aplicado
                    </span>
                  )}
                </div>

                {financialSummary.descTotal > 0 && (
                  <div className="space-y-1 pt-1">
                    <label className="text-[11px] font-semibold text-slate-700 block">
                      Justificativa / Observação do Desconto (opcional):
                    </label>
                    <Input
                      value={justificativaDesconto}
                      disabled={!canEdit}
                      onChange={(e) => {
                        setJustificativaDesconto(e.target.value)
                        triggerAutoSave({ justificativa_desconto: e.target.value })
                      }}
                      placeholder="Ex: Pagamento à vista, cortesia comercial, cliente recorrente..."
                      className="h-8 text-xs bg-slate-50"
                    />
                  </div>
                )}
              </div>

              {/* Destaque do TOTAL GERAL */}
              <div className="p-3 bg-indigo-900 text-white rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-xs">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-indigo-200 font-semibold">
                    Produtos + Serviços − Descontos
                  </div>
                  <div className="text-sm font-bold text-white">TOTAL GERAL DO ORÇAMENTO</div>
                </div>
                <div className="font-mono tabular-nums font-extrabold text-xl sm:text-2xl text-emerald-300">
                  R${' '}
                  {financialSummary.totalGeral.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* FOTOS DO ORÇAMENTO (CÂMERA / GALERIA - MÁX 5) */}
          <OrcamentoPhotos
            orcamentoId={orcamento.id}
            anexos={anexos}
            canEdit={canEdit}
            onUpdated={loadAll}
          />

          {/* OBSERVAÇÕES E CONDIÇÕES */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-slate-900">
                Observações e Condições de Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Forma de Pagamento
                  </label>
                  <Select
                    value={orcamento.forma_pagamento || 'pix'}
                    disabled={!canEdit}
                    onValueChange={(val: OrcamentoFormaPagamento) =>
                      triggerAutoSave({ forma_pagamento: val })
                    }
                  >
                    <SelectTrigger className="h-11 sm:h-9 text-sm sm:text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                      <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                      <SelectItem value="boleto">Boleto</SelectItem>
                      <SelectItem value="crediario">Crediário</SelectItem>
                      <SelectItem value="outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Nº de Parcelas</label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    step="1"
                    disabled={!canEdit}
                    value={parcelasInput}
                    onChange={(e) => {
                      const raw = e.target.value
                      setParcelasInput(raw)
                      const parsed = parseInt(raw, 10)
                      if (!isNaN(parsed) && parsed >= 1) {
                        triggerAutoSave({ parcelas: parsed })
                      }
                    }}
                    onBlur={() => {
                      const parsed = parseInt(parcelasInput, 10)
                      const normalized = isNaN(parsed) || parsed < 1 ? 1 : parsed
                      setParcelasInput(String(normalized))
                      if (orcamento.parcelas !== normalized) {
                        triggerAutoSave({ parcelas: normalized })
                      }
                    }}
                    className="h-11 sm:h-9 text-sm sm:text-xs font-mono"
                    placeholder="1"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block font-mono">
                    {(orcamento.parcelas || 1) > 1 ? (
                      <>
                        {orcamento.parcelas || 1}x de{' '}
                        <strong className="text-indigo-700">
                          R${' '}
                          {financialSummary.valorParcela.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </strong>
                      </>
                    ) : (
                      <>
                        1x de{' '}
                        <strong className="text-slate-700">
                          R${' '}
                          {financialSummary.totalGeral.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </strong>{' '}
                        (à vista)
                      </>
                    )}
                  </span>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Valor de Entrada (R$)
                  </label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    disabled={!canEdit}
                    value={orcamento.entrada || ''}
                    onChange={(e) => {
                      const ent = parseFloat(e.target.value) || 0
                      const rest = Math.max(0, financialSummary.totalGeral - ent)
                      triggerAutoSave({ entrada: ent, restante: rest })
                    }}
                    placeholder="0,00"
                    className="h-11 sm:h-9 text-sm sm:text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Observações Gerais e Garantia
                </label>
                <Textarea
                  value={orcamento.observacoes || ''}
                  disabled={!canEdit}
                  onChange={(e) => triggerAutoSave({ observacoes: e.target.value })}
                  placeholder="Ex: Garantia de 90 dias nas peças e serviços. Valores válidos por 15 dias..."
                  rows={3}
                  className="text-xs"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* COLUNA LATERAL: ASSINATURAS E AÇÕES RÁPIDAS */}
        <div className="space-y-6">
          {/* Card de Assinaturas */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center justify-between">
                <span>Assinaturas Digitais</span>
                <span className="text-[10px] text-slate-400 font-normal">Fundo transparente</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              {/* Assinatura do Cliente */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">Aprovação do Cliente:</span>
                  {orcamento.assinatura_cliente ? (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                      Coletada
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-amber-600 border-amber-300 text-[10px]"
                    >
                      Pendente
                    </Badge>
                  )}
                </div>

                {orcamento.assinatura_cliente ? (
                  <div className="h-16 bg-white border border-slate-200 rounded flex items-center justify-center p-1">
                    <img
                      src={pb.files.getURL(orcamento, orcamento.assinatura_cliente)}
                      alt="Assinatura Cliente"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic">
                    Assinatura do cliente ainda não foi coletada.
                  </p>
                )}

                {canEdit && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSignerRole('customer')
                      setSignatureModalOpen(true)
                    }}
                    className="w-full text-xs h-8 font-semibold text-indigo-700 bg-white hover:bg-indigo-50 border-indigo-200"
                  >
                    {orcamento.assinatura_cliente
                      ? 'Refazer Assinatura do Cliente'
                      : 'Coletar Assinatura do Cliente'}
                  </Button>
                )}
              </div>

              {/* Assinatura do Técnico */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">
                    Responsável Técnico (Opcional):
                  </span>
                  {orcamento.assinatura_tecnico ? (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                      Coletada
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-slate-400 text-[10px]">
                      Opcional
                    </Badge>
                  )}
                </div>

                {orcamento.assinatura_tecnico ? (
                  <div className="h-16 bg-white border border-slate-200 rounded flex items-center justify-center p-1">
                    <img
                      src={pb.files.getURL(orcamento, orcamento.assinatura_tecnico)}
                      alt="Assinatura Técnico"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : null}

                {canEdit && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSignerRole('technician')
                      setSignatureModalOpen(true)
                    }}
                    className="w-full text-xs h-8 font-semibold text-slate-700 bg-white hover:bg-slate-100"
                  >
                    {orcamento.assinatura_tecnico
                      ? 'Refazer Assinatura do Técnico'
                      : 'Assinar como Técnico'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Botões de rodapé (WhatsApp, Compartilhar, Imprimir A4 e Faturamento) removidos conforme solicitação */}

      {/* Modal de Sucesso com Abertura e Fallback do Grupo do WhatsApp de Faturamento (Refinamento v0.0.150) */}
      <Dialog open={faturamentoSuccessModalOpen} onOpenChange={setFaturamentoSuccessModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-slate-100 bg-white shrink-0">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                <span>
                  {faturamentoSuccessData?.isReenvio
                    ? 'Faturamento Reenviado ao Grupo!'
                    : 'Orçamento Faturado com Sucesso!'}
                </span>
              </DialogTitle>
              <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                {faturamentoSuccessData?.osNumber} · {faturamentoSuccessData?.orcNumber}
              </span>
            </div>
          </DialogHeader>

          <div className="px-6 py-4 space-y-4 text-xs text-slate-600 overflow-y-auto flex-1">
            {/* Indicador visual de status da cópia: verde se copiada, vermelho se pendente/falha */}
            {faturamentoSuccessData?.copiedSuccessfully ? (
              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-lg text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-xs">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Mensagem copiada ✓
                    </span>
                    <span className="font-semibold text-emerald-900 text-xs">
                      Área de transferência pronta!
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    O texto completo do faturamento já está copiado no seu dispositivo, incluindo o
                    link do documento online.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-semibold gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-100/60 shrink-0 self-end sm:self-center"
                  onClick={async () => {
                    if (faturamentoSuccessData?.mensagem) {
                      const ok = await copyToClipboardWithFallback(faturamentoSuccessData.mensagem)
                      if (ok) {
                        toast({ title: 'Mensagem copiada novamente!' })
                      } else {
                        toast({ title: 'Não foi possível copiar', variant: 'destructive' })
                      }
                    }
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copiar Novamente
                </Button>
              </div>
            ) : (
              <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-lg text-rose-950 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-600 text-white shadow-xs">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Falha ao copiar automaticamente
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-xs bg-rose-700 hover:bg-rose-800 text-white font-semibold gap-1.5"
                    onClick={async () => {
                      if (faturamentoSuccessData?.mensagem) {
                        const ok = await copyToClipboardWithFallback(
                          faturamentoSuccessData.mensagem,
                        )
                        if (ok) {
                          setFaturamentoSuccessData((prev) =>
                            prev ? { ...prev, copiedSuccessfully: true } : prev,
                          )
                          toast({ title: 'Mensagem copiada com sucesso!' })
                        } else {
                          toast({ title: 'Não foi possível copiar', variant: 'destructive' })
                        }
                      }
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copiar Novamente
                  </Button>
                </div>
                <p className="text-[11px] text-rose-800">
                  O navegador restringiu a área de transferência. Toque no botão "Copiar Novamente"
                  acima antes de colar no grupo.
                </p>
              </div>
            )}

            {/* Destaque do Link do Documento Online da Proposta (sempre visível para conferência) */}
            {(() => {
              const docUrl =
                faturamentoSuccessData?.documentoUrl ||
                (orcamento
                  ? `${window.location.origin}/proposta/${orcamento.token_acesso || orcamento.id}`
                  : '')
              return (
                <div className="bg-indigo-50/80 border-2 border-indigo-200 rounded-lg p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-bold text-indigo-950 text-xs flex items-center gap-1.5">
                      <FileCheck className="h-4 w-4 text-indigo-600" />
                      Documento da Proposta Online (mesmo link enviado ao cliente):
                    </span>
                    <Badge
                      variant="outline"
                      className="bg-white text-indigo-700 border-indigo-300 font-semibold text-[10px]"
                    >
                      Incluso na mensagem
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 bg-white p-2 rounded-md border border-indigo-200">
                    <LinkIcon className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                    <a
                      href={docUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-700 hover:text-indigo-900 font-mono text-xs underline truncate flex-1 font-semibold"
                      title="Abrir proposta online em nova aba para conferência"
                    >
                      {docUrl}
                    </a>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-indigo-700 hover:bg-indigo-50 gap-1 shrink-0"
                      onClick={() => {
                        if (docUrl) {
                          copyToClipboardSync(docUrl)
                          toast({ title: 'Link do documento copiado!' })
                        }
                      }}
                      title="Copiar apenas o link do documento"
                    >
                      <Copy className="h-3 w-3" />
                      Copiar link
                    </Button>
                    <a
                      href={docUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1 rounded shadow-2xs shrink-0"
                    >
                      <span>Abrir</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <p className="text-[11px] text-indigo-800">
                    Este link público contém todos os detalhes da proposta e assinaturas para o
                    grupo de faturamento conferir e imprimir.
                  </p>
                </div>
              )
            })()}

            {/* Prévia Completa e em Destaque da Mensagem (Rolável e Clara para Conferência) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-slate-500" />
                  Prévia da Mensagem para o Grupo (Confira antes de colar):
                </span>
                <span className="text-[10px] text-slate-600 font-medium">
                  {faturamentoSuccessData?.mensagem.length || 0} caracteres
                </span>
              </div>
              <div className="relative border-2 border-slate-300 rounded-lg bg-slate-900 text-slate-100 p-3 shadow-inner">
                <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed max-h-56 overflow-y-auto select-text pr-2">
                  {faturamentoSuccessData?.mensagem}
                </pre>
              </div>
            </div>

            {/* Botão Grande 'Colar no grupo' com a instrução verbatim solicitada */}
            <div className="bg-emerald-50 border-2 border-emerald-500 rounded-xl p-3.5 sm:p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-emerald-950 text-xs sm:text-sm flex items-center gap-1.5">
                  <MessageCircle className="h-4 w-4 text-emerald-600" />
                  Próximo passo: Colar no WhatsApp
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-600 text-white">
                  Ação Manual
                </span>
              </div>

              {/* Botão grande "Colar no grupo" (largura total) */}
              <Button
                type="button"
                className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold h-14 px-4 rounded-lg shadow-md transition-all text-sm sm:text-base flex items-center justify-center gap-2.5 ring-2 ring-emerald-400/40"
                onClick={async () => {
                  // Garante a cópia síncrona no clique antes de abrir o grupo
                  if (faturamentoSuccessData?.mensagem) {
                    await copyToClipboardWithFallback(faturamentoSuccessData.mensagem)
                  }
                  window.open(WHATSAPP_FATURAMENTO_GROUP_URL, '_blank')
                }}
              >
                <MessageCircle className="h-5 w-5 shrink-0" />
                <span className="truncate">Colar no grupo</span>
                <ExternalLink className="h-4 w-4 shrink-0 opacity-80" />
              </Button>

              {/* Instrução verbatim destacada */}
              <div className="bg-white p-2.5 rounded-lg border border-emerald-300 flex items-start gap-2 text-emerald-950">
                <span className="text-base leading-none">👉</span>
                <p className="text-xs sm:text-[13px] font-bold leading-snug">
                  "Segure no campo de mensagem do grupo de faturamento e cole"
                </p>
              </div>
              <p className="text-[11px] text-emerald-800 leading-tight">
                No celular, toque no botão verde acima para ir ao grupo do WhatsApp, toque e segure
                no campo de texto e selecione <strong>Colar</strong>. No computador, clique acima e
                pressione <strong>Ctrl+V</strong>.
              </p>
            </div>

            {/* Link direto do grupo (Plano B anti-bloqueio de popup) */}
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-600 space-y-1">
              <span className="font-semibold text-slate-700 block">
                Link direto do grupo de faturamento (Plano B anti-bloqueio):
              </span>
              <a
                href={WHATSAPP_FATURAMENTO_GROUP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:text-indigo-800 underline break-all font-mono"
              >
                {WHATSAPP_FATURAMENTO_GROUP_URL}
              </a>
            </div>
          </div>

          <DialogFooter className="px-6 py-3 border-t border-slate-100 bg-slate-50 shrink-0 flex sm:justify-between items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 text-xs font-semibold gap-1.5"
              onClick={async () => {
                if (faturamentoSuccessData?.mensagem) {
                  const ok = await copyToClipboardWithFallback(faturamentoSuccessData.mensagem)
                  if (ok) {
                    setFaturamentoSuccessData((prev) =>
                      prev ? { ...prev, copiedSuccessfully: true } : prev,
                    )
                    toast({ title: 'Mensagem copiada novamente!' })
                  } else {
                    toast({ title: 'Não foi possível copiar', variant: 'destructive' })
                  }
                }
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar Novamente
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              className="h-9 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white"
              onClick={() => setFaturamentoSuccessModalOpen(false)}
            >
              Concluir e Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmação de envio para faturamento */}
      <Dialog open={faturamentoConfirmOpen} onOpenChange={setFaturamentoConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-purple-600" /> Confirmar Faturamento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs text-slate-600">
            <p>
              {orcamento.status === 'faturado'
                ? `O Orçamento ${orcamento.numero_orcamento} já foi faturado anteriormente. Deseja reenviar os dados ao grupo de WhatsApp de Faturamento?`
                : `Você está enviando o Orçamento ${orcamento.numero_orcamento} para o faturamento.`}
            </p>
            <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg text-purple-900 space-y-1">
              <p>
                <strong>Valor Total:</strong> R$ {financialSummary.totalGeral.toFixed(2)}
              </p>
              <p>
                <strong>Forma de Pagamento:</strong> {orcamento.forma_pagamento?.toUpperCase()} (
                {orcamento.parcelas || 1}x)
              </p>
              <p>
                <strong>Cliente:</strong> {activeCustomerName}
              </p>
              <p>
                <strong>Responsável:</strong> {activeResponsibleName}
              </p>
              <p className="text-[11px] text-purple-700 pt-1">
                {orcamento.status === 'faturado' ? (
                  <>
                    • <strong>Idempotência garantida:</strong> Lançamentos financeiros e baixa de
                    estoque NÃO serão duplicados.
                    <br />• O grupo de WhatsApp será aberto e a mensagem copiada novamente.
                  </>
                ) : (
                  <>
                    •{' '}
                    {orcamento.id_os
                      ? 'Lançamento financeiro gerado na O.S.'
                      : 'Lançamento registrado.'}
                    <br />• Baixa de estoque dos produtos aprovados.
                    <br />• Status atualizado para "Faturado".
                  </>
                )}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setFaturamentoConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSendToFaturamento}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
            >
              {orcamento.status === 'faturado' ? 'Reenviar ao Grupo' : 'Confirmar e Faturar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Rejeição de Orçamento com motivo obrigatório */}
      <Dialog open={rejeicaoModalOpen} onOpenChange={setRejeicaoModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <XCircle className="h-5 w-5 text-rose-600" /> Motivo da Rejeição do Orçamento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <p className="text-slate-600">
              Conforme as regras do sistema, o registro de recusa do orçamento exige a justificativa
              do cliente.
            </p>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Motivo da Recusa *</label>
              <Textarea
                value={motivoRejeicao}
                onChange={(e) => setMotivoRejeicao(e.target.value)}
                placeholder="Ex: Valor elevado, cliente optou por não consertar agora, comprou novo equipamento..."
                rows={3}
                className="text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRejeicaoModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={!motivoRejeicao.trim()}
              onClick={handleRejeitar}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Seleção de Tipo de Impressão */}
      <Dialog open={printSelectOpen} onOpenChange={setPrintSelectOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-900">
              Opções de Impressão A4
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start text-xs h-10 font-semibold"
              onClick={() => {
                setPrintSelectOpen(false)
                navigate(`/orcamentos/${orcamento.id}/imprimir?mode=complete`)
              }}
            >
              <Printer className="h-4 w-4 mr-2 text-indigo-600" />
              Imprimir Orçamento Completo (A4)
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start text-xs h-10 font-semibold"
              onClick={() => {
                setPrintSelectOpen(false)
                navigate(`/orcamentos/${orcamento.id}/imprimir?mode=os_summary`)
              }}
            >
              <FileText className="h-4 w-4 mr-2 text-slate-600" />
              Imprimir Apenas Resumo da OS (A4)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Leitor de Código de Barras */}
      <BarcodeScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={handleBarcodeScanned}
      />

      {/* Modal de Seleção de Serviço Cadastrado */}
      <OrcamentoServicoSelectModal
        open={servicoSelectModalOpen}
        onOpenChange={setServicoSelectModalOpen}
        onSelect={handleSelectServicoCadastrado}
      />

      {/* Modal de Itens (Produtos e Serviços) */}
      <OrcamentoItemModal
        open={itemModalOpen}
        onOpenChange={setItemModalOpen}
        orcamentoId={orcamento.id}
        itemToEdit={editingItem}
        defaultKind={modalDefaultKind}
        lockKind={modalLockKind}
        onSaved={loadAll}
      />

      {/* Modal de Assinatura com Screen Orientation API Retrato */}
      <OrcamentoAssinaturaModal
        open={signatureModalOpen}
        onOpenChange={setSignatureModalOpen}
        orcamento={orcamento}
        signerRole={signerRole}
        onSigned={() => {
          loadAll()
        }}
      />
    </div>
  )
}
