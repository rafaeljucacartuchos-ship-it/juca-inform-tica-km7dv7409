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
import { getProduct } from '@/services/products'
import { getCustomerPhone, getCustomerDisplayName } from '@/services/customers'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { BarcodeScanner } from '@/components/BarcodeScanner'
import { OrcamentoItemModal } from '@/components/OrcamentoItemModal'
import { OrcamentoPhotos } from '@/components/OrcamentoPhotos'
import { OrcamentoAssinaturaModal } from '@/components/OrcamentoAssinaturaModal'
import { openWhatsApp, buildWhatsAppUrl } from '@/lib/whatsapp'

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

  // Modais auxiliares
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<OrcamentoItem | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [signatureModalOpen, setSignatureModalOpen] = useState(false)
  const [signerRole, setSignerRole] = useState<'customer' | 'technician'>('customer')
  const [faturamentoConfirmOpen, setFaturamentoConfirmOpen] = useState(false)
  const [rejeicaoModalOpen, setRejeicaoModalOpen] = useState(false)
  const [motivoRejeicao, setMotivoRejeicao] = useState('')
  const [printSelectOpen, setPrintSelectOpen] = useState(false)

  // Gerente / Limite de Desconto
  const [managerPasswordModalOpen, setManagerPasswordModalOpen] = useState(false)
  const [managerPassword, setManagerPassword] = useState('')
  const [pendingDiscountValue, setPendingDiscountValue] = useState<number | null>(null)
  const [pendingDiscountType, setPendingDiscountType] = useState<OrcamentoDescontoTipo>('valor')
  const [justificativaDesconto, setJustificativaDesconto] = useState('')

  // Permissões
  const isManagerOrAdmin = user?.role === 'admin'
  const isLocked = orcamento?.status === 'faturado' || orcamento?.status === 'substituido'
  const canEdit = !isLocked

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadAll = useCallback(async () => {
    if (!id) return
    try {
      const [o, it, an] = await Promise.all([
        getOrcamento(id),
        getOrcamentoItens(id),
        getOrcamentoAnexos(id),
      ])
      setOrcamento(o)
      setItems(it)
      setAnexos(an)
      setJustificativaDesconto(o.justificativa_desconto || '')
    } catch {
      toast({ title: 'Erro ao carregar orçamento', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  useRealtime('orcamentos', (e) => {
    if (e.record?.id === id) loadAll()
  })
  useRealtime('orcamento_itens', () => loadAll())
  useRealtime('orcamento_anexos', () => loadAll())

  // Salvamento automático com debounce de 600ms
  const triggerAutoSave = (fields: Partial<Orcamento>) => {
    if (!id || isLocked) return
    setOrcamento((prev) => (prev ? { ...prev, ...fields } : prev))
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        await updateOrcamento(id, fields)
        await recalculateOrcamentoTotals(id)
      } catch {
        /* best-effort */
      }
    }, 600)
  }

  // Cálculos financeiros em tempo real
  const financialSummary = useMemo(() => {
    const subtotal = items.reduce(
      (sum, it) => sum + (Number(it.valor_unitario) || 0) * (Number(it.quantidade) || 0),
      0,
    )
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

    return {
      subtotal,
      somaDescontosItens,
      totalItensComDesconto,
      descTotal,
      totalGeral,
      pctDoTotal,
    }
  }, [items, orcamento])

  // Validação do limite de 20% de desconto
  const handleApplyTotalDiscount = (val: number, tipo: OrcamentoDescontoTipo) => {
    if (!orcamento) return
    const subtotal = financialSummary.subtotal
    let calculatedVal = val
    if (tipo === 'percentual') {
      calculatedVal = (subtotal * val) / 100
    }
    const percentualEquivalente = subtotal > 0 ? (calculatedVal / subtotal) * 100 : 0

    if (percentualEquivalente > 20 && !isManagerOrAdmin) {
      setPendingDiscountValue(val)
      setPendingDiscountType(tipo)
      setManagerPasswordModalOpen(true)
      return
    }

    applyDiscountConfirmed(val, tipo, justificativaDesconto)
  }

  const applyDiscountConfirmed = async (
    val: number,
    tipo: OrcamentoDescontoTipo,
    justificativa: string,
  ) => {
    if (!id) return
    const payload: Partial<Orcamento> = {
      desconto_total_tipo: tipo,
      justificativa_desconto: justificativa,
    }
    if (tipo === 'percentual') {
      payload.desconto_total_percentual = val
      payload.desconto_total_valor = (financialSummary.totalItensComDesconto * val) / 100
    } else {
      payload.desconto_total_valor = val
      payload.desconto_total_percentual =
        financialSummary.totalItensComDesconto > 0
          ? (val / financialSummary.totalItensComDesconto) * 100
          : 0
    }
    await updateOrcamento(id, payload)
    await recalculateOrcamentoTotals(id)
    await loadAll()
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

  // 1. WhatsApp: wa.me NÃO anexa arquivos. Solução: link do PDF do orçamento + Compartilhamento Nativo
  const handleWhatsApp = async () => {
    if (!orcamento) return
    const cust = orcamento.expand?.id_os?.expand?.customer
    const phone = getCustomerPhone(cust)
    if (!phone) {
      toast({ title: 'Cliente sem telefone cadastrado', variant: 'destructive' })
      return
    }

    const custName = getCustomerDisplayName(cust)
    const pdfUrl = `${window.location.origin}/orcamentos/${orcamento.id}/imprimir`

    const defaultMsg = `Olá ${custName}, segue o orçamento do seu atendimento na Juca Cartuchos e Informática. Qualquer dúvida, estamos à disposição!\n\n📄 Visualizar Orçamento: ${pdfUrl}`

    // Registra no histórico do cliente / pos_venda_messages
    try {
      if (cust?.id) {
        await pb.collection('pos_venda_messages').create({
          customer: cust.id,
          service_order: orcamento.id_os,
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
        await updateOsStatus(
          orcamento.id_os,
          'orcamento_enviado',
          `Orçamento ${orcamento.numero_orcamento} enviado ao cliente via WhatsApp`,
          user?.id,
        )
      } catch {
        /* intentionally ignored */
      }
    }

    openWhatsApp(phone, defaultMsg)
    loadAll()
  }

  // Compartilhamento nativo (navigator.share) para envio direto do link/arquivo
  const handleNativeShare = async () => {
    if (!orcamento) return
    const cust = orcamento.expand?.id_os?.expand?.customer
    const custName = getCustomerDisplayName(cust)
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
      // Status da OS controlado: aprovado+assinado -> "aguardando peças" ou "em execução"
      await updateOsStatus(
        orcamento.id_os,
        'in_progress',
        `Orçamento ${orcamento.numero_orcamento} aprovado e assinado pelo cliente.`,
        user?.id,
      )
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
      // Status da OS: orcamento_rejeitado
      await updateOsStatus(
        orcamento.id_os,
        'orcamento_rejeitado',
        `Orçamento ${orcamento.numero_orcamento} rejeitado. Motivo: ${motivoRejeicao.trim()}`,
        user?.id,
      )
      toast({ title: 'Orçamento marcado como rejeitado.' })
      setRejeicaoModalOpen(false)
      loadAll()
    } catch {
      toast({ title: 'Erro ao rejeitar orçamento', variant: 'destructive' })
    }
  }

  // Faturamento
  const handleSendToFaturamento = async () => {
    if (!orcamento) return
    if (orcamento.status !== 'aprovado') {
      toast({
        title: 'Disponível após aprovação do cliente',
        description: 'O orçamento precisa estar com status Aprovado para ser faturado.',
        variant: 'destructive',
      })
      return
    }

    try {
      await sendOrcamentoToFaturamento(orcamento.id, user?.id)
      toast({
        title: 'Orçamento enviado para o faturamento',
        description: 'Lançamento financeiro gerado e estoque atualizado com sucesso.',
      })
      setFaturamentoConfirmOpen(false)
      loadAll()
    } catch (e: any) {
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
    <div className="space-y-6 pb-28">
      {/* Top Bar e Navegação */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/ordens/${orcamento.id_os}`)}
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
              {orcamento.status === 'substituido' && (
                <span className="text-[11px] text-slate-400 italic">
                  (Histórico - substituído por novo orçamento)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 truncate">
              Vinculado à O.S. #{os?.number || '—'} • Cliente: {getCustomerDisplayName(cust)}
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
          {/* Card dos Dados Principais e Resumo da OS */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-slate-900">
                Informações do Atendimento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="font-semibold text-slate-500">Cliente:</span>
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
            </CardContent>
          </Card>

          {/* ITENS E SERVIÇOS DO ORÇAMENTO */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-bold text-slate-900">
                  Itens e Serviços do Orçamento
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  {items.length} {items.length === 1 ? 'item' : 'itens'}
                </Badge>
              </div>

              {canEdit && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setScannerOpen(true)}
                    className="h-8 text-xs gap-1.5"
                  >
                    <ScanLine className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Código de Barras</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingItem(null)
                      setItemModalOpen(true)
                    }}
                    className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar Item
                  </Button>
                </div>
              )}
            </CardHeader>

            <CardContent className="p-0">
              {/* Tabela de Itens */}
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-y border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2.5 px-3">Tipo</th>
                      <th className="py-2.5 px-3">Descrição</th>
                      <th className="py-2.5 px-3 text-center">Qtd</th>
                      <th className="py-2.5 px-3 text-right">Vlr. Unit.</th>
                      <th className="py-2.5 px-3 text-right">Desconto Item</th>
                      <th className="py-2.5 px-3 text-right">Total Item</th>
                      {canEdit && <th className="py-2.5 px-3 text-right">Ações</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((it) => {
                      let itemDescVal = 0
                      if (it.desconto_item && it.desconto_item > 0) {
                        const raw = it.valor_unitario * it.quantidade
                        itemDescVal =
                          it.desconto_item_tipo === 'percentual'
                            ? (raw * it.desconto_item) / 100
                            : it.desconto_item
                      }
                      return (
                        <tr key={it.id} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                it.tipo === 'servico'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-indigo-100 text-indigo-800'
                              }`}
                            >
                              {it.tipo === 'servico' ? 'Serviço' : 'Produto'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-900">{it.descricao}</td>
                          <td className="py-2.5 px-3 text-center font-mono">{it.quantidade}</td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            R$ {(it.valor_unitario || 0).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-rose-600">
                            {itemDescVal > 0 ? `- R$ ${itemDescVal.toFixed(2)}` : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            R$ {(it.valor_total_item || 0).toFixed(2)}
                          </td>
                          {canEdit && (
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setEditingItem(it)
                                    setItemModalOpen(true)
                                  }}
                                  className="h-7 w-7 text-slate-500 hover:text-indigo-600"
                                  title="Editar item"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteItem(it.id, it.descricao)}
                                  className="h-7 w-7 text-red-500 hover:bg-red-50"
                                  title="Excluir item"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                    {items.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                          Nenhum item adicionado ao orçamento. Clique em "Adicionar Item" ou
                          escaneie o código de barras.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* RESUMO FINANCEIRO E DESCONTOS (2 NÍVEIS) */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3 text-xs">
                <div className="flex justify-between items-center text-slate-600 font-medium">
                  <span>Subtotal Bruto dos Itens:</span>
                  <span className="font-mono font-bold text-slate-800">
                    R$ {financialSummary.subtotal.toFixed(2)}
                  </span>
                </div>

                {financialSummary.somaDescontosItens > 0 && (
                  <div className="flex justify-between items-center text-rose-600 font-medium">
                    <span>Soma de Descontos nos Itens:</span>
                    <span className="font-mono font-bold">
                      - R$ {financialSummary.somaDescontosItens.toFixed(2)}
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
                      className="h-8 w-32 font-mono font-bold text-rose-700"
                    />
                    <span className="font-semibold text-slate-600">
                      {orcamento.desconto_total_tipo === 'percentual' ? '%' : 'R$'}
                    </span>

                    {financialSummary.pctDoTotal > 20 && (
                      <span className="text-[11px] text-amber-700 font-semibold flex items-center gap-1 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                        <AlertTriangle className="h-3 w-3" /> Desconto superior a 20%
                      </span>
                    )}
                  </div>

                  {financialSummary.pctDoTotal > 20 && (
                    <div className="space-y-1 pt-1">
                      <label className="text-[11px] font-semibold text-slate-700 block">
                        Justificativa Obrigatória do Desconto (&gt;20%):
                      </label>
                      <Input
                        value={justificativaDesconto}
                        disabled={!canEdit}
                        onChange={(e) => {
                          setJustificativaDesconto(e.target.value)
                          triggerAutoSave({ justificativa_desconto: e.target.value })
                        }}
                        placeholder="Informe o motivo para concessão do desconto especial..."
                        className="h-8 text-xs bg-slate-50"
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center font-bold text-sm pt-2 border-t border-slate-200">
                  <span className="text-slate-900">VALOR TOTAL DO ORÇAMENTO:</span>
                  <span className="font-mono text-indigo-700 text-lg">
                    R$ {financialSummary.totalGeral.toFixed(2)}
                  </span>
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
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                      <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                      <SelectItem value="boleto">Boleto</SelectItem>
                      <SelectItem value="outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Nº de Parcelas</label>
                  <Input
                    type="number"
                    min="1"
                    disabled={!canEdit}
                    value={orcamento.parcelas || 1}
                    onChange={(e) =>
                      triggerAutoSave({ parcelas: parseInt(e.target.value, 10) || 1 })
                    }
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Valor de Entrada (R$)
                  </label>
                  <Input
                    type="number"
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
                    className="h-8 text-xs font-mono"
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

      {/* AÇÕES PRINCIPAIS FIXAS NO RODAPÉ (MOBILE-FIRST, BOTÕES ≥44px) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 sm:px-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="hidden sm:flex items-center gap-3 text-xs">
            <span className="font-bold text-slate-900 font-mono text-sm">
              {orcamento.numero_orcamento}
            </span>
            <span>•</span>
            <span className="text-slate-600">Total:</span>
            <span className="font-mono font-bold text-base text-indigo-700">
              R$ {financialSummary.totalGeral.toFixed(2)}
            </span>
          </div>

          <div className="grid grid-cols-3 sm:flex items-center gap-2 w-full sm:w-auto">
            {/* WhatsApp com link PDF e registro no histórico */}
            <Button
              type="button"
              onClick={handleWhatsApp}
              className="h-11 sm:h-10 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm"
              title="Enviar orçamento com link PDF pelo WhatsApp"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="truncate">WhatsApp</span>
            </Button>

            {/* Compartilhamento Nativo */}
            <Button
              type="button"
              variant="outline"
              onClick={handleNativeShare}
              className="h-11 sm:h-10 px-3 text-xs font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50 gap-1.5 shadow-2xs"
              title="Compartilhamento nativo com o arquivo PDF do orçamento"
            >
              <Share2 className="h-4 w-4" />
              <span className="truncate">Compartilhar</span>
            </Button>

            {/* Opções de Impressão A4 */}
            <Button
              type="button"
              variant="outline"
              onClick={() => setPrintSelectOpen(true)}
              className="h-11 sm:h-10 px-3 text-xs font-bold border-slate-300 text-slate-800 hover:bg-slate-100 gap-1.5 shadow-2xs"
            >
              <Printer className="h-4 w-4" />
              <span className="truncate">Imprimir A4</span>
            </Button>

            {/* Enviar para Faturamento (integrado aos pagamentos da O.S. existentes) */}
            <div className="col-span-3 sm:col-span-1">
              {orcamento.status === 'aprovado' ? (
                <Button
                  type="button"
                  onClick={() => setFaturamentoConfirmOpen(true)}
                  className="w-full sm:w-auto h-11 sm:h-10 px-4 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white gap-1.5 shadow-md shadow-purple-600/20"
                >
                  <DollarSign className="h-4 w-4" />
                  <span>Enviar para Faturamento</span>
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-block w-full sm:w-auto">
                      <Button
                        type="button"
                        disabled
                        className="w-full sm:w-auto h-11 sm:h-10 px-4 text-xs font-bold bg-slate-200 text-slate-400 cursor-not-allowed gap-1.5"
                      >
                        <Lock className="h-4 w-4" />
                        <span>Enviar para Faturamento</span>
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Disponível após aprovação do cliente</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      </div>

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
              Você está enviando o <strong>Orçamento {orcamento.numero_orcamento}</strong> para o
              faturamento da Ordem de Serviço.
            </p>
            <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg text-purple-900 space-y-1">
              <p>
                <strong>Valor a Faturar:</strong> R$ {financialSummary.totalGeral.toFixed(2)}
              </p>
              <p>
                <strong>Forma de Pagamento:</strong> {orcamento.forma_pagamento?.toUpperCase()} (
                {orcamento.parcelas || 1}x)
              </p>
              <p className="text-[11px] text-purple-700">
                • Será gerado um lançamento financeiro nos pagamentos da OS.
                <br />• A baixa do estoque dos produtos aprovados será realizada.
                <br />• O status do orçamento mudará para "Faturado".
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
              Confirmar e Faturar
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

      {/* Modal de Senha do Gerente para Descontos > 20% */}
      <Dialog open={managerPasswordModalOpen} onOpenChange={setManagerPasswordModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Autorização de Gerente (&gt;20%)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <p className="text-slate-600">
              Descontos superiores a 20% exigem justificativa e senha do gerente ou administrador.
            </p>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Justificativa do Desconto *
              </label>
              <Input
                value={justificativaDesconto}
                onChange={(e) => setJustificativaDesconto(e.target.value)}
                placeholder="Ex: Parceria de longa data, pagamento à vista no PIX..."
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Senha de Gerente / Admin
              </label>
              <Input
                type="password"
                value={managerPassword}
                onChange={(e) => setManagerPassword(e.target.value)}
                placeholder="Digite a senha..."
                className="h-8 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setManagerPasswordModalOpen(false)
                setPendingDiscountValue(null)
              }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!justificativaDesconto.trim()) {
                  toast({
                    title: 'Justificativa obrigatória',
                    description: 'Descreva a razão do desconto concedido.',
                    variant: 'destructive',
                  })
                  return
                }
                // Senha padrão administrativa ou Skip@Pass
                if (
                  managerPassword === 'Skip@Pass' ||
                  managerPassword === 'admin123' ||
                  isManagerOrAdmin
                ) {
                  if (pendingDiscountValue !== null) {
                    applyDiscountConfirmed(
                      pendingDiscountValue,
                      pendingDiscountType,
                      justificativaDesconto,
                    )
                  }
                  setManagerPasswordModalOpen(false)
                  toast({ title: 'Desconto autorizado pelo gerente!' })
                } else {
                  toast({
                    title: 'Senha incorreta',
                    description: 'A senha informada não confere com a de gerente.',
                    variant: 'destructive',
                  })
                }
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Autorizar Desconto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leitor de Código de Barras */}
      <BarcodeScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={handleBarcodeScanned}
      />

      {/* Modal de Itens */}
      <OrcamentoItemModal
        open={itemModalOpen}
        onOpenChange={setItemModalOpen}
        orcamentoId={orcamento.id}
        itemToEdit={editingItem}
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
