import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import {
  FileCheck2,
  ArrowLeft,
  Save,
  Printer,
  Wrench,
  FileText,
  Monitor,
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Search,
  ExternalLink,
} from 'lucide-react'
import {
  getLaudo,
  createLaudo,
  updateLaudo,
  buildSnapshotFromOrderAndEquipment,
  generateNextLaudoNumber,
} from '@/services/laudos'
import { getServiceOrder, getServiceOrders } from '@/services/service_orders'
import { getOrcamentosByOs, getOrcamentos } from '@/services/orcamentos'
import { getEquipment } from '@/services/equipment'
import { getCustomers } from '@/services/customers'
import { getUsers } from '@/services/users'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import type { LaudoTecnico, ServiceOrder, Orcamento, Equipment, Customer, User } from '@/types'

interface NavState {
  fromOs?: string
  osNumber?: string
  returnUrl?: string
  id_orcamento?: string
}

export function LaudoDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const navState = (location.state as NavState) || null
  const { toast } = useToast()
  const { user } = useAuth()

  const isNew = !id || id === 'novo'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Dados do formulário
  const [laudo, setLaudo] = useState<Partial<LaudoTecnico>>({
    status: 'rascunho',
    data_laudo: new Date().toISOString(),
  })

  // Listas auxiliares para seleção
  const [ordersList, setOrdersList] = useState<ServiceOrder[]>([])
  const [orcamentosList, setOrcamentosList] = useState<Orcamento[]>([])
  const [usersList, setUsersList] = useState<User[]>([])

  // Busca de O.S. para autocomplete no seletor
  const [orderSearchQuery, setOrderSearchQuery] = useState('')
  const [searchingOrders, setSearchingOrders] = useState(false)

  // Vínculo e retorno à OS
  const originOsId = navState?.fromOs || laudo?.id_ordem || undefined
  const originOsNumber = navState?.osNumber || laudo?.expand?.id_ordem?.number || undefined

  const handleVoltar = () => {
    if (navState?.returnUrl) {
      navigate(navState.returnUrl)
      return
    }
    if (originOsId) {
      navigate(`/ordens/${originOsId}`)
      return
    }
    navigate('/laudos')
  }

  // Carrega listas para seleção
  useEffect(() => {
    getUsers()
      .then((u) => setUsersList(u))
      .catch(() => {})
  }, [])

  // Carrega dados se for edição ou inicializa se for novo
  useEffect(() => {
    let active = true

    const init = async () => {
      setLoading(true)
      setLoadError(null)

      try {
        if (isNew) {
          // Se veio com fromOs via location.state, puxa automaticamente
          const initialOsId = navState?.fromOs
          let initialNumero = ''
          let initialSnapshot: any = {}
          let targetOrder: ServiceOrder | null = null
          let initialOrcId = navState?.id_orcamento

          if (initialOsId) {
            try {
              targetOrder = await getServiceOrder(initialOsId)
              initialSnapshot = buildSnapshotFromOrderAndEquipment({
                order: targetOrder,
                equipment: targetOrder.expand?.equipment_ref,
                customer: targetOrder.expand?.customer,
              })

              // Busca orçamentos vinculados a esta O.S.
              const orcs = await getOrcamentosByOs(initialOsId)
              setOrcamentosList(orcs)
              if (!initialOrcId && orcs.length > 0) {
                // Seleciona o primeiro orçamento ativo
                const activeOrc = orcs.find((o) => o.status !== 'substituido') || orcs[0]
                initialOrcId = activeOrc.id
              }
            } catch (err) {
              console.warn('Falha ao carregar OS de origem:', err)
            }
          }

          initialNumero = await generateNextLaudoNumber(targetOrder?.number)

          if (!active) return

          setLaudo({
            numero_laudo: initialNumero,
            id_ordem: initialOsId,
            id_orcamento: initialOrcId,
            id_cliente: targetOrder?.customer,
            id_equipamento: targetOrder?.equipment_ref,
            tecnico_responsavel: user?.id,
            tecnico_nome: user?.name,
            status: 'rascunho',
            data_laudo: new Date().toISOString(),
            problema_relatado: targetOrder?.description || targetOrder?.title || '',
            diagnostico_tecnico: targetOrder?.diagnostic || '',
            servicos_realizados: targetOrder?.service_report || '',
            ...initialSnapshot,
          })
          setLoading(false)
          return
        }

        // Modo edição
        if (id) {
          const rec = await getLaudo(id)
          if (!active) return
          setLaudo(rec)

          if (rec.id_ordem) {
            const orcs = await getOrcamentosByOs(rec.id_ordem)
            if (active) setOrcamentosList(orcs)
          }
          setLoading(false)
        }
      } catch (err) {
        console.error(err)
        if (active) {
          setLoadError('Erro ao carregar o laudo técnico.')
          setLoading(false)
        }
      }
    }

    init()

    return () => {
      active = false
    }
  }, [id, isNew, navState, user?.id, user?.name])

  // Busca rápida de Ordens de Serviço ao digitar na busca
  const handleSearchOrders = async (query: string) => {
    setOrderSearchQuery(query)
    const clean = query.trim()
    if (!clean || clean.length < 2) {
      setOrdersList([])
      return
    }
    setSearchingOrders(true)
    try {
      const filter = `number ~ "${clean}" || title ~ "${clean}" || equipment ~ "${clean}"`
      const list = await getServiceOrders(filter, '-created')
      setOrdersList(list.slice(0, 10))
    } catch {
      setOrdersList([])
    } finally {
      setSearchingOrders(false)
    }
  }

  // Quando o usuário seleciona uma O.S., importa automaticamente as informações do equipamento cadastrado
  const handleSelectOrder = async (order: ServiceOrder) => {
    try {
      const fullOrder = await getServiceOrder(order.id)
      const snapshot = buildSnapshotFromOrderAndEquipment({
        order: fullOrder,
        equipment: fullOrder.expand?.equipment_ref,
        customer: fullOrder.expand?.customer,
      })

      // Puxa orçamentos daquela O.S.
      const orcs = await getOrcamentosByOs(order.id)
      setOrcamentosList(orcs)
      const activeOrc = orcs.find((o) => o.status !== 'substituido') || orcs[0]

      setLaudo((prev) => ({
        ...prev,
        id_ordem: order.id,
        id_cliente: fullOrder.customer,
        id_equipamento: fullOrder.equipment_ref,
        id_orcamento: activeOrc ? activeOrc.id : prev.id_orcamento,
        problema_relatado: prev.problema_relatado || fullOrder.description || fullOrder.title || '',
        diagnostico_tecnico: prev.diagnostico_tecnico || fullOrder.diagnostic || '',
        servicos_realizados: prev.servicos_realizados || fullOrder.service_report || '',
        ...snapshot,
      }))

      setOrdersList([])
      setOrderSearchQuery('')

      toast({
        title: 'Dados importados com sucesso!',
        description: `Informações do equipamento e cliente da O.S. #${order.number} vinculadas.`,
      })
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao importar dados da O.S.', variant: 'destructive' })
    }
  }

  // Salva ou finaliza o laudo
  const handleSave = async (finalizar = false) => {
    if (!laudo.numero_laudo?.trim()) {
      toast({ title: 'Número do laudo é obrigatório', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const payload: Partial<LaudoTecnico> = {
        ...laudo,
        status: finalizar ? 'finalizado' : laudo.status || 'rascunho',
      }

      if (isNew) {
        const created = await createLaudo(payload)
        toast({
          title: finalizar ? 'Laudo finalizado com sucesso!' : 'Laudo salvo com sucesso!',
          description: `Número: ${created.numero_laudo}`,
        })
        navigate(`/laudos/${created.id}`, {
          state: navState,
          replace: true,
        })
      } else if (id) {
        const updated = await updateLaudo(id, payload)
        setLaudo(updated)
        toast({
          title: finalizar ? 'Laudo finalizado com sucesso!' : 'Alterações salvas com sucesso!',
        })
      }
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao salvar laudo técnico', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-red-700">
        <AlertCircle className="h-8 w-8 mx-auto mb-2" />
        <p className="font-semibold text-sm">{loadError}</p>
        <Button onClick={handleVoltar} variant="outline" className="mt-4 text-xs">
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Voltar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* CABEÇALHO DA PÁGINA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleVoltar}
            className="h-9 px-3 text-xs gap-1.5 border-slate-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {originOsNumber ? `Voltar para O.S. #${originOsNumber}` : 'Voltar'}
          </Button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                {isNew ? 'Novo Laudo Técnico' : `Laudo ${laudo.numero_laudo}`}
              </h1>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                  laudo.status === 'finalizado'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}
              >
                {laudo.status === 'finalizado' ? 'Finalizado' : 'Rascunho'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {isNew
                ? 'Vincule a O.S. para puxar todos os dados do equipamento e orçamento.'
                : 'Edite o diagnóstico, parecer técnico e dados do equipamento periciado.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isNew && id && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate(`/laudos/${id}/imprimir`)}
              className="h-9 text-xs font-semibold gap-1.5"
            >
              <Printer className="h-4 w-4" />
              Imprimir / PDF
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleSave(false)}
            disabled={saving}
            className="h-9 text-xs font-semibold gap-1.5 border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar Rascunho'}
          </Button>

          {laudo.status !== 'finalizado' && (
            <Button
              type="button"
              size="sm"
              onClick={() => handleSave(true)}
              disabled={saving}
              className="h-9 text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              <CheckCircle2 className="h-4 w-4" />
              Finalizar Laudo
            </Button>
          )}
        </div>
      </div>

      {/* BLOCO 1: VÍNCULOS COM O.S. E ORÇAMENTO (IMPORTAÇÃO AUTOMÁTICA) */}
      <Card className="border-indigo-200 bg-indigo-50/30 shadow-sm">
        <CardHeader className="pb-3 border-b border-indigo-100">
          <CardTitle className="text-sm font-bold text-indigo-950 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-indigo-600" />
              Vínculo com Ordem de Serviço e Orçamento
            </span>
            <span className="text-[11px] font-normal text-indigo-700">
              Importa cliente e equipamento automaticamente
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Seletor de O.S. */}
            <div>
              <Label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Ordem de Serviço (O.S.) Vinculada</span>
                {laudo.id_ordem && (
                  <button
                    type="button"
                    onClick={() => navigate(`/ordens/${laudo.id_ordem}`)}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                  >
                    Ver O.S. <ExternalLink className="h-3 w-3" />
                  </button>
                )}
              </Label>

              {laudo.id_ordem ? (
                <div className="mt-1 flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-md text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <Wrench className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                    <span className="font-bold text-slate-900 font-mono">
                      O.S. #{originOsNumber || laudo.id_ordem}
                    </span>
                    <span className="text-slate-500 truncate">
                      • {laudo.cliente_nome || 'Cliente vinculado'}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setLaudo((prev) => ({ ...prev, id_ordem: undefined }))
                      setOrcamentosList([])
                    }}
                    className="h-6 text-[11px] text-slate-500 hover:text-red-600 p-1"
                  >
                    Trocar O.S.
                  </Button>
                </div>
              ) : (
                <div className="mt-1 relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="Digite o número da O.S. ou nome do cliente..."
                    value={orderSearchQuery}
                    onChange={(e) => handleSearchOrders(e.target.value)}
                    className="h-9 text-xs pl-8 bg-white"
                  />
                  {searchingOrders && (
                    <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-indigo-600" />
                  )}

                  {ordersList.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-20 mt-1 max-h-56 overflow-y-auto bg-white rounded-md border border-slate-200 shadow-lg text-xs">
                      {ordersList.map((ord) => (
                        <button
                          key={ord.id}
                          type="button"
                          onClick={() => handleSelectOrder(ord)}
                          className="w-full text-left p-2.5 hover:bg-indigo-50 border-b border-slate-100 flex items-center justify-between transition-colors"
                        >
                          <div>
                            <span className="font-bold font-mono text-indigo-900 mr-2">
                              #{ord.number}
                            </span>
                            <span className="font-medium text-slate-800">
                              {ord.expand?.customer?.name || 'Cliente sem nome'}
                            </span>
                            <p className="text-[10px] text-slate-500">
                              Equipamento: {ord.equipment || ord.expand?.equipment_ref?.name || '—'}
                            </p>
                          </div>
                          <span className="text-[10px] bg-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded">
                            Importar
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Seletor de Orçamento */}
            <div>
              <Label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Orçamento Vinculado (Opcional)</span>
                {laudo.id_orcamento && (
                  <button
                    type="button"
                    onClick={() => navigate(`/orcamentos/${laudo.id_orcamento}`)}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                  >
                    Ver Orçamento <ExternalLink className="h-3 w-3" />
                  </button>
                )}
              </Label>
              <div className="mt-1">
                <Select
                  value={laudo.id_orcamento || 'nenhum'}
                  onValueChange={(val) =>
                    setLaudo((prev) => ({
                      ...prev,
                      id_orcamento: val === 'nenhum' ? undefined : val,
                    }))
                  }
                >
                  <SelectTrigger className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Selecione o orçamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Nenhum orçamento vinculado</SelectItem>
                    {orcamentosList.map((orc) => (
                      <SelectItem key={orc.id} value={orc.id}>
                        {orc.numero_orcamento} (
                        {orc.total_geral
                          ? `R$ ${orc.total_geral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          : 'R$ 0,00'}
                        ) - {orc.status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* BLOCO 2: DADOS DO CLIENTE E DO EQUIPAMENTO (SNAPSHOT CONGELADO) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Dados do Cliente */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
              <UserIcon className="h-3.5 w-3.5 text-indigo-600" />
              Dados do Cliente (Snapshot)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3 space-y-3 text-xs">
            <div>
              <Label className="text-[11px] font-semibold text-slate-600">
                Nome / Razão Social *
              </Label>
              <Input
                value={laudo.cliente_nome || ''}
                onChange={(e) => setLaudo((prev) => ({ ...prev, cliente_nome: e.target.value }))}
                className="h-8 text-xs bg-white mt-1"
                placeholder="Nome do cliente"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] font-semibold text-slate-600">CPF / CNPJ</Label>
                <Input
                  value={laudo.cliente_documento || ''}
                  onChange={(e) =>
                    setLaudo((prev) => ({ ...prev, cliente_documento: e.target.value }))
                  }
                  className="h-8 text-xs bg-white mt-1 font-mono"
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <Label className="text-[11px] font-semibold text-slate-600">Telefone</Label>
                <Input
                  value={laudo.cliente_telefone || ''}
                  onChange={(e) =>
                    setLaudo((prev) => ({ ...prev, cliente_telefone: e.target.value }))
                  }
                  className="h-8 text-xs bg-white mt-1"
                  placeholder="(67) 90000-0000"
                />
              </div>
            </div>
            <div>
              <Label className="text-[11px] font-semibold text-slate-600">Endereço Completo</Label>
              <Input
                value={laudo.cliente_endereco || ''}
                onChange={(e) =>
                  setLaudo((prev) => ({ ...prev, cliente_endereco: e.target.value }))
                }
                className="h-8 text-xs bg-white mt-1"
                placeholder="Rua, número, bairro, cidade"
              />
            </div>
          </CardContent>
        </Card>

        {/* Dados do Equipamento Cadastrado */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
              <Monitor className="h-3.5 w-3.5 text-indigo-600" />
              Equipamento Cadastrado (Snapshot)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3 space-y-3 text-xs">
            <div>
              <Label className="text-[11px] font-semibold text-slate-600">
                Nome do Equipamento *
              </Label>
              <Input
                value={laudo.equipamento_nome || ''}
                onChange={(e) =>
                  setLaudo((prev) => ({ ...prev, equipamento_nome: e.target.value }))
                }
                className="h-8 text-xs bg-white mt-1"
                placeholder="Ex: Notebook Dell Inspiron 15"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] font-semibold text-slate-600">
                  Fabricante / Marca
                </Label>
                <Input
                  value={laudo.equipamento_fabricante || ''}
                  onChange={(e) =>
                    setLaudo((prev) => ({ ...prev, equipamento_fabricante: e.target.value }))
                  }
                  className="h-8 text-xs bg-white mt-1"
                  placeholder="Dell, HP, Epson, Samsung..."
                />
              </div>
              <div>
                <Label className="text-[11px] font-semibold text-slate-600">Modelo</Label>
                <Input
                  value={laudo.equipamento_modelo || ''}
                  onChange={(e) =>
                    setLaudo((prev) => ({ ...prev, equipamento_modelo: e.target.value }))
                  }
                  className="h-8 text-xs bg-white mt-1"
                  placeholder="Ex: L3250, G3 3590"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] font-semibold text-slate-600">Número de Série</Label>
                <Input
                  value={laudo.equipamento_serial || ''}
                  onChange={(e) =>
                    setLaudo((prev) => ({ ...prev, equipamento_serial: e.target.value }))
                  }
                  className="h-8 text-xs bg-white mt-1 font-mono"
                  placeholder="Número de série (S/N)"
                />
              </div>
              <div>
                <Label className="text-[11px] font-semibold text-slate-600">
                  Tipo do Equipamento
                </Label>
                <Input
                  value={laudo.equipamento_tipo || ''}
                  onChange={(e) =>
                    setLaudo((prev) => ({ ...prev, equipamento_tipo: e.target.value }))
                  }
                  className="h-8 text-xs bg-white mt-1"
                  placeholder="notebook, impressora, desktop..."
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* BLOCO 3: CONTEÚDO TÉCNICO E PARECER DO LAUDO */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-indigo-600" />
            Conteúdo Técnico do Laudo Pericial
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-bold text-slate-700">1. Problema Relatado</Label>
              <Textarea
                value={laudo.problema_relatado || ''}
                onChange={(e) =>
                  setLaudo((prev) => ({ ...prev, problema_relatado: e.target.value }))
                }
                rows={3}
                className="text-xs bg-white mt-1"
                placeholder="Descrição dos sintomas ou defeitos relatados pelo cliente..."
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-indigo-900">
                2. Diagnóstico Técnico Constatado *
              </Label>
              <Textarea
                value={laudo.diagnostico_tecnico || ''}
                onChange={(e) =>
                  setLaudo((prev) => ({ ...prev, diagnostico_tecnico: e.target.value }))
                }
                rows={3}
                className="text-xs bg-white mt-1 border-indigo-200"
                placeholder="Análise técnica minuciosa realizada em bancada..."
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-bold text-slate-700">
              3. Testes e Procedimentos Executados
            </Label>
            <Textarea
              value={laudo.testes_realizados || ''}
              onChange={(e) => setLaudo((prev) => ({ ...prev, testes_realizados: e.target.value }))}
              rows={2}
              className="text-xs bg-white mt-1"
              placeholder="Testes de estresse, medição de tensões, alinhamento de cabeçote, etc."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-bold text-slate-700">4. Serviços Realizados</Label>
              <Textarea
                value={laudo.servicos_realizados || ''}
                onChange={(e) =>
                  setLaudo((prev) => ({ ...prev, servicos_realizados: e.target.value }))
                }
                rows={2}
                className="text-xs bg-white mt-1"
                placeholder="Desoxidação de placa, regravação de BIOS, troca de rolete..."
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">
                5. Peças e Componentes Substituídos
              </Label>
              <Textarea
                value={laudo.pecas_substituidas || ''}
                onChange={(e) =>
                  setLaudo((prev) => ({ ...prev, pecas_substituidas: e.target.value }))
                }
                rows={2}
                className="text-xs bg-white mt-1"
                placeholder="SSD NVMe 500GB, Teclado ABNT2, Cabeça de Impressão..."
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-bold text-indigo-950">
              6. Parecer Técnico Conclusivo
            </Label>
            <Textarea
              value={laudo.conclusao_parecer || ''}
              onChange={(e) => setLaudo((prev) => ({ ...prev, conclusao_parecer: e.target.value }))}
              rows={3}
              className="text-xs bg-white mt-1 border-indigo-200"
              placeholder="Conclusão sobre a viabilidade de reparo, integridade dos componentes e conformidade..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-bold text-slate-700">Recomendações ao Cliente</Label>
              <Textarea
                value={laudo.recomendacoes || ''}
                onChange={(e) => setLaudo((prev) => ({ ...prev, recomendacoes: e.target.value }))}
                rows={2}
                className="text-xs bg-white mt-1"
                placeholder="Utilizar nobreak adequado, não desligar puxando da tomada..."
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">Observações Gerais</Label>
              <Textarea
                value={laudo.observacoes || ''}
                onChange={(e) => setLaudo((prev) => ({ ...prev, observacoes: e.target.value }))}
                rows={2}
                className="text-xs bg-white mt-1"
                placeholder="Observações complementares internas ou gerais..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* BLOCO 4: IDENTIFICAÇÃO DO TÉCNICO E CONTROLE */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <Label className="text-xs font-semibold text-slate-700">Técnico Responsável</Label>
            <Select
              value={laudo.tecnico_responsavel || 'nenhum'}
              onValueChange={(val) => {
                const found = usersList.find((u) => u.id === val)
                setLaudo((prev) => ({
                  ...prev,
                  tecnico_responsavel: val === 'nenhum' ? undefined : val,
                  tecnico_nome: found?.name || prev.tecnico_nome,
                }))
              }}
            >
              <SelectTrigger className="h-9 text-xs bg-white mt-1">
                <SelectValue placeholder="Selecione o técnico" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Não informado</SelectItem>
                {usersList.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-700">Status do Laudo</Label>
            <Select
              value={laudo.status || 'rascunho'}
              onValueChange={(val: any) => setLaudo((prev) => ({ ...prev, status: val }))}
            >
              <SelectTrigger className="h-9 text-xs bg-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rascunho">Rascunho (Em elaboração)</SelectItem>
                <SelectItem value="finalizado">Finalizado (Emitido)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-700">Data do Laudo</Label>
            <Input
              type="date"
              value={
                laudo.data_laudo
                  ? laudo.data_laudo.substring(0, 10)
                  : new Date().toISOString().substring(0, 10)
              }
              onChange={(e) =>
                setLaudo((prev) => ({
                  ...prev,
                  data_laudo: e.target.value
                    ? new Date(e.target.value).toISOString()
                    : new Date().toISOString(),
                }))
              }
              className="h-9 text-xs bg-white mt-1"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default LaudoDetail
