import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  Search,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Link2,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/StatusBadge'
import { ServiceOrder, User as AppUser } from '@/types'
import { getServiceOrders } from '@/services/service_orders'
import { getCustomerDisplayName } from '@/services/customers'
import { STATUS_CONFIG as OS_STATUS_LIST } from '@/lib/dashboard-utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { toast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

interface OsSearchModalOrSelectorProps {
  linkedOs: ServiceOrder | null
  idOs?: string | null
  canEdit: boolean
  technicians: AppUser[]
  onSelectOs: (os: ServiceOrder) => void
  onUnlinkOs: () => void
}

export function ServiceOrderLinkSection({
  linkedOs,
  idOs,
  canEdit,
  technicians,
  onSelectOs,
  onUnlinkOs,
}: OsSearchModalOrSelectorProps) {
  const isMobile = useIsMobile()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTech, setSelectedTech] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [results, setResults] = useState<ServiceOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [totalFound, setTotalFound] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Filtragem de técnicos: apenas usuários com role 'technician' ou 'admin'
  const techOptions = useMemo(() => {
    return technicians.filter((u) => u.role === 'technician' || u.role === 'admin')
  }, [technicians])

  // Busca debounced de Ordens de Serviço
  useEffect(() => {
    // Se o usuário não digitou nada e não filtrou nada, não busca automaticamente para economizar requisições
    const hasSearch = searchTerm.trim().length >= 1
    const hasFilter = selectedTech !== 'all' || selectedStatus !== 'all'

    if (!hasSearch && !hasFilter) {
      setResults([])
      setTotalFound(0)
      setLoading(false)
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        // Monta o filtro do PocketBase
        const filterParts: string[] = []

        if (selectedTech !== 'all') {
          filterParts.push(`technician = "${selectedTech}"`)
        }

        if (selectedStatus !== 'all') {
          filterParts.push(`status = "${selectedStatus}"`)
        }

        const filterStr = filterParts.join(' && ')
        // Busca até 50 O.S. ordenadas pelas mais recentes
        const orders = await getServiceOrders(filterStr, '-created')

        // Filtro em memória para número de OS e nome do cliente (suporta busca insensível a maiúsculas/minúsculas)
        const term = searchTerm.trim().toLowerCase()
        const filtered = orders.filter((os) => {
          if (!term) return true
          const numMatch = (os.number || '').toLowerCase().includes(term)
          const titleMatch = (os.title || '').toLowerCase().includes(term)
          const custName = getCustomerDisplayName(os.expand?.customer).toLowerCase()
          const custMatch = custName.includes(term)
          const equipMatch = (os.equipment || os.expand?.equipment_ref?.name || '')
            .toLowerCase()
            .includes(term)
          return numMatch || custMatch || titleMatch || equipMatch
        })

        setTotalFound(filtered.length)
        setResults(filtered.slice(0, 15))
        setDropdownOpen(true)
      } catch (err) {
        console.error('Erro ao buscar ordens de serviço:', err)
        setResults([])
        setTotalFound(0)
      } finally {
        setLoading(false)
      }
    }, 280)

    return () => clearTimeout(timer)
  }, [searchTerm, selectedTech, selectedStatus])

  // No mobile, abrimos também a opção de busca em modal dedicado (overlay no topo da tela)
  const [mobileModalOpen, setMobileModalOpen] = useState(false)

  // Fecha dropdown do desktop ao clicar fora do containerRef
  useEffect(() => {
    function handlePointerOutside(event: Event) {
      const target = event.target as Node | null
      if (containerRef.current && target && !containerRef.current.contains(target)) {
        // Apenas fecha o dropdown se o clique NÃO foi dentro de um elemento com classe ou id de seleção
        setDropdownOpen(false)
      }
    }

    // Usar 'click' com captura ou mousedown para desktop; em dispositivos touch,
    // evitamos fechar imediatamente para não cortar toques do Safari antes do 'click'
    document.addEventListener('mousedown', handlePointerOutside)
    return () => {
      document.removeEventListener('mousedown', handlePointerOutside)
    }
  }, [])

  // Manipulador seguro para seleção no touch e mouse
  const handleSelectOs = (os: ServiceOrder) => {
    if (!canEdit) {
      toast({
        title: 'Edição bloqueada',
        description: 'Este orçamento não permite alterações no momento.',
        variant: 'destructive',
      })
      return
    }
    if (!os || !os.id) {
      toast({
        title: 'O.S. inválida',
        description: 'A Ordem de Serviço selecionada não possui identificador válido.',
        variant: 'destructive',
      })
      return
    }
    try {
      onSelectOs(os)
      setDropdownOpen(false)
      setSearchTerm('')
    } catch (err: any) {
      console.error('Falha ao acionar onSelectOs:', err)
      toast({
        title: 'Erro ao selecionar O.S.',
        description: err?.message || 'Ocorreu um erro ao vincular a Ordem de Serviço.',
        variant: 'destructive',
      })
    }
  }

  // Manipulador seguro para desvincular O.S.
  const handleUnlinkOs = () => {
    if (!canEdit) {
      toast({
        title: 'Edição bloqueada',
        description: 'Este orçamento não permite alterações no momento.',
        variant: 'destructive',
      })
      return
    }
    try {
      onUnlinkOs()
    } catch (err: any) {
      console.error('Falha ao acionar onUnlinkOs:', err)
      toast({
        title: 'Erro ao desvincular O.S.',
        description: err?.message || 'Ocorreu um erro ao desvincular a Ordem de Serviço.',
        variant: 'destructive',
      })
    }
  }

  // Manipulador seguro para desvincular no touch e mouse
  const handleUnlink = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    onUnlinkOs()
  }

  // Se já houver O.S. vinculada
  if (idOs) {
    const custDisplayName = linkedOs?.expand?.customer
      ? getCustomerDisplayName(linkedOs.expand.customer)
      : 'Cliente da O.S.'
    const osNumber = linkedOs?.number || '—'
    const techName = linkedOs?.expand?.technician?.name || 'Não atribuído'
    const equipName =
      linkedOs?.expand?.equipment_ref?.name || linkedOs?.equipment || 'Não especificado'

    return (
      <div className="rounded-lg border-2 border-indigo-200 bg-indigo-50/60 p-3 sm:p-4 shadow-2xs space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 sm:h-8 sm:w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-900 text-sm">
                  Vinculada à O.S. #{osNumber}
                </span>
                {linkedOs?.status && <StatusBadge status={linkedOs.status} />}
              </div>
              <p className="text-xs text-slate-600 font-medium">Cliente: {custDisplayName}</p>
            </div>
          </div>

          {canEdit && (
            <div className="flex items-center gap-2 self-stretch sm:self-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleUnlink}
                onPointerUp={(e) => {
                  // Garante disparo confiável em touch screens do iOS Safari
                  e.stopPropagation()
                  handleUnlink(e)
                }}
                className="w-full sm:w-auto min-h-[44px] sm:min-h-0 h-10 sm:h-8 text-xs sm:text-xs text-rose-600 border-rose-300 hover:bg-rose-50 hover:text-rose-700 font-semibold gap-1.5 touch-manipulation justify-center select-none"
                title="Desvincular Ordem de Serviço deste orçamento"
              >
                <X className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                Desvincular O.S.
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-indigo-100 text-[11px] text-slate-600">
          <div>
            <span className="font-semibold text-slate-500">Técnico Resp.:</span> {techName}
          </div>
          <div className="truncate">
            <span className="font-semibold text-slate-500">Equipamento:</span> {equipName}
          </div>
          <div>
            <span className="font-semibold text-slate-500">Total O.S.:</span>{' '}
            {linkedOs?.total != null
              ? `R$ ${Number(linkedOs.total).toFixed(2).replace('.', ',')}`
              : '—'}
          </div>
        </div>
      </div>
    )
  }

  const hasSearchOrFilter =
    searchTerm.trim().length >= 1 || selectedTech !== 'all' || selectedStatus !== 'all'

  // Render do conteúdo dos resultados (usado tanto no dropdown quanto no modal e lista inline)
  const renderResultsList = (isInlineMobile: boolean) => (
    <div
      className={
        isInlineMobile
          ? 'w-full bg-white border border-indigo-200 rounded-lg shadow-xs overflow-hidden mt-2'
          : 'overflow-y-auto divide-y divide-slate-100 max-h-64'
      }
    >
      {/* Cabeçalho da lista */}
      <div className="p-2 sm:p-2 bg-slate-100 text-[11px] font-semibold text-slate-700 flex items-center justify-between border-b border-slate-200">
        <span className="truncate pr-2">
          {loading
            ? 'Buscando ordens de serviço...'
            : totalFound === 0
              ? 'Nenhuma O.S. encontrada'
              : `Encontradas ${totalFound} O.S. (mostrando até 15):`}
        </span>
        <button
          type="button"
          onClick={() => {
            setDropdownOpen(false)
            setMobileModalOpen(false)
          }}
          className="min-h-[36px] sm:min-h-0 h-8 sm:h-5 px-2.5 sm:px-1.5 text-xs sm:text-[10px] text-slate-600 hover:text-slate-900 touch-manipulation shrink-0 inline-flex items-center justify-center font-medium rounded hover:bg-slate-200 transition-colors"
        >
          {isInlineMobile ? (
            <span className="flex items-center gap-1">
              Recolher <ChevronUp className="h-3.5 w-3.5" />
            </span>
          ) : (
            'Fechar'
          )}
        </button>
      </div>

      {/* Itens */}
      <div
        className={`divide-y divide-slate-100 ${isInlineMobile ? 'max-h-80 overflow-y-auto' : ''}`}
      >
        {results.length > 0 ? (
          results.map((os) => {
            const custName = getCustomerDisplayName(os.expand?.customer)
            const techName = os.expand?.technician?.name || 'Sem técnico'
            const equip = os.expand?.equipment_ref?.name || os.equipment || os.title || '—'
            return (
              <div
                key={os.id}
                className="w-full p-2.5 sm:p-2.5 min-h-[52px] sm:min-h-[44px] hover:bg-indigo-50/80 active:bg-indigo-100 transition-colors flex items-center justify-between gap-2.5 group touch-manipulation"
              >
                {/* Botão de texto da linha para selecionar a O.S. (button nativo HTML) */}
                <button
                  type="button"
                  onClick={() => handleSelectOs(os)}
                  onPointerUp={(e) => {
                    // Touch direto sem delay no Safari
                    e.preventDefault()
                    handleSelectOs(os)
                  }}
                  className="min-w-0 flex-1 text-left bg-transparent border-0 p-1 cursor-pointer focus:outline-hidden touch-manipulation"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold font-mono text-slate-900 text-xs group-hover:text-indigo-600">
                      #{os.number}
                    </span>
                    <StatusBadge status={os.status} />
                    <span className="text-xs sm:text-[11px] text-slate-700 sm:text-slate-600 font-semibold truncate max-w-[170px] sm:max-w-none">
                      {custName}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">
                    <span>Equipamento: {equip}</span> • <span>Técnico: {techName}</span>
                  </div>
                </button>

                {/* Botão específico "Vincular O.S." */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSelectOs(os)
                  }}
                  onPointerUp={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleSelectOs(os)
                  }}
                  className="shrink-0 min-h-[44px] sm:min-h-0 h-10 sm:h-7 px-3 sm:px-2.5 text-xs sm:text-[10px] font-bold rounded-md bg-indigo-600 hover:bg-indigo-700 text-white active:bg-indigo-800 transition-colors touch-manipulation inline-flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer select-none border-0"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  <span>Vincular O.S.</span>
                </button>
              </div>
            )
          })
        ) : !loading ? (
          <div className="p-4 text-center text-xs text-slate-500 flex flex-col items-center gap-1.5">
            <AlertCircle className="h-4 w-4 text-slate-400" />
            <span className="font-medium text-slate-700">
              Nenhuma O.S. encontrada para a busca informada.
            </span>
            <span className="text-[11px] text-slate-400">
              Tente alterar o número/cliente, técnico ou status da busca acima.
            </span>
          </div>
        ) : (
          <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
            <span>Carregando ordens de serviço...</span>
          </div>
        )}
      </div>
    </div>
  )

  // Caso não esteja vinculada: exibe barra de busca e filtros de Técnico e Status
  return (
    <div
      ref={containerRef}
      className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 sm:p-4 space-y-3 relative shadow-2xs"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1 border-b border-slate-200">
        <div>
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Search className="h-3.5 w-3.5 text-indigo-600" />
            Vincular a uma Ordem de Serviço
          </span>
          <p className="text-[11px] text-slate-500">
            Busque por número da O.S. ou cliente e filtre por técnico ou status para vincular.
          </p>
        </div>
        <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 self-start sm:self-auto">
          Sem vínculo no momento
        </span>
      </div>

      {/* Controles de busca e filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 sm:gap-2">
        {/* Campo de Busca Livre (Número ou Cliente) */}
        <div className="sm:col-span-6 relative">
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
            Buscar O.S. (Nº ou Cliente)
          </label>
          <div className="relative">
            <Search className="h-4 w-4 sm:h-3.5 sm:w-3.5 absolute left-3 top-3 sm:left-2.5 sm:top-2.5 text-slate-400" />
            <Input
              type="text"
              disabled={!canEdit}
              placeholder="Digite o número da OS ou nome do cliente..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setDropdownOpen(true)
              }}
              onFocus={() => {
                if (results.length > 0 || searchTerm.trim().length > 0) {
                  setDropdownOpen(true)
                }
              }}
              className="h-10 sm:h-8 pl-9 sm:pl-8 text-xs bg-white text-slate-900 touch-manipulation"
            />
            {loading && (
              <Loader2 className="h-4 w-4 sm:h-3.5 sm:w-3.5 animate-spin absolute right-3 top-3 sm:right-2.5 sm:top-2.5 text-indigo-600" />
            )}
            {searchTerm && !loading && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('')
                  setResults([])
                }}
                aria-label="Limpar busca"
                className="min-h-[40px] min-w-[40px] sm:min-h-0 sm:min-w-0 flex items-center justify-center absolute right-0 top-0 sm:right-2.5 sm:top-2 text-slate-400 hover:text-slate-600 touch-manipulation"
              >
                <X className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Filtro por Técnico */}
        <div className="sm:col-span-3">
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
            Técnico Responsável
          </label>
          <select
            disabled={!canEdit}
            value={selectedTech}
            onChange={(e) => {
              setSelectedTech(e.target.value)
              setDropdownOpen(true)
            }}
            className="w-full h-10 sm:h-8 rounded-md border border-slate-200 bg-white px-2.5 sm:px-2 py-1 text-xs text-slate-900 shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-indigo-500 touch-manipulation"
          >
            <option value="all">Todos os técnicos</option>
            {techOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro por Status da O.S. */}
        <div className="sm:col-span-3">
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
            Status da O.S.
          </label>
          <select
            disabled={!canEdit}
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value)
              setDropdownOpen(true)
            }}
            className="w-full h-10 sm:h-8 rounded-md border border-slate-200 bg-white px-2.5 sm:px-2 py-1 text-xs text-slate-900 shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-indigo-500 touch-manipulation"
          >
            <option value="all">Todos os status</option>
            {OS_STATUS_LIST.map((cfg) => (
              <option key={cfg.value} value={cfg.value}>
                {cfg.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Botão de abrir/fechar resultados no mobile quando já há busca feita mas dropdown fechou */}
      {hasSearchOrFilter && !dropdownOpen && (
        <div className="block sm:hidden pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDropdownOpen(true)}
            className="w-full min-h-[44px] text-xs text-indigo-700 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 flex items-center justify-center gap-1.5 font-semibold touch-manipulation"
          >
            <span>Ver resultados ({totalFound})</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Botão para abrir modal dedicado de seleção de O.S. no mobile (garante 100% de interação mesmo dentro do Dialog do Radix) */}
      <div className="block sm:hidden pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canEdit}
          onClick={() => setMobileModalOpen(true)}
          className="w-full min-h-[44px] text-xs font-bold text-indigo-700 border-indigo-300 bg-white hover:bg-indigo-50 flex items-center justify-center gap-1.5 shadow-2xs touch-manipulation"
        >
          <FileSpreadsheet className="h-4 w-4 text-indigo-600" />
          <span>Abrir Seleção de O.S. em Tela Cheia</span>
        </Button>
      </div>

      {/* Renderização Condicional via JS com useIsMobile:
          - No Mobile (isMobile === true): lista renderizada inline no fluxo normal do DOM (sem position: absolute),
            garantindo que toque, scroll e overflow em iOS Safari e dentro de Dialogs funcionem perfeitamente.
          - No Desktop (!isMobile): mantém exatamente o dropdown flutuante absoluto da v0.0.235. */}
      {dropdownOpen &&
        (isMobile ? (
          <div className="w-full pt-1">{renderResultsList(true)}</div>
        ) : (
          <div className="absolute z-30 left-3 right-3 top-full mt-1 bg-white border border-slate-300 rounded-md shadow-xl overflow-hidden divide-y divide-slate-100 max-h-72 flex flex-col">
            {renderResultsList(false)}
          </div>
        ))}

      {/* Modal Dedicado de Seleção no Mobile: Abre por cima de qualquer Dialog sem conflitos de pointer-events */}
      <Dialog open={mobileModalOpen} onOpenChange={setMobileModalOpen}>
        <DialogContent className="w-full max-w-full sm:max-w-lg p-0 gap-0 overflow-hidden max-h-[92vh] flex flex-col z-[60]">
          <DialogHeader className="px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
            <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Search className="h-4 w-4 text-indigo-600" />
              <span>Selecionar Ordem de Serviço</span>
            </DialogTitle>
          </DialogHeader>

          <div className="p-3 border-b border-slate-200 bg-white space-y-2.5 shrink-0">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
              <Input
                type="text"
                placeholder="Número da OS ou nome do cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 pl-9 text-xs bg-white text-slate-900 touch-manipulation"
              />
              {loading && (
                <Loader2 className="h-4 w-4 animate-spin absolute right-3 top-3 text-indigo-600" />
              )}
              {searchTerm && !loading && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('')
                    setResults([])
                  }}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center absolute right-0 top-0 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                  Técnico
                </label>
                <select
                  value={selectedTech}
                  onChange={(e) => setSelectedTech(e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 shadow-2xs touch-manipulation"
                >
                  <option value="all">Todos os técnicos</option>
                  {techOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                  Status
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 shadow-2xs touch-manipulation"
                >
                  <option value="all">Todos os status</option>
                  {OS_STATUS_LIST.map((cfg) => (
                    <option key={cfg.value} value={cfg.value}>
                      {cfg.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 p-2">
            {loading ? (
              <div className="py-8 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                <span>Buscando ordens de serviço...</span>
              </div>
            ) : results.length > 0 ? (
              results.map((os) => {
                const custName = getCustomerDisplayName(os.expand?.customer)
                const techName = os.expand?.technician?.name || 'Sem técnico'
                const equip = os.expand?.equipment_ref?.name || os.equipment || os.title || '—'
                return (
                  <div
                    key={os.id}
                    className="p-3 hover:bg-indigo-50/70 transition-colors flex items-center justify-between gap-3 border-b border-slate-100"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        handleSelectOs(os)
                        setMobileModalOpen(false)
                      }}
                      onPointerUp={(e) => {
                        e.preventDefault()
                        handleSelectOs(os)
                        setMobileModalOpen(false)
                      }}
                      className="min-w-0 flex-1 text-left bg-transparent border-0 p-0 cursor-pointer touch-manipulation"
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold font-mono text-slate-900 text-xs">
                          #{os.number}
                        </span>
                        <StatusBadge status={os.status} />
                        <span className="text-xs text-slate-800 font-semibold truncate max-w-[150px]">
                          {custName}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-1">
                        Equip: {equip} • Técnico: {techName}
                      </div>
                    </button>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        handleSelectOs(os)
                        setMobileModalOpen(false)
                      }}
                      onPointerUp={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleSelectOs(os)
                        setMobileModalOpen(false)
                      }}
                      className="shrink-0 min-h-[44px] px-3.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white touch-manipulation gap-1.5 shadow-xs"
                    >
                      <Link2 className="h-4 w-4" />
                      <span>Vincular</span>
                    </Button>
                  </div>
                )
              })
            ) : (
              <div className="py-8 text-center text-xs text-slate-500 flex flex-col items-center gap-1">
                <AlertCircle className="h-5 w-5 text-slate-400" />
                <span className="font-semibold text-slate-700">
                  {hasSearchOrFilter
                    ? 'Nenhuma O.S. encontrada para o filtro.'
                    : 'Digite um termo ou filtre acima para listar O.S.'}
                </span>
                <span className="text-[11px] text-slate-400">
                  Busque por número, cliente ou selecione status.
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="p-3 border-t border-slate-200 bg-slate-50 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMobileModalOpen(false)}
              className="w-full min-h-[44px] text-xs font-semibold"
            >
              Fechar Seleção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
