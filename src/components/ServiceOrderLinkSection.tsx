import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Search, X, User, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/StatusBadge'
import { ServiceOrder, User as AppUser, OrderStatus } from '@/types'
import { getServiceOrders } from '@/services/service_orders'
import { getCustomerDisplayName } from '@/services/customers'
import { STATUS_CONFIG as OS_STATUS_LIST } from '@/lib/dashboard-utils'

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

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
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
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onUnlinkOs}
                className="h-8 text-xs text-rose-600 border-rose-300 hover:bg-rose-50 hover:text-rose-700 font-semibold gap-1"
                title="Desvincular Ordem de Serviço deste orçamento"
              >
                <X className="h-3.5 w-3.5" />
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
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
        {/* Campo de Busca Livre (Número ou Cliente) */}
        <div className="sm:col-span-6 relative">
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
            Buscar O.S. (Nº ou Cliente)
          </label>
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-400" />
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
              className="h-8 pl-8 text-xs bg-white"
            />
            {loading && (
              <Loader2 className="h-3.5 w-3.5 animate-spin absolute right-2.5 top-2.5 text-indigo-600" />
            )}
            {searchTerm && !loading && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('')
                  setResults([])
                }}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
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
            className="w-full h-8 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
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
            className="w-full h-8 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
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

      {/* Dropdown com os Resultados da Busca */}
      {dropdownOpen && (
        <div className="absolute z-30 left-3 right-3 top-full mt-1 bg-white border border-slate-300 rounded-md shadow-xl overflow-hidden divide-y divide-slate-100 max-h-72 flex flex-col">
          <div className="p-2 bg-slate-100 text-[11px] font-semibold text-slate-700 flex items-center justify-between">
            <span>
              {loading
                ? 'Buscando ordens de serviço...'
                : totalFound === 0
                  ? 'Nenhuma ordem de serviço encontrada com os critérios informados'
                  : `Encontradas ${totalFound} O.S. (mostrando até 15):`}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDropdownOpen(false)}
              className="h-5 px-1.5 text-[10px] text-slate-500 hover:text-slate-800"
            >
              Fechar
            </Button>
          </div>

          <div className="overflow-y-auto divide-y divide-slate-100 max-h-60">
            {results.length > 0 ? (
              results.map((os) => {
                const custName = getCustomerDisplayName(os.expand?.customer)
                const techName = os.expand?.technician?.name || 'Sem técnico'
                const equip = os.expand?.equipment_ref?.name || os.equipment || os.title || '—'
                return (
                  <button
                    key={os.id}
                    type="button"
                    onClick={() => {
                      onSelectOs(os)
                      setDropdownOpen(false)
                      setSearchTerm('')
                    }}
                    className="w-full text-left p-2.5 hover:bg-indigo-50/80 transition-colors flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold font-mono text-slate-900 text-xs group-hover:text-indigo-600">
                          #{os.number}
                        </span>
                        <StatusBadge status={os.status} />
                        <span className="text-[11px] text-slate-600 font-semibold truncate">
                          {custName}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        <span>Equipamento: {equip}</span> • <span>Técnico: {techName}</span>
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className="shrink-0 text-[10px] bg-white border-indigo-300 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white transition-colors"
                    >
                      Vincular O.S.
                    </Badge>
                  </button>
                )
              })
            ) : !loading ? (
              <div className="p-4 text-center text-xs text-slate-500 flex flex-col items-center gap-1">
                <AlertCircle className="h-4 w-4 text-slate-400" />
                <span>Nenhuma O.S. encontrada para o termo ou filtro selecionado.</span>
                <span className="text-[10px] text-slate-400">
                  Tente alterar o técnico ou o status da busca acima.
                </span>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
