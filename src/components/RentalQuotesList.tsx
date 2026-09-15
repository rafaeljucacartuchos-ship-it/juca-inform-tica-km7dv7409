import { useState, useMemo } from 'react'
import {
  FileText,
  Search,
  Eye,
  Share2,
  Calendar,
  Layers,
  ArrowRight,
  ExternalLink,
  MessageCircle,
  Copy,
  Check,
  Edit,
  Trash2,
  Filter,
  X,
  Printer,
  Sparkles,
  User,
  CheckCircle2,
  Clock,
  Ban,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { formatBRL, formatCPP } from '@/lib/rental-contract-template'
import { buildRentalProposalClosingMessage, openWhatsApp } from '@/lib/whatsapp'
import { sanitizePhone } from '@/lib/phones'
import { ensureRentalQuoteToken, deleteRentalQuote } from '@/services/rental'
import { useToast } from '@/hooks/use-toast'
import type { RentalQuote, RentalQuoteStatus } from '@/types'

interface RentalQuotesListProps {
  quotes: RentalQuote[]
  onOpenQuote: (quote: RentalQuote) => void
  onEditQuote?: (quote: RentalQuote) => void
  onReload: () => void
}

export function RentalQuotesList({
  quotes,
  onOpenQuote,
  onEditQuote,
  onReload,
}: RentalQuotesListProps) {
  const { toast } = useToast()

  // Filtros
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('todos')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Estados de compartilhamento
  const [sharingId, setSharingId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Modal de exclusão
  const [quoteToDelete, setQuoteToDelete] = useState<RentalQuote | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Filtragem em tempo real (client-side)
  const filteredQuotes = useMemo(() => {
    return quotes.filter((q) => {
      // Filtro de status
      if (statusFilter !== 'todos' && (q.status || 'proposta_gerada') !== statusFilter) {
        return false
      }

      // Filtro de data
      if (startDate) {
        const qDate = (q.created || '').split('T')[0]
        if (qDate < startDate) return false
      }
      if (endDate) {
        const qDate = (q.created || '').split('T')[0]
        if (qDate > endDate) return false
      }

      // Filtro textual
      if (!search.trim()) return true

      const term = search.toLowerCase()
      const cliente = (q.cliente_nome_livre || q.expand?.cliente_id?.name || '').toLowerCase()
      const doc = (q.cliente_documento || q.expand?.cliente_id?.cpf_cnpj || '').toLowerCase()
      const tel = (q.cliente_telefone || q.expand?.cliente_id?.phone || '').toLowerCase()
      const titulo = (q.titulo || '').toLowerCase()

      // Buscar também nos equipamentos da proposta
      const machines = q.maquinas_comparadas || q.resultados?.machines || []
      const machinesText = machines
        .map((m) => `${m.machineName || ''} ${m.serial || ''}`)
        .join(' ')
        .toLowerCase()

      const idMatch = q.id.toLowerCase().includes(term)

      return (
        cliente.includes(term) ||
        doc.includes(term) ||
        tel.includes(term) ||
        titulo.includes(term) ||
        machinesText.includes(term) ||
        idMatch
      )
    })
  }, [quotes, search, statusFilter, startDate, endDate])

  // Helper para URL pública da proposta
  const getProposalPublicUrl = async (quote: RentalQuote): Promise<string> => {
    const origin =
      typeof window !== 'undefined' && window.location.origin ? window.location.origin : ''
    const token = await ensureRentalQuoteToken(quote)
    return `${origin}/proposta-locacao/${quote.id}?token=${encodeURIComponent(token)}`
  }

  // Helper para mensagem curta de fechamento
  const getShortClosingMessage = async (
    quote: RentalQuote,
  ): Promise<{ message: string; url: string }> => {
    const proposalUrl = await getProposalPublicUrl(quote)
    const clienteNome = quote.cliente_nome_livre || quote.expand?.cliente_id?.name || 'Cliente'
    const machines = quote.maquinas_comparadas || quote.resultados?.machines || []
    const mainMachine = machines[0]
    const equipNome =
      machines.length > 1
        ? `${mainMachine?.machineName || 'Multifuncional'} (+1 opção)`
        : mainMachine?.machineName || 'Multifuncional'
    const valorMensal = mainMachine?.franquiaSugerida || 0

    const message = buildRentalProposalClosingMessage({
      customerName: clienteNome,
      propostaUrl: proposalUrl,
      equipamento: equipNome,
      franquiaPaginas: quote.franquia_paginas || 1000,
      valorMensal,
    })

    return { message, url: proposalUrl }
  }

  // Cópia síncrona com fallback
  const copyToClipboard = (text: string): boolean => {
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
          // ignore
        }
      }
    }

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

  // Ação: Compartilhar
  const handleShare = async (quote: RentalQuote) => {
    setSharingId(quote.id)
    try {
      const { message, url } = await getShortClosingMessage(quote)
      const clienteNome = quote.cliente_nome_livre || quote.expand?.cliente_id?.name || 'Cliente'
      const shareTitle = `Proposta de Locação - ${clienteNome} - JUCA Informática`

      const shareData = {
        title: shareTitle,
        text: message,
        url,
      }

      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        try {
          await navigator.share(shareData)
          toast({
            title: 'Proposta compartilhada com sucesso!',
            description: 'Link do documento e mensagem de fechamento enviados.',
          })
          return
        } catch (err: any) {
          if (err?.name === 'AbortError') return
        }
      }

      // Fallback para cópia
      const copiedOk = copyToClipboard(message)
      if (copiedOk) {
        setCopiedId(quote.id)
        setTimeout(() => setCopiedId(null), 2500)
        toast({
          title: 'Link e mensagem copiados!',
          description: 'Mensagem com link direto para o cliente fechar a proposta copiada.',
        })
      } else {
        toast({
          title: 'Link pronto',
          description: url,
        })
      }
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao compartilhar proposta',
        variant: 'destructive',
      })
    } finally {
      setSharingId(null)
    }
  }

  // Ação: WhatsApp direto
  const handleWhatsApp = async (quote: RentalQuote) => {
    const rawPhone = quote.cliente_telefone || quote.expand?.cliente_id?.phone || ''
    const sanitizedPhone = sanitizePhone(rawPhone)

    if (!sanitizedPhone) {
      toast({
        title: 'Cliente sem telefone cadastrado',
        description: 'Utilize a ação Compartilhar para copiar o link.',
        variant: 'destructive',
      })
      return
    }

    try {
      const { message } = await getShortClosingMessage(quote)
      copyToClipboard(message)
      openWhatsApp(sanitizedPhone, message)
      toast({
        title: 'WhatsApp aberto!',
        description: 'Mensagem com o link do documento da proposta enviada para o WhatsApp.',
      })
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao preparar mensagem WhatsApp',
        variant: 'destructive',
      })
    }
  }

  // Ação: Confirmar Exclusão
  const handleDeleteConfirm = async () => {
    if (!quoteToDelete) return
    setDeleting(true)
    try {
      await deleteRentalQuote(quoteToDelete.id)
      toast({
        title: 'Proposta removida com sucesso!',
      })
      setQuoteToDelete(null)
      onReload()
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao remover proposta',
        description: 'Verifique se não há contratos vinculados a esta proposta.',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  // Badge de status
  const getStatusBadge = (status?: RentalQuoteStatus) => {
    const s = status || 'proposta_gerada'
    switch (s) {
      case 'contratado':
        return (
          <Badge className="bg-emerald-600 text-white font-bold text-[10px] gap-1">
            <CheckCircle2 className="h-3 w-3" /> Contratado
          </Badge>
        )
      case 'proposta_gerada':
        return (
          <Badge className="bg-indigo-600 text-white font-bold text-[10px] gap-1">
            <Sparkles className="h-3 w-3" /> Proposta Gerada
          </Badge>
        )
      case 'simulacao':
        return (
          <Badge
            variant="outline"
            className="text-amber-700 bg-amber-50 border-amber-300 font-bold text-[10px] gap-1"
          >
            <Clock className="h-3 w-3" /> Simulação
          </Badge>
        )
      case 'cancelado':
        return (
          <Badge
            variant="outline"
            className="text-slate-600 bg-slate-100 border-slate-300 font-bold text-[10px] gap-1"
          >
            <Ban className="h-3 w-3" /> Cancelada
          </Badge>
        )
      default:
        return <Badge variant="outline">{s}</Badge>
    }
  }

  const hasFiltersActive = Boolean(search || statusFilter !== 'todos' || startDate || endDate)

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('todos')
    setStartDate('')
    setEndDate('')
  }

  return (
    <div className="space-y-4">
      {/* BARRA DE BUSCA E FILTROS */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* CAMPO DE BUSCA PRINCIPAL */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente, CPF/CNPJ, telefone, impressora ou título..."
              className="pl-9 h-9 text-xs bg-slate-50 border-slate-200"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                title="Limpar busca"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* FILTRO DE STATUS */}
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-40 text-xs bg-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="proposta_gerada">Proposta Gerada</SelectItem>
                <SelectItem value="contratado">Contratado</SelectItem>
                <SelectItem value="simulacao">Simulação</SelectItem>
                <SelectItem value="cancelado">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* FILTROS POR DATA (PERÍODO) */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-semibold text-[11px]">Período:</span>
          </div>

          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 text-xs w-36 bg-slate-50"
              placeholder="De"
            />
            <span className="text-slate-400 text-xs">até</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-8 text-xs w-36 bg-slate-50"
              placeholder="Até"
            />
          </div>

          {hasFiltersActive && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-1 ml-auto"
            >
              <X className="h-3 w-3" /> Limpar filtros
            </Button>
          )}

          <div className="text-[11px] text-slate-500 font-medium ml-auto sm:ml-0">
            Mostrando <strong>{filteredQuotes.length}</strong> de <strong>{quotes.length}</strong>{' '}
            propostas
          </div>
        </div>
      </div>

      {/* TABELA / LISTA DE PROPOSTAS */}
      {filteredQuotes.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200 shadow-sm space-y-2">
          <FileText className="h-10 w-10 mx-auto text-slate-300" />
          <h3 className="font-bold text-slate-700 text-sm">Nenhuma proposta encontrada</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {quotes.length === 0
              ? 'Nenhuma proposta de locação salva ainda. Use o Simulador para calcular o CPP e gerar a primeira proposta comercial.'
              : 'Nenhuma proposta corresponde aos critérios de busca ou filtros aplicados.'}
          </p>
          {hasFiltersActive && (
            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="text-xs"
              >
                Limpar filtros de busca
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Data / Título</th>
                <th className="py-3 px-4">Cliente / Locatário</th>
                <th className="py-3 px-4">Equipamento(s)</th>
                <th className="py-3 px-4 text-center">Franquia</th>
                <th className="py-3 px-4 text-right">Valor Mensal</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredQuotes.map((quote) => {
                const clienteNome =
                  quote.cliente_nome_livre || quote.expand?.cliente_id?.name || 'Cliente'
                const clienteDoc =
                  quote.cliente_documento || quote.expand?.cliente_id?.cpf_cnpj || '—'
                const clienteTel = quote.cliente_telefone || quote.expand?.cliente_id?.phone || ''
                const sanitizedPhone = sanitizePhone(clienteTel)

                const machines = quote.maquinas_comparadas || quote.resultados?.machines || []
                const mainMachine = machines[0]
                const valorMensal = mainMachine?.franquiaSugerida || 0
                const excedente = mainMachine?.excedenteSugerido || quote.excesso_pagina_valor || 0
                const isSharingThis = sharingId === quote.id
                const isCopiedThis = copiedId === quote.id

                const dataFormatada = new Date(quote.created || Date.now()).toLocaleDateString(
                  'pt-BR',
                  {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  },
                )

                return (
                  <tr key={quote.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* DATA / TÍTULO */}
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block leading-snug">
                        {quote.titulo || 'Locação de Impressoras'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                        <Calendar className="h-3 w-3" /> {dataFormatada}
                      </span>
                    </td>

                    {/* CLIENTE */}
                    <td className="py-3 px-4">
                      <div className="flex items-start gap-1.5">
                        <User className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-bold text-slate-900 block">{clienteNome}</span>
                          <span className="text-[10px] text-slate-500">Doc: {clienteDoc}</span>
                          {clienteTel && (
                            <span className="text-[10px] text-slate-400 block">
                              Tel: {clienteTel}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* EQUIPAMENTO(S) */}
                    <td className="py-3 px-4">
                      {machines.length > 0 ? (
                        <div className="space-y-1">
                          {machines.map((m, idx) => (
                            <div key={idx} className="flex items-center gap-1.5">
                              <Printer className="h-3 w-3 text-indigo-600 shrink-0" />
                              <span className="font-medium text-slate-800">
                                {m.machineName || 'Impressora'}
                              </span>
                              {machines.length > 1 && (
                                <span className="text-[9px] bg-indigo-50 text-indigo-700 px-1 py-0.2 rounded font-bold">
                                  Opção {idx + 1}
                                </span>
                              )}
                              {m.serial && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  ({m.serial})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Equipamento não especificado</span>
                      )}
                    </td>

                    {/* FRANQUIA DE PÁGINAS */}
                    <td className="py-3 px-4 text-center">
                      <span className="font-mono font-bold text-slate-800 text-xs block">
                        {(quote.franquia_paginas || 0).toLocaleString('pt-BR')} págs
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        Exced: {formatCPP(excedente)}
                      </span>
                    </td>

                    {/* VALOR MENSAL */}
                    <td className="py-3 px-4 text-right">
                      <span className="font-mono font-black text-emerald-800 text-sm tabular-nums block">
                        {formatBRL(valorMensal)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {quote.contrato_meses || 12} meses
                      </span>
                    </td>

                    {/* STATUS */}
                    <td className="py-3 px-4 text-center">{getStatusBadge(quote.status)}</td>

                    {/* AÇÕES */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* AÇÃO ABRIR PROPOSTA (VISUALIZADOR / IMPRESSÃO) */}
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => onOpenQuote(quote)}
                          className="h-8 text-xs font-bold gap-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                          title="Abrir visualização completa da proposta e geração de contrato"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Abrir</span>
                        </Button>

                        {/* AÇÃO COMPARTILHAR (LINK PÚBLICO + MENSAGEM CURTA) */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleShare(quote)}
                          disabled={isSharingThis}
                          className="h-8 text-xs font-semibold gap-1 text-slate-700 hover:text-indigo-600"
                          title="Compartilhar proposta com link e mensagem de fechamento"
                        >
                          {isCopiedThis ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Share2 className="h-3.5 w-3.5 text-indigo-500" />
                          )}
                          <span className="hidden sm:inline">
                            {isCopiedThis ? 'Copiado' : 'Compartilhar'}
                          </span>
                        </Button>

                        {/* WHATSAPP DIRETO SE TIVER TELEFONE */}
                        {sanitizedPhone && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleWhatsApp(quote)}
                            className="h-8 px-2 text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200"
                            title={`Enviar direto no WhatsApp (${clienteTel})`}
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}

                        {/* AÇÃO EDITAR / REABRIR NO SIMULADOR */}
                        {onEditQuote && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onEditQuote(quote)}
                            className="h-8 px-2 text-xs font-semibold text-slate-700 hover:text-indigo-600"
                            title="Reabrir cálculo desta proposta no Simulador"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        )}

                        {/* EXCLUIR */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setQuoteToDelete(quote)}
                          className="h-8 px-2 text-xs text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="Excluir proposta"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      <Dialog
        open={Boolean(quoteToDelete)}
        onOpenChange={(open) => !open && setQuoteToDelete(null)}
      >
        <DialogContent className="max-w-md p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Excluir Proposta de Locação
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Tem certeza que deseja remover esta proposta? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          {quoteToDelete && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
              <p>
                <strong>Cliente:</strong>{' '}
                {quoteToDelete.cliente_nome_livre ||
                  quoteToDelete.expand?.cliente_id?.name ||
                  'Cliente'}
              </p>
              <p>
                <strong>Título:</strong> {quoteToDelete.titulo || 'Locação de Impressoras'}
              </p>
              <p>
                <strong>Franquia:</strong>{' '}
                {(quoteToDelete.franquia_paginas || 0).toLocaleString('pt-BR')} págs/mês
              </p>
            </div>
          )}

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setQuoteToDelete(null)}
              disabled={deleting}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
            >
              {deleting ? 'Excluindo...' : 'Confirmar Exclusão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
