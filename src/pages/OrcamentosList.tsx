import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  DollarSign,
  Layers,
  ArrowRight,
  Filter,
  Check,
  Link as LinkIcon,
  HelpCircle,
  Loader2,
  ExternalLink,
  Printer,
  Share2,
  Trash2,
} from 'lucide-react'
import { RecordActionsMenu, RecordActionItem } from '@/components/RecordActionsMenu'
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog'
import { deleteOrcamento } from '@/services/orcamentos'
import { usePermissions } from '@/hooks/use-permissions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Orcamento, OrcamentoStatus, ServiceOrder, User, Customer } from '@/types'
import { getOrcamentos, createOrcamento } from '@/services/orcamentos'
import { getServiceOrders } from '@/services/service_orders'
import { getCustomerDisplayName, getCustomerPhone, getCustomers } from '@/services/customers'
import { getUsers } from '@/services/users'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'

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

export default function OrcamentosList() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()
  const { hasPermission } = usePermissions()

  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [deleteTarget, setDeleteTarget] = useState<Orcamento | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('todos')

  // Modal Novo Orçamento
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [vincularOs, setVincularOs] = useState(false)
  const [selectedOsId, setSelectedOsId] = useState<string>('')
  const [validade, setValidade] = useState<number>(15)
  const [observacoes, setObservacoes] = useState('')
  const [availableOrders, setAvailableOrders] = useState<ServiceOrder[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)

  // Campos específicos de Orçamento Independente (v0.0.146)
  const [systemUsers, setSystemUsers] = useState<User[]>([])
  const [selectedResponsavelId, setSelectedResponsavelId] = useState<string>('')
  const [clienteSearch, setClienteSearch] = useState('')
  const [clienteResults, setClienteResults] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [nomeClienteLivre, setNomeClienteLivre] = useState('')
  const [telefoneClienteLivre, setTelefoneClienteLivre] = useState('')
  const [equipamentoIndependente, setEquipamentoIndependente] = useState('')
  const [defeitoIndependente, setDefeitoIndependente] = useState('')
  const [searchingClientes, setSearchingClientes] = useState(false)
  const [showClienteDropdown, setShowClienteDropdown] = useState(false)

  const loadData = async () => {
    try {
      const data = await getOrcamentos()
      setOrcamentos(data)
    } catch {
      toast({ title: 'Erro ao carregar orçamentos', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime('orcamentos', () => loadData())

  // Carrega ordens de serviço ativas para vincular e usuários para responsável
  useEffect(() => {
    if (createModalOpen) {
      setLoadingOrders(true)
      getServiceOrders()
        .then((orders) => {
          setAvailableOrders(orders)
        })
        .catch(() => {})
        .finally(() => setLoadingOrders(false))

      getUsers()
        .then((u) => {
          setSystemUsers(u)
          if (!selectedResponsavelId && user?.id) {
            setSelectedResponsavelId(user.id)
          }
        })
        .catch(() => {})
    }
  }, [createModalOpen, user?.id, selectedResponsavelId])

  // Autocomplete de clientes no modal
  useEffect(() => {
    if (!clienteSearch.trim() || clienteSearch.trim().length < 2) {
      setClienteResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearchingClientes(true)
      try {
        const res = await getCustomers(clienteSearch.trim())
        setClienteResults(res.slice(0, 8))
      } catch {
        setClienteResults([])
      } finally {
        setSearchingClientes(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [clienteSearch])

  // Filtragem
  const filteredOrcamentos = useMemo(() => {
    return orcamentos.filter((orc) => {
      // Filtro de status
      if (statusFilter !== 'todos' && orc.status !== statusFilter) {
        return false
      }

      // Filtro de busca (número, cliente, observação, número da OS, equipamento)
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim()
        const num = (orc.numero_orcamento || '').toLowerCase()
        const osNum = (orc.expand?.id_os?.number || '').toLowerCase()
        const custName = (
          orc.expand?.id_os?.expand?.customer
            ? getCustomerDisplayName(orc.expand.id_os.expand.customer)
            : orc.expand?.cliente_id
              ? getCustomerDisplayName(orc.expand.cliente_id)
              : orc.nome_cliente_livre || ''
        ).toLowerCase()
        const obs = (orc.observacoes || '').toLowerCase()
        const equip = (
          orc.expand?.id_os?.equipment ||
          orc.expand?.id_os?.expand?.equipment_ref?.name ||
          orc.equipamento_independente ||
          ''
        ).toLowerCase()
        const respName = (
          orc.expand?.responsavel_id?.name ||
          orc.expand?.id_os?.expand?.technician?.name ||
          ''
        ).toLowerCase()

        return (
          num.includes(term) ||
          osNum.includes(term) ||
          custName.includes(term) ||
          obs.includes(term) ||
          equip.includes(term) ||
          respName.includes(term)
        )
      }

      return true
    })
  }, [orcamentos, statusFilter, searchTerm])

  // Estatísticas de contagem por status
  const canDeleteOrc = user?.role === 'admin' || hasPermission('os_delete')

  const handleDeleteOrcamento = async () => {
    if (!deleteTarget) return
    try {
      await deleteOrcamento(deleteTarget.id)
      toast({ title: 'Orçamento excluído com sucesso!' })
      setDeleteTarget(null)
      loadData()
    } catch {
      toast({ title: 'Erro ao excluir orçamento', variant: 'destructive' })
    }
  }

  const buildOrcamentoActions = (orc: Orcamento): RecordActionItem[] => {
    const osRec = orc.expand?.id_os
    const custRec = osRec?.expand?.customer || orc.expand?.cliente_id
    const phone = custRec ? getCustomerPhone(custRec) : orc.telefone_cliente_livre
    const docUrl = `${window.location.origin}/orcamentos/${orc.id}/print`

    return [
      {
        key: 'open',
        label: 'Abrir detalhes',
        icon: ExternalLink,
        onClick: () => navigate(`/orcamentos/${orc.id}`),
      },
      {
        key: 'print',
        label: 'Imprimir PDF (A4)',
        icon: Printer,
        onClick: () => window.open(docUrl, '_blank'),
      },
      {
        key: 'share',
        label: 'Página pública / Proposta',
        icon: Share2,
        onClick: () => {
          if (orc.token_acesso) {
            window.open(`/proposta/${orc.token_acesso}`, '_blank')
          } else {
            navigate(`/orcamentos/${orc.id}`)
          }
        },
      },
      {
        key: 'delete',
        label: 'Excluir Orçamento',
        icon: Trash2,
        variant: 'destructive',
        separatorBefore: true,
        hidden: !canDeleteOrc,
        onClick: () => setDeleteTarget(orc),
      },
    ]
  }

  const counts = useMemo(() => {
    const res: Record<string, number> = {
      todos: orcamentos.length,
      rascunho: 0,
      enviado: 0,
      aguardando_aprovacao: 0,
      aprovado: 0,
      faturado: 0,
      rejeitado: 0,
    }
    for (const o of orcamentos) {
      if (res[o.status] !== undefined) {
        res[o.status]++
      }
    }
    return res
  }, [orcamentos])

  // Submissão do modal de novo orçamento
  const handleCreate = async () => {
    if (vincularOs && !selectedOsId) {
      toast({
        title: 'Selecione uma Ordem de Serviço',
        description: 'Ao marcar a opção de vincular a uma O.S., a seleção da O.S. é obrigatória.',
        variant: 'destructive',
      })
      return
    }

    setCreating(true)
    try {
      const clienteIdFinal = vincularOs ? null : selectedCustomer?.id || null
      const nomeFinal = vincularOs
        ? undefined
        : selectedCustomer
          ? getCustomerDisplayName(selectedCustomer)
          : nomeClienteLivre.trim() || undefined
      const telefoneFinal = vincularOs
        ? undefined
        : selectedCustomer
          ? getCustomerPhone(selectedCustomer) || undefined
          : telefoneClienteLivre.trim() || undefined

      const created = await createOrcamento({
        id_os: vincularOs ? selectedOsId : null,
        id_usuario_criador: user?.id,
        validade: Number(validade) || 15,
        observacoes,
        cliente_id: clienteIdFinal,
        nome_cliente_livre: nomeFinal,
        telefone_cliente_livre: telefoneFinal,
        responsavel_id: vincularOs ? null : selectedResponsavelId || user?.id || null,
        equipamento_independente: vincularOs
          ? undefined
          : equipamentoIndependente.trim() || undefined,
        defeito_independente: vincularOs ? undefined : defeitoIndependente.trim() || undefined,
      })

      toast({
        title: 'Orçamento criado com sucesso!',
        description: `Número: ${created.numero_orcamento}${
          vincularOs ? ' (vinculado e com número herdado da O.S.)' : ' (independente)'
        }`,
      })

      setCreateModalOpen(false)
      // Redireciona para os detalhes do novo orçamento
      navigate(`/orcamentos/${created.id}`)
    } catch (err: any) {
      toast({
        title: 'Erro ao criar orçamento',
        description: err.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setCreating(false)
    }
  }

  // OS selecionada para exibir prévia
  const selectedOrder = useMemo(() => {
    return availableOrders.find((o) => o.id === selectedOsId)
  }, [availableOrders, selectedOsId])

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <FileText className="h-6 w-6 text-indigo-600" />
            Módulo de Orçamentos
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerencie propostas comerciais, orçamentos vinculados a O.S. ou independentes.
          </p>
        </div>

        <Button
          onClick={() => {
            setVincularOs(false)
            setSelectedOsId('')
            setSelectedCustomer(null)
            setClienteSearch('')
            setNomeClienteLivre('')
            setTelefoneClienteLivre('')
            setSelectedResponsavelId(user?.id || '')
            setEquipamentoIndependente('')
            setDefeitoIndependente('')
            setValidade(15)
            setObservacoes('')
            setCreateModalOpen(true)
          }}
          className="h-10 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-sm w-full sm:w-auto justify-center"
        >
          <Plus className="h-4 w-4" /> Novo Orçamento
        </Button>
      </div>

      {/* Cartões de Status / Filtros Rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        <button
          type="button"
          onClick={() => setStatusFilter('todos')}
          className={`p-2.5 rounded-lg border text-left transition-all ${
            statusFilter === 'todos'
              ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-400'
              : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span className="text-[11px] font-semibold text-slate-500 block">Todos</span>
          <span className="text-base font-bold text-slate-900 font-mono">{counts.todos || 0}</span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('rascunho')}
          className={`p-2.5 rounded-lg border text-left transition-all ${
            statusFilter === 'rascunho'
              ? 'bg-slate-100 border-slate-400 ring-1 ring-slate-400'
              : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span className="text-[11px] font-semibold text-slate-500 block">Rascunho</span>
          <span className="text-base font-bold text-slate-700 font-mono">
            {counts.rascunho || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('enviado')}
          className={`p-2.5 rounded-lg border text-left transition-all ${
            statusFilter === 'enviado'
              ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-400'
              : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span className="text-[11px] font-semibold text-blue-700 block">Enviados</span>
          <span className="text-base font-bold text-blue-800 font-mono">{counts.enviado || 0}</span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('aguardando_aprovacao')}
          className={`p-2.5 rounded-lg border text-left transition-all ${
            statusFilter === 'aguardando_aprovacao'
              ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-400'
              : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span className="text-[11px] font-semibold text-amber-700 block">Aguardando</span>
          <span className="text-base font-bold text-amber-800 font-mono">
            {counts.aguardando_aprovacao || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('aprovado')}
          className={`p-2.5 rounded-lg border text-left transition-all ${
            statusFilter === 'aprovado'
              ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-400'
              : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span className="text-[11px] font-semibold text-emerald-700 block">Aprovados</span>
          <span className="text-base font-bold text-emerald-800 font-mono">
            {counts.aprovado || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('faturado')}
          className={`p-2.5 rounded-lg border text-left transition-all ${
            statusFilter === 'faturado'
              ? 'bg-purple-50 border-purple-300 ring-1 ring-purple-400'
              : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span className="text-[11px] font-semibold text-purple-700 block">Faturados</span>
          <span className="text-base font-bold text-purple-800 font-mono">
            {counts.faturado || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('rejeitado')}
          className={`p-2.5 rounded-lg border text-left transition-all ${
            statusFilter === 'rejeitado'
              ? 'bg-rose-50 border-rose-300 ring-1 ring-rose-400'
              : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span className="text-[11px] font-semibold text-rose-700 block">Rejeitados</span>
          <span className="text-base font-bold text-rose-800 font-mono">
            {counts.rejeitado || 0}
          </span>
        </button>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por número, cliente, O.S., equipamento..."
            className="pl-9 h-10 text-xs bg-white"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10 text-xs w-full sm:w-56 bg-white">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="rascunho">Rascunho</SelectItem>
              <SelectItem value="enviado">Enviado</SelectItem>
              <SelectItem value="aguardando_aprovacao">Aguardando Aprovação</SelectItem>
              <SelectItem value="aprovado">Aprovado</SelectItem>
              <SelectItem value="faturado">Faturado</SelectItem>
              <SelectItem value="rejeitado">Rejeitado</SelectItem>
              <SelectItem value="substituido">Substituído</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Lista de Orçamentos */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">Carregando orçamentos...</div>
      ) : filteredOrcamentos.length === 0 ? (
        <Card className="border-slate-200 p-8 text-center bg-white">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-3">
            <FileText className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Nenhum orçamento encontrado</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Não há orçamentos cadastrados com os critérios informados. Crie um novo orçamento para
            começar.
          </p>
          <Button
            size="sm"
            onClick={() => setCreateModalOpen(true)}
            className="mt-4 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
          >
            <Plus className="h-4 w-4 mr-1" /> Criar Orçamento
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrcamentos.map((orc) => {
            const osRec = orc.expand?.id_os
            const custRec =
              osRec?.expand?.customer ||
              orc.expand?.cliente_id ||
              (orc.nome_cliente_livre
                ? ({
                    name: orc.nome_cliente_livre,
                    celular: orc.telefone_cliente_livre || '',
                    phone: orc.telefone_cliente_livre || '',
                  } as Customer)
                : null)
            const techRec =
              osRec?.expand?.technician ||
              orc.expand?.responsavel_id ||
              orc.expand?.id_usuario_criador
            const equipName =
              osRec?.expand?.equipment_ref?.name ||
              osRec?.equipment ||
              orc.equipamento_independente ||
              'Não especificado'
            const cfg = STATUS_CONFIG[orc.status] || STATUS_CONFIG.rascunho

            return (
              <Card
                key={orc.id}
                onClick={() => navigate(`/orcamentos/${orc.id}`)}
                className="border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer bg-white flex flex-col justify-between overflow-hidden"
              >
                <CardHeader className="p-4 pb-2 bg-slate-50/70 border-b border-slate-100">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono text-sm font-extrabold text-indigo-900">
                        {orc.numero_orcamento}
                      </span>
                      {osRec?.number ? (
                        <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-200/70 px-1.5 py-0.5 rounded truncate">
                          {osRec.number}
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          Independente
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge
                        className={`${cfg.bg} ${cfg.color} ${cfg.border} border text-[10px] font-bold uppercase tracking-wider shrink-0`}
                      >
                        {cfg.label}
                      </Badge>
                      <RecordActionsMenu
                        label={`Orçamento: ${orc.numero_orcamento}`}
                        items={buildOrcamentoActions(orc)}
                        title={`Ações de ${orc.numero_orcamento}`}
                      />
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-3 text-xs flex-1">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Cliente
                    </span>
                    <p className="font-bold text-slate-900 truncate">
                      {custRec ? getCustomerDisplayName(custRec) : 'Cliente não informado'}
                    </p>
                    {custRec && (
                      <p className="text-[11px] text-slate-500">
                        {getCustomerPhone(custRec) || orc.telefone_cliente_livre || 'Sem telefone'}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 block">
                        Equipamento
                      </span>
                      <p className="font-medium text-slate-800 truncate" title={equipName}>
                        {equipName}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 block">
                        Responsável
                      </span>
                      <p className="font-medium text-slate-800 truncate">
                        {techRec?.name || 'Não atribuído'}
                      </p>
                    </div>
                  </div>

                  {/* Assinaturas */}
                  <div className="flex items-center gap-2 pt-1">
                    <span
                      className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded font-semibold ${
                        orc.assinatura_cliente
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {orc.assinatura_cliente ? '✓ Cliente Assinou' : 'Assinatura Pendente'}
                    </span>
                  </div>
                </CardContent>

                <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Total Geral</span>
                    <span className="font-mono text-sm font-black text-indigo-700">
                      R${' '}
                      {(orc.total_geral || 0).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/orcamentos/${orc.id}`)
                    }}
                    className="h-7 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 p-1"
                  >
                    Abrir <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDeleteOrcamento}
        title="Excluir Orçamento"
        description={`Tem certeza que deseja excluir o orçamento ${deleteTarget?.numero_orcamento}? Esta ação não pode ser desfeita.`}
      />

      {/* Modal de Criação de Orçamento */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Plus className="h-5 w-5 text-indigo-600" />
              Novo Orçamento
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Opção de Vincular a uma O.S. */}
            <div className="p-3 rounded-lg border border-indigo-200 bg-indigo-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="vincular-os-switch" className="font-bold text-slate-900 text-xs">
                    Vincular a uma Ordem de Serviço (O.S.)?
                  </Label>
                  <p className="text-[11px] text-slate-500">
                    O orçamento herda o número da O.S. (ex.: OS-0041 vira ORC-0041) e seus dados.
                  </p>
                </div>
                <Switch
                  id="vincular-os-switch"
                  checked={vincularOs}
                  onCheckedChange={setVincularOs}
                />
              </div>

              {vincularOs && (
                <div className="space-y-2 pt-2 border-t border-indigo-100">
                  <Label className="font-semibold text-slate-800 text-xs">
                    Selecione a Ordem de Serviço *
                  </Label>
                  <Select value={selectedOsId} onValueChange={setSelectedOsId}>
                    <SelectTrigger className="h-9 text-xs bg-white">
                      <SelectValue
                        placeholder={
                          loadingOrders ? 'Carregando ordens...' : 'Escolha a O.S. correspondente'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {availableOrders.map((ord) => (
                        <SelectItem key={ord.id} value={ord.id}>
                          <span className="font-mono font-bold mr-1.5">{ord.number}</span>
                          <span>• {getCustomerDisplayName(ord.expand?.customer)}</span>
                          <span className="text-slate-400 text-[10px] ml-1">
                            ({ord.equipment || ord.expand?.equipment_ref?.name || 'S/ equipamento'})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Prévia dos dados herdados */}
                  {selectedOrder && (
                    <div className="p-2.5 bg-white rounded border border-indigo-200 text-[11px] space-y-1">
                      <p className="font-bold text-indigo-900">
                        Número herdado: ORC-
                        {selectedOrder.number.startsWith('OS-')
                          ? selectedOrder.number.replace('OS-', '')
                          : selectedOrder.number}
                      </p>
                      <p className="text-slate-700">
                        <strong>Cliente:</strong>{' '}
                        {getCustomerDisplayName(selectedOrder.expand?.customer)}
                      </p>
                      <p className="text-slate-700">
                        <strong>Equipamento:</strong>{' '}
                        {selectedOrder.equipment ||
                          selectedOrder.expand?.equipment_ref?.name ||
                          '—'}
                      </p>
                      <p className="text-slate-700">
                        <strong>Técnico:</strong>{' '}
                        {selectedOrder.expand?.technician?.name || 'Não atribuído'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {!vincularOs && (
              <div className="space-y-3 pt-1 border-t border-slate-200">
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-slate-600 text-[11px]">
                  ℹ️ <strong>Orçamento Independente:</strong> Receberá numeração sequencial própria
                  (ORC-XXXX).
                </div>

                {/* 1) Cliente: busca com autocomplete OU texto livre */}
                <div className="space-y-1 relative">
                  <Label className="font-semibold text-slate-800 text-xs">
                    Cliente (Buscar cadastrado ou digitar livremente)
                  </Label>
                  {selectedCustomer ? (
                    <div className="flex items-center justify-between p-2 rounded border border-emerald-300 bg-emerald-50 text-xs">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate">
                          {getCustomerDisplayName(selectedCustomer)}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          Tel: {getCustomerPhone(selectedCustomer) || 'Sem telefone'} • CPF/CNPJ:{' '}
                          {selectedCustomer.cpf_cnpj || '—'}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedCustomer(null)
                          setNomeClienteLivre('')
                          setTelefoneClienteLivre('')
                          setClienteSearch('')
                        }}
                        className="h-7 text-xs text-rose-600 hover:bg-rose-100"
                      >
                        Trocar
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <Input
                          type="text"
                          placeholder="Digite o nome do cliente..."
                          value={clienteSearch || nomeClienteLivre}
                          onChange={(e) => {
                            const val = e.target.value
                            setClienteSearch(val)
                            setNomeClienteLivre(val)
                            setShowClienteDropdown(true)
                          }}
                          onFocus={() => {
                            if (clienteResults.length > 0) setShowClienteDropdown(true)
                          }}
                          className="h-9 text-xs"
                        />
                        {searchingClientes && (
                          <Loader2 className="h-4 w-4 animate-spin absolute right-2.5 top-2.5 text-slate-400" />
                        )}
                      </div>

                      {showClienteDropdown && clienteResults.length > 0 && (
                        <div className="absolute z-20 left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-white border border-slate-200 rounded-md shadow-lg divide-y divide-slate-100 text-xs">
                          <div className="p-1.5 bg-slate-50 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                            Clientes Cadastrados:
                          </div>
                          {clienteResults.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setSelectedCustomer(c)
                                setNomeClienteLivre(getCustomerDisplayName(c))
                                setTelefoneClienteLivre(getCustomerPhone(c) || '')
                                setClienteSearch('')
                                setShowClienteDropdown(false)
                              }}
                              className="w-full text-left p-2 hover:bg-indigo-50 flex items-center justify-between"
                            >
                              <div>
                                <div className="font-semibold text-slate-900">
                                  {getCustomerDisplayName(c)}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {getCustomerPhone(c) || 'Sem telefone'}
                                </div>
                              </div>
                              <Badge
                                variant="outline"
                                className="text-[9px] border-indigo-200 text-indigo-700"
                              >
                                Selecionar
                              </Badge>
                            </button>
                          ))}
                        </div>
                      )}

                      <div>
                        <Label className="text-slate-500 block text-[11px] mb-0.5">
                          Telefone / WhatsApp (opcional se não cadastrado):
                        </Label>
                        <Input
                          type="text"
                          placeholder="(00) 00000-0000"
                          value={telefoneClienteLivre}
                          onChange={(e) => setTelefoneClienteLivre(e.target.value)}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 2) Técnico OU Vendedor responsável */}
                <div>
                  <Label className="font-semibold text-slate-800 text-xs block mb-1">
                    Técnico / Vendedor Responsável
                  </Label>
                  <select
                    value={selectedResponsavelId}
                    onChange={(e) => setSelectedResponsavelId(e.target.value)}
                    className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs text-slate-900 shadow-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Selecione um profissional...</option>
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
                </div>

                {/* 3) Campos opcionais: Equipamento e Defeito */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                  <div>
                    <Label className="text-slate-600 block text-[11px] mb-0.5">
                      Equipamento (Opcional):
                    </Label>
                    <Input
                      type="text"
                      placeholder="Ex: Notebook Lenovo"
                      value={equipamentoIndependente}
                      onChange={(e) => setEquipamentoIndependente(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-600 block text-[11px] mb-0.5">
                      Defeito / Obs (Opcional):
                    </Label>
                    <Input
                      type="text"
                      placeholder="Ex: Teclado falhando"
                      value={defeitoIndependente}
                      onChange={(e) => setDefeitoIndependente(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label className="font-semibold text-slate-700 block mb-1 text-xs">
                Validade do Orçamento (dias)
              </Label>
              <Input
                type="number"
                min="1"
                value={validade}
                onChange={(e) => setValidade(parseInt(e.target.value, 10) || 15)}
                className="h-9 text-xs font-mono"
              />
            </div>

            <div>
              <Label className="font-semibold text-slate-700 block mb-1 text-xs">
                Observações Iniciais / Condições de Garantia
              </Label>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: Garantia de 90 dias nas peças e serviços..."
                rows={3}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreateModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={creating || (vincularOs && !selectedOsId)}
              onClick={handleCreate}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
            >
              {creating ? 'Criando...' : 'Criar Orçamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
