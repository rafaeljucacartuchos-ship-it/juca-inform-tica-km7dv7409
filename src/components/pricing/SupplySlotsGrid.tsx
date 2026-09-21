import { useState, useMemo } from 'react'
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Wrench,
  Ban,
  ExternalLink,
  ChevronDown,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import type { ImpressoraRecord, SuprimentoRecord } from '@/services/pricing-module'
import type { EnrichedSupplySlot, SlotVisualStatus } from '@/lib/pricing-engine'

interface SupplySlotsGridProps {
  slots: EnrichedSupplySlot[]
  allSupplies: SuprimentoRecord[]
  readOnly?: boolean
  onUpdateSlotSupply?: (slotNumber: 1 | 2 | 3 | 4 | 5, supplyId: string | null) => void
  onUpdateSlotValues?: (
    slotNumber: 1 | 2 | 3 | 4 | 5,
    price: number | null,
    yieldPages: number | null,
  ) => void
  onOpenSupplyEditModal?: (supplyModel: string) => void
}

export function SupplySlotsGrid({
  slots,
  allSupplies,
  readOnly = false,
  onUpdateSlotSupply,
  onUpdateSlotValues,
  onOpenSupplyEditModal,
}: SupplySlotsGridProps) {
  // Modal de seleção / troca de suprimento para um slot
  const [activeSlotToChange, setActiveSlotToChange] = useState<1 | 2 | 3 | 4 | 5 | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  // Modal com detalhes / histórico do suprimento
  const [detailModalSupply, setDetailModalSupply] = useState<EnrichedSupplySlot | null>(null)

  const filteredSupplies = useMemo(() => {
    if (!searchTerm.trim()) return allSupplies
    const term = searchTerm.toLowerCase().trim()
    return allSupplies.filter(
      (s) =>
        s.modelo_suprimento.toLowerCase().includes(term) ||
        s.fabricante.toLowerCase().includes(term) ||
        s.tipo.toLowerCase().includes(term),
    )
  }, [allSupplies, searchTerm])

  const getSlotHeaderLabel = (index: number) => {
    switch (index) {
      case 1:
        return 'Slot 1 (Toner / Tinta BK)'
      case 2:
        return 'Slot 2 (Drum / Tinta C)'
      case 3:
        return 'Slot 3 (Fusor / Tinta M)'
      case 4:
        return 'Slot 4 (Película / Tinta Y)'
      case 5:
        return 'Slot 5 (Cabeçote / Peça)'
      default:
        return `Slot ${index}`
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-indigo-600" />
          <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wide">
            Árvore de Suprimentos & Manutenção Vinculados (5 Slots)
          </h3>
        </div>
        <span className="text-[10px] text-slate-500 font-medium">
          Verde: Completo | Amarelo: Risco Epson | Cinza: Integrado | Vermelho: Pendente |
          Tracejado: Vazio
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {slots.map((slot) => {
          const { visualStatus } = slot

          // ESTILOS VISUAIS CONFORME SEÇÃO 15.3
          let borderBgClass = 'border-slate-200 bg-white'
          let badgeVariantClass = 'bg-slate-100 text-slate-700'
          let statusIcon = null

          if (visualStatus === 'complete') {
            borderBgClass = 'border-emerald-300 bg-emerald-50/40 hover:border-emerald-500'
            badgeVariantClass = 'bg-emerald-100 text-emerald-800'
            statusIcon = <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          } else if (visualStatus === 'provision_risk') {
            borderBgClass = 'border-amber-300 bg-amber-50/50 hover:border-amber-500'
            badgeVariantClass = 'bg-amber-100 text-amber-900 font-bold'
            statusIcon = <AlertTriangle className="h-3.5 w-3.5 text-amber-600 animate-pulse" />
          } else if (visualStatus === 'integrated') {
            borderBgClass = 'border-slate-300 bg-slate-100/70 text-slate-500'
            badgeVariantClass = 'bg-slate-200 text-slate-600'
            statusIcon = <Wrench className="h-3.5 w-3.5 text-slate-500" />
          } else if (visualStatus === 'missing_price') {
            borderBgClass = 'border-rose-400 bg-rose-50/60 hover:border-rose-600'
            badgeVariantClass = 'bg-rose-100 text-rose-800 font-bold'
            statusIcon = <Ban className="h-3.5 w-3.5 text-rose-600" />
          } else if (visualStatus === 'empty') {
            borderBgClass = 'border-2 border-dashed border-slate-300 bg-slate-50/50 text-slate-400'
            badgeVariantClass = 'bg-slate-100 text-slate-500'
          }

          return (
            <div
              key={slot.slotNumber}
              className={`rounded-xl border p-3 flex flex-col justify-between transition-all min-h-[175px] text-xs shadow-sm ${borderBgClass}`}
            >
              {/* Topo do Card */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold uppercase tracking-wider text-slate-600">
                    {getSlotHeaderLabel(slot.slotNumber)}
                  </span>
                  {statusIcon}
                </div>

                {visualStatus === 'empty' ? (
                  <div className="py-4 text-center space-y-1">
                    <p className="font-semibold text-slate-500 text-[11px]">
                      Não Aplicável / Vazio
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono">CPP = R$ 0,000000</p>
                    {!readOnly && onUpdateSlotSupply && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSearchTerm('')
                          setActiveSlotToChange(slot.slotNumber)
                        }}
                        className="h-6 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 p-0"
                      >
                        + Vincular Insumo
                      </Button>
                    )}
                  </div>
                ) : visualStatus === 'integrated' ? (
                  <div className="py-3 text-center space-y-1">
                    <Badge variant="outline" className="text-[10px] bg-slate-200/80 text-slate-700">
                      Chassi Integrado
                    </Badge>
                    <p className="text-[11px] font-bold text-slate-700">Fusor Integrado</p>
                    <p className="text-[10px] text-slate-500">
                      Amortização transferida ao ativo da impressora
                    </p>
                    <p className="text-[10px] font-mono font-bold text-slate-600">
                      CPP = R$ 0,000000
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <button
                          type="button"
                          onClick={() => setDetailModalSupply(slot)}
                          className="font-extrabold text-slate-900 text-xs hover:text-indigo-600 text-left flex items-center gap-1 group"
                          title="Clique para ver detalhes do suprimento"
                        >
                          <span>{slot.modelo}</span>
                          <ExternalLink className="h-2.5 w-2.5 text-slate-400 group-hover:text-indigo-600" />
                        </button>
                        <p className="text-[10px] text-slate-500 capitalize">
                          {slot.tipo} • {slot.fabricante || '—'}
                        </p>
                      </div>

                      <Badge className={`text-[9px] px-1.5 py-0 uppercase ${badgeVariantClass}`}>
                        {slot.tipo}
                      </Badge>
                    </div>

                    {/* Alerta de Provisão Epson (Seção 4.2 / 15.3) */}
                    {visualStatus === 'provision_risk' && (
                      <div className="bg-amber-100/90 text-amber-950 p-1.5 rounded text-[10px] font-medium leading-tight border border-amber-300">
                        <strong>Provisão de Reparo:</strong> Baixos volumes elevam taxa de sinistro
                        por ressecamento de micropiezos.
                      </div>
                    )}

                    {/* Inputs de Edição Inline no Card (Seção 20) */}
                    <div className="pt-1.5 space-y-1 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-[10px]">Compra (R$):</span>
                        {readOnly || !onUpdateSlotValues ? (
                          <span className="font-mono font-bold text-slate-900">
                            {slot.valorCompra !== null && slot.valorCompra !== undefined
                              ? Number(slot.valorCompra).toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })
                              : '—'}
                          </span>
                        ) : (
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={slot.valorCompra ?? ''}
                            placeholder="preencher"
                            onChange={(e) => {
                              const val =
                                e.target.value.trim() === '' ? null : parseFloat(e.target.value)
                              onUpdateSlotValues(slot.slotNumber, val, slot.rendimentoPaginas)
                            }}
                            className={`h-6 text-[11px] font-mono text-right w-20 px-1 ${
                              visualStatus === 'missing_price'
                                ? 'border-rose-400 bg-rose-50 text-rose-900'
                                : ''
                            }`}
                          />
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-[10px]">Rendimento:</span>
                        {readOnly || !onUpdateSlotValues ? (
                          <span className="font-mono text-slate-800">
                            {slot.rendimentoPaginas
                              ? `${slot.rendimentoPaginas.toLocaleString('pt-BR')} pág`
                              : '—'}
                          </span>
                        ) : (
                          <Input
                            type="number"
                            step="100"
                            min="1"
                            value={slot.rendimentoPaginas ?? ''}
                            placeholder="preencher"
                            onChange={(e) => {
                              const val =
                                e.target.value.trim() === '' ? null : parseInt(e.target.value, 10)
                              onUpdateSlotValues(slot.slotNumber, slot.valorCompra, val)
                            }}
                            className={`h-6 text-[11px] font-mono text-right w-20 px-1 ${
                              visualStatus === 'missing_price'
                                ? 'border-rose-400 bg-rose-50 text-rose-900'
                                : ''
                            }`}
                          />
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Rodapé do Card com CPP Calculado com 6 Casas Decimais */}
              {visualStatus !== 'empty' && visualStatus !== 'integrated' && (
                <div className="pt-2 mt-2 border-t border-slate-200/80">
                  {visualStatus === 'missing_price' ? (
                    <div className="space-y-1">
                      <p className="text-[10px] text-rose-700 font-bold">
                        Preço ou rendimento pendente!
                      </p>
                      {onOpenSupplyEditModal && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => onOpenSupplyEditModal(slot.modelo)}
                          className="h-6 w-full text-[10px] font-bold py-0"
                        >
                          Cadastrar Preço de Aquisição
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase">
                        CPP Unitário:
                      </span>
                      <span className="font-mono font-extrabold text-indigo-950 text-xs">
                        R${' '}
                        {slot.cppCalculado.toLocaleString('pt-BR', {
                          minimumFractionDigits: 6,
                          maximumFractionDigits: 6,
                        })}
                      </span>
                    </div>
                  )}

                  {!readOnly && onUpdateSlotSupply && (
                    <div className="mt-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setSearchTerm('')
                          setActiveSlotToChange(slot.slotNumber)
                        }}
                        className="text-[9px] text-slate-500 hover:text-indigo-600 underline"
                      >
                        Trocar Insumo
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* MODAL DE SELEÇÃO / TROCA DE SUPRIMENTO */}
      <Dialog
        open={activeSlotToChange !== null}
        onOpenChange={(open) => !open && setActiveSlotToChange(null)}
      >
        <DialogContent className="max-w-md p-5">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-900">
              Vincular Suprimento — Slot {activeSlotToChange}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Escolha um insumo cadastrado na base ou limpe o slot.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por código, tipo ou fabricante..."
                className="h-8 text-xs pl-8"
                autoFocus
              />
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border rounded-md">
              <button
                type="button"
                onClick={() => {
                  if (activeSlotToChange && onUpdateSlotSupply) {
                    onUpdateSlotSupply(activeSlotToChange, null)
                  }
                  setActiveSlotToChange(null)
                }}
                className="w-full text-left p-2.5 text-xs hover:bg-rose-50 text-rose-700 font-semibold flex items-center justify-between"
              >
                <span>[ Deixar Slot Vazio / Não Aplicável ]</span>
                <span className="text-[10px] font-mono">CPP R$ 0,000000</span>
              </button>

              {filteredSupplies.map((sup) => {
                const cpp =
                  sup.valor_compra && sup.rendimento_paginas
                    ? sup.valor_compra / sup.rendimento_paginas
                    : 0
                return (
                  <button
                    key={sup.id}
                    type="button"
                    onClick={() => {
                      if (activeSlotToChange && onUpdateSlotSupply) {
                        onUpdateSlotSupply(activeSlotToChange, sup.id)
                      }
                      setActiveSlotToChange(null)
                    }}
                    className="w-full text-left p-2 text-xs hover:bg-indigo-50 flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-bold text-slate-900 group-hover:text-indigo-700">
                        {sup.modelo_suprimento}
                      </div>
                      <div className="text-[10px] text-slate-500 capitalize">
                        {sup.tipo} • {sup.fabricante}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-indigo-900 text-xs">
                        {cpp > 0
                          ? `R$ ${cpp.toLocaleString('pt-BR', { minimumFractionDigits: 6, maximumFractionDigits: 6 })}`
                          : 'Sem preço'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {sup.rendimento_paginas
                          ? `${sup.rendimento_paginas.toLocaleString('pt-BR')} pág`
                          : '—'}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL DETALHE DO SUPRIMENTO CLICADO (Seção 15.3) */}
      <Dialog
        open={detailModalSupply !== null}
        onOpenChange={(open) => !open && setDetailModalSupply(null)}
      >
        <DialogContent className="max-w-md p-5 text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-600" />
              <span>Detalhes do Insumo: {detailModalSupply?.modelo}</span>
            </DialogTitle>
          </DialogHeader>

          {detailModalSupply && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border space-y-1 text-slate-700">
                <p>
                  <strong>Modelo:</strong> {detailModalSupply.modelo}
                </p>
                <p className="capitalize">
                  <strong>Tipo:</strong> {detailModalSupply.tipo}
                </p>
                <p>
                  <strong>Fabricante:</strong> {detailModalSupply.fabricante || '—'}
                </p>
                <p>
                  <strong>Valor de Aquisição (Compra):</strong>{' '}
                  <span className="font-mono font-bold text-slate-900">
                    {detailModalSupply.valorCompra
                      ? Number(detailModalSupply.valorCompra).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })
                      : 'Pendente de homologação'}
                  </span>
                </p>
                <p>
                  <strong>Rendimento Estimado:</strong>{' '}
                  <span className="font-mono">
                    {detailModalSupply.rendimentoPaginas
                      ? `${detailModalSupply.rendimentoPaginas.toLocaleString('pt-BR')} páginas`
                      : '—'}
                  </span>
                </p>
                <p>
                  <strong>CPP Calculado (Unitário):</strong>{' '}
                  <span className="font-mono font-black text-indigo-900 text-xs">
                    R${' '}
                    {detailModalSupply.cppCalculado.toLocaleString('pt-BR', {
                      minimumFractionDigits: 6,
                      maximumFractionDigits: 6,
                    })}
                  </span>
                </p>
              </div>

              {detailModalSupply.isProvision && (
                <div className="p-2.5 bg-amber-50 rounded border border-amber-300 text-amber-900 text-[11px]">
                  <strong>Aviso Operacional de Risco:</strong> Este cabeçote piezoelétrico Epson é
                  classificado como provisão de reparo. Cláusula contratual de inatividade
                  prolongada (&gt;15 dias) deve ser informada ao locatário.
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
