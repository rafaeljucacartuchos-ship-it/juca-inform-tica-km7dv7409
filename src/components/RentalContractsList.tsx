import { useState, useEffect } from 'react'
import {
  FileText,
  Search,
  Filter,
  Eye,
  Printer,
  Calendar,
  Building,
  CheckCircle2,
  Clock,
  Ban,
  ArrowRight,
  ExternalLink,
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
} from '@/components/ui/dialog'
import { formatBRL, formatCPP } from '@/lib/rental-contract-template'
import { updateRentalContract } from '@/services/rental'
import { useToast } from '@/hooks/use-toast'
import type { RentalContract, RentalContractStatus } from '@/types'

interface RentalContractsListProps {
  contracts: RentalContract[]
  onSelectContract: (contract: RentalContract) => void
  onOpenQuote: (quoteId: string) => void
  onReload: () => void
}

export function RentalContractsList({
  contracts,
  onSelectContract,
  onOpenQuote,
  onReload,
}: RentalContractsListProps) {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('todos')
  const [selectedContractModal, setSelectedContractModal] = useState<RentalContract | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  // Filtragem
  const filteredContracts = contracts.filter((c) => {
    if (statusFilter !== 'todos' && c.status !== statusFilter) return false
    if (!search.trim()) return true

    const term = search.toLowerCase()
    const num = c.numero.toLowerCase()
    const cliente = (c.locatario_dados?.nome || '').toLowerCase()
    const equip = (c.equipamento_dados?.nome || '').toLowerCase()
    const serial = (c.equipamento_dados?.serial || '').toLowerCase()

    return (
      num.includes(term) || cliente.includes(term) || equip.includes(term) || serial.includes(term)
    )
  })

  const getStatusBadge = (status: RentalContractStatus) => {
    switch (status) {
      case 'ativo':
        return (
          <Badge className="bg-emerald-600 text-white font-bold text-[10px] gap-1">
            <CheckCircle2 className="h-3 w-3" /> Ativo
          </Badge>
        )
      case 'rascunho':
        return (
          <Badge
            variant="outline"
            className="text-amber-700 bg-amber-50 border-amber-300 font-bold text-[10px] gap-1"
          >
            <Clock className="h-3 w-3" /> Rascunho
          </Badge>
        )
      case 'encerrado':
        return (
          <Badge
            variant="outline"
            className="text-slate-600 bg-slate-100 border-slate-300 font-bold text-[10px] gap-1"
          >
            <Ban className="h-3 w-3" /> Encerrado
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const handleChangeStatus = async (contractId: string, newStatus: RentalContractStatus) => {
    setUpdatingStatus(true)
    try {
      await updateRentalContract(contractId, { status: newStatus })
      toast({
        title: 'Status atualizado com sucesso!',
      })
      if (selectedContractModal && selectedContractModal.id === contractId) {
        setSelectedContractModal({
          ...selectedContractModal,
          status: newStatus,
        })
      }
      onReload()
    } catch {
      toast({
        title: 'Erro ao atualizar status',
        variant: 'destructive',
      })
    } finally {
      setUpdatingStatus(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* BARRA DE BUSCA E FILTROS */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número (CT-2025-001), cliente, impressora ou serial..."
            className="pl-9 h-9 text-xs bg-slate-50 border-slate-200"
          />
        </div>

        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-36 text-xs bg-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Status</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="rascunho">Rascunho</SelectItem>
              <SelectItem value="encerrado">Encerrado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* TABELA DE CONTRATOS */}
      {filteredContracts.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200 shadow-sm space-y-2">
          <FileText className="h-10 w-10 mx-auto text-slate-300" />
          <h3 className="font-bold text-slate-700 text-sm">Nenhum contrato encontrado</h3>
          <p className="text-xs text-slate-400">
            {contracts.length === 0
              ? 'Gere uma proposta no simulador e clique em "Gerar Contrato" para emitir o primeiro contrato.'
              : 'Tente alterar os termos da busca ou filtros acima.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Número</th>
                <th className="py-3 px-4">Cliente / Locatário</th>
                <th className="py-3 px-4">Impressora</th>
                <th className="py-3 px-4 text-center">Franquia</th>
                <th className="py-3 px-4 text-right">Valor Mensal</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredContracts.map((c) => {
                const locatario = c.locatario_dados?.nome || 'Cliente'
                const equip = c.equipamento_dados?.nome || 'Impressora'
                const serial = c.equipamento_dados?.serial

                return (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-indigo-700 text-sm block">
                        {c.numero}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(c.data_inicio || c.created || Date.now()).toLocaleDateString(
                          'pt-BR',
                        )}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block">{locatario}</span>
                      <span className="text-[10px] text-slate-500">
                        Doc: {c.locatario_dados?.cpf_cnpj || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-800 block">{equip}</span>
                      {serial && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          Serial: {serial}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-mono font-bold text-slate-800 text-xs">
                        {c.franquia_paginas.toLocaleString('pt-BR')} págs
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        Exced: {formatCPP(c.excesso_pagina_valor)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-mono font-black text-emerald-800 text-sm tabular-nums block">
                        {formatBRL(c.valor_mensal)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {c.contrato_meses || 12} meses
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">{getStatusBadge(c.status)}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedContractModal(c)}
                          className="h-8 text-xs font-semibold gap-1 text-slate-700 hover:text-indigo-600"
                        >
                          <Eye className="h-3.5 w-3.5" /> Resumo
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => onSelectContract(c)}
                          className="h-8 text-xs font-bold gap-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                          <Printer className="h-3.5 w-3.5" /> Contrato
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

      {/* MODAL DE RESUMO DO CONTRATO COM LINK PARA PROPOSTA */}
      <Dialog
        open={Boolean(selectedContractModal)}
        onOpenChange={(open) => !open && setSelectedContractModal(null)}
      >
        <DialogContent className="max-w-xl p-5">
          {selectedContractModal && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-indigo-600" />
                    <DialogTitle className="text-base font-bold text-slate-900">
                      Contrato #{selectedContractModal.numero}
                    </DialogTitle>
                  </div>
                  {getStatusBadge(selectedContractModal.status)}
                </div>
                <DialogDescription className="text-xs text-slate-500 pt-1">
                  Resumo dos dados congelados no momento da contratação e vínculo com a proposta de
                  origem.
                </DialogDescription>
              </DialogHeader>

              {/* DADOS CONGELADOS */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <strong className="text-slate-700 block">Locatário (Cliente):</strong>
                  <span className="font-bold text-slate-900 block">
                    {selectedContractModal.locatario_dados?.nome}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    CPF/CNPJ: {selectedContractModal.locatario_dados?.cpf_cnpj || '—'}
                  </span>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {selectedContractModal.locatario_dados?.endereco}
                  </p>
                </div>
                <div>
                  <strong className="text-slate-700 block">Equipamento Congelado:</strong>
                  <span className="font-bold text-slate-900 block">
                    {selectedContractModal.equipamento_dados?.nome}
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    Serial: {selectedContractModal.equipamento_dados?.serial || '—'}
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    Contador Inicial:{' '}
                    {selectedContractModal.equipamento_dados?.contador_inicial || 0} págs
                  </span>
                </div>
              </div>

              {/* VALORES E FRANQUIA */}
              <div className="grid grid-cols-3 gap-2 text-xs text-center">
                <div className="bg-indigo-50 p-2.5 rounded-lg border border-indigo-200">
                  <span className="text-[10px] text-indigo-700 block font-semibold">
                    Valor Mensal
                  </span>
                  <span className="text-sm font-black font-mono text-indigo-950">
                    {formatBRL(selectedContractModal.valor_mensal)}
                  </span>
                </div>
                <div className="bg-slate-100 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-600 block font-semibold">
                    Franquia Contratada
                  </span>
                  <span className="text-sm font-bold font-mono text-slate-900">
                    {selectedContractModal.franquia_paginas.toLocaleString('pt-BR')} págs
                  </span>
                </div>
                <div className="bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                  <span className="text-[10px] text-rose-700 block font-semibold">
                    Página Excedente
                  </span>
                  <span className="text-sm font-black font-mono text-rose-950">
                    {formatCPP(selectedContractModal.excesso_pagina_valor)}
                  </span>
                </div>
              </div>

              {/* VÍNCULO COM A PROPOSTA DE ORIGEM */}
              <div className="p-3 rounded-lg border border-indigo-200 bg-indigo-50/40 flex items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-bold text-indigo-950">Proposta / Precificação de Origem</p>
                  <p className="text-[11px] text-indigo-700">
                    ID da Proposta: {selectedContractModal.proposta}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const qId = selectedContractModal.proposta
                    setSelectedContractModal(null)
                    onOpenQuote(qId)
                  }}
                  className="h-8 text-xs font-semibold text-indigo-700 border-indigo-300 hover:bg-indigo-100 gap-1"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Abrir Proposta
                </Button>
              </div>

              {/* MUDANÇA DE STATUS RÁPIDA */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <span className="text-slate-600 font-medium">Alterar Status:</span>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={selectedContractModal.status === 'rascunho' ? 'default' : 'outline'}
                    onClick={() => handleChangeStatus(selectedContractModal.id, 'rascunho')}
                    disabled={updatingStatus}
                    className="h-7 text-[11px]"
                  >
                    Rascunho
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={selectedContractModal.status === 'ativo' ? 'default' : 'outline'}
                    onClick={() => handleChangeStatus(selectedContractModal.id, 'ativo')}
                    disabled={updatingStatus}
                    className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Ativar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={selectedContractModal.status === 'encerrado' ? 'default' : 'outline'}
                    onClick={() => handleChangeStatus(selectedContractModal.id, 'encerrado')}
                    disabled={updatingStatus}
                    className="h-7 text-[11px] text-slate-600"
                  >
                    Encerrar
                  </Button>
                </div>
              </div>

              {/* BOTÃO ABRIR CONTRATO INTEGRAL */}
              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedContractModal(null)}
                  className="text-xs"
                >
                  Fechar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    const c = selectedContractModal
                    setSelectedContractModal(null)
                    onSelectContract(c)
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5"
                >
                  <Printer className="h-4 w-4" /> Ver Contrato Completo / Imprimir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
