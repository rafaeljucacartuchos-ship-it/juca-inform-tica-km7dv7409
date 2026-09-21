import { useState, useMemo } from 'react'
import {
  Plus,
  Search,
  Filter,
  Layers,
  ArrowUpDown,
  Edit2,
  Trash2,
  Check,
  X,
  RefreshCw,
  TrendingUp,
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
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import type { SuprimentoRecord, TipoSuprimento } from '@/services/pricing-module'
import {
  createSuprimento,
  updateSuprimento,
  softDeleteSuprimento,
  batchUpdateSupplyPrices,
} from '@/services/pricing-module'
import { calculateSupplyCPP, formatCPP6 } from '@/lib/pricing-engine'
import { useToast } from '@/hooks/use-toast'

interface SuppliesManagementTabProps {
  supplies: SuprimentoRecord[]
  onReload: () => void
  readOnly?: boolean
}

export function SuppliesManagementTab({
  supplies,
  onReload,
  readOnly = false,
}: SuppliesManagementTabProps) {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterTipo, setFilterTipo] = useState<string>('todos')
  const [filterFabricante, setFilterFabricante] = useState<string>('todos')

  // Modal Novo / Edição
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSupply, setEditingSupply] = useState<SuprimentoRecord | null>(null)
  const [saving, setSaving] = useState(false)

  // Form states
  const [formModelo, setFormModelo] = useState('')
  const [formTipo, setFormTipo] = useState<TipoSuprimento>('toner')
  const [formFabricante, setFormFabricante] = useState('Brother')
  const [formFabricanteCustom, setFormFabricanteCustom] = useState('')
  const [formImpressoras, setFormImpressoras] = useState('')
  const [formValorCompra, setFormValorCompra] = useState('')
  const [formRendimento, setFormRendimento] = useState('')
  const [formFontePreco, setFormFontePreco] = useState('')
  const [formAtivo, setFormAtivo] = useState(true)

  // Modal de Reajuste em Lote (Seção 19.1)
  const [batchModalOpen, setBatchModalOpen] = useState(false)
  const [batchFabricante, setBatchFabricante] = useState('Brother')
  const [batchTipo, setBatchTipo] = useState<string>('toner')
  const [batchPercentual, setBatchPercentual] = useState('8.5')
  const [applyingBatch, setApplyingBatch] = useState(false)

  const fabricantesDisponiveis = useMemo(() => {
    const set = new Set<string>()
    supplies.forEach((s) => {
      if (s.fabricante) set.add(s.fabricante)
    })
    return Array.from(set).sort()
  }, [supplies])

  const filteredSupplies = useMemo(() => {
    return supplies.filter((s) => {
      if (!s.ativo) return false
      if (filterTipo !== 'todos' && s.tipo !== filterTipo) return false
      if (filterFabricante !== 'todos' && s.fabricante !== filterFabricante) return false
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim()
        const matchModelo = s.modelo_suprimento.toLowerCase().includes(term)
        const matchFab = s.fabricante.toLowerCase().includes(term)
        const matchComp = s.impressoras_compativeis?.toLowerCase().includes(term) || false
        if (!matchModelo && !matchFab && !matchComp) return false
      }
      return true
    })
  }, [supplies, searchTerm, filterTipo, filterFabricante])

  const handleOpenCreateModal = () => {
    setEditingSupply(null)
    setFormModelo('')
    setFormTipo('toner')
    setFormFabricante('Brother')
    setFormFabricanteCustom('')
    setFormImpressoras('')
    setFormValorCompra('')
    setFormRendimento('')
    setFormFontePreco('')
    setFormAtivo(true)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (sup: SuprimentoRecord) => {
    setEditingSupply(sup)
    setFormModelo(sup.modelo_suprimento)
    setFormTipo(sup.tipo)
    const knownFabs = [
      'Brother',
      'Epson',
      'HP',
      'Samsung',
      'Canon',
      'Kyocera',
      'Zebra',
      'Bematech',
      'Elgin',
      'Genérico',
    ]
    if (knownFabs.includes(sup.fabricante)) {
      setFormFabricante(sup.fabricante)
      setFormFabricanteCustom('')
    } else {
      setFormFabricante('Outro')
      setFormFabricanteCustom(sup.fabricante || '')
    }
    setFormImpressoras(sup.impressoras_compativeis || '')
    setFormValorCompra(
      sup.valor_compra !== null && sup.valor_compra !== undefined ? String(sup.valor_compra) : '',
    )
    setFormRendimento(
      sup.rendimento_paginas !== null && sup.rendimento_paginas !== undefined
        ? String(sup.rendimento_paginas)
        : '',
    )
    setFormFontePreco(sup.fonte_preco || '')
    setFormAtivo(sup.ativo !== false)
    setIsModalOpen(true)
  }

  const handleSaveSupply = async (e: React.FormEvent) => {
    e.preventDefault()
    const modeloTrim = formModelo.trim()
    if (!modeloTrim) {
      toast({ title: 'Descrição / Modelo do suprimento é obrigatório', variant: 'destructive' })
      return
    }

    const finalFabricante =
      formFabricante === 'Outro' ? formFabricanteCustom.trim() : formFabricante.trim()

    if (!finalFabricante) {
      toast({ title: 'Fabricante é obrigatório', variant: 'destructive' })
      return
    }

    // Validação de valor de compra (aceita vírgula ou ponto)
    let valorCompraNum: number | null = null
    const rawPreco = formValorCompra.trim().replace(',', '.')
    if (rawPreco !== '') {
      const parsed = parseFloat(rawPreco)
      if (isNaN(parsed) || parsed < 0) {
        toast({
          title: 'Valor de compra inválido',
          description: 'O valor de compra deve ser um número positivo ou zero.',
          variant: 'destructive',
        })
        return
      }
      valorCompraNum = Math.round(parsed * 100) / 100
    }

    // Validação de rendimento em páginas (inteiro positivo >= 1)
    let rendimentoNum: number | null = null
    const rawRend = formRendimento.trim()
    if (rawRend !== '') {
      const parsed = parseInt(rawRend, 10)
      if (isNaN(parsed) || parsed < 1 || !Number.isInteger(Number(rawRend))) {
        toast({
          title: 'Rendimento em páginas inválido',
          description:
            'O rendimento deve ser um número inteiro estritamente positivo (mínimo 1 pág).',
          variant: 'destructive',
        })
        return
      }
      rendimentoNum = parsed
    }

    setSaving(true)
    try {
      const payload: Partial<SuprimentoRecord> = {
        modelo_suprimento: modeloTrim,
        tipo: formTipo,
        fabricante: finalFabricante,
        impressoras_compativeis: formImpressoras.trim() || undefined,
        valor_compra: valorCompraNum,
        rendimento_paginas: rendimentoNum,
        fonte_preco: formFontePreco.trim() || undefined,
        ativo: formAtivo,
      }

      if (editingSupply) {
        await updateSuprimento(editingSupply.id, payload, editingSupply)
        toast({
          title: 'Suprimento atualizado com sucesso!',
          description: `Item ${modeloTrim} salvo e impressoras vinculadas recalculadas.`,
        })
      } else {
        await createSuprimento(payload)
        toast({
          title: 'Novo suprimento cadastrado com sucesso!',
          description: `Item ${modeloTrim} adicionado à base e disponível nos dropdowns dos 5 slots.`,
        })
      }

      setIsModalOpen(false)
      onReload()
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao salvar suprimento',
        description: err.message || 'Verifique se a descrição/modelo já está cadastrada.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Estado local para edições inline por suprimento
  // Guarda valores temporários digitados para feedback visual em tempo real e validações
  const [inlineValues, setInlineValues] = useState<
    Record<
      string,
      {
        modelo_suprimento?: string
        valor_compra?: string
        rendimento_paginas?: string
      }
    >
  >({})
  const [inlineSaving, setInlineSaving] = useState<Record<string, boolean>>({})

  // Obter valor efetivo (editado no input ou original do record)
  const getInlineVal = (
    sup: SuprimentoRecord,
    field: 'modelo_suprimento' | 'valor_compra' | 'rendimento_paginas',
  ): string => {
    const currentEdit = inlineValues[sup.id]?.[field]
    if (currentEdit !== undefined) return currentEdit

    if (field === 'modelo_suprimento') {
      return sup.modelo_suprimento || ''
    }
    if (field === 'valor_compra') {
      return sup.valor_compra !== null && sup.valor_compra !== undefined
        ? String(sup.valor_compra)
        : ''
    }
    if (field === 'rendimento_paginas') {
      return sup.rendimento_paginas !== null && sup.rendimento_paginas !== undefined
        ? String(sup.rendimento_paginas)
        : ''
    }
    return ''
  }

  const handleInlineInputChange = (
    supId: string,
    field: 'modelo_suprimento' | 'valor_compra' | 'rendimento_paginas',
    value: string,
  ) => {
    setInlineValues((prev) => ({
      ...prev,
      [supId]: {
        ...prev[supId],
        [field]: value,
      },
    }))
  }

  // Validação e persistência inline com recálculo em cascata e registro de auditoria
  const handleInlineBlurOrEnter = async (
    sup: SuprimentoRecord,
    field: 'modelo_suprimento' | 'valor_compra' | 'rendimento_paginas',
  ) => {
    const rawVal = getInlineVal(sup, field)
    let payloadValue: any = null

    // 1. Validação de Descrição / Modelo
    if (field === 'modelo_suprimento') {
      const trimmed = rawVal.trim()
      if (!trimmed) {
        toast({
          title: 'Descrição / Modelo obrigatório',
          description: 'A descrição do suprimento não pode ficar vazia.',
          variant: 'destructive',
        })
        // Reverte para o original
        setInlineValues((prev) => ({
          ...prev,
          [sup.id]: {
            ...prev[sup.id],
            modelo_suprimento: sup.modelo_suprimento,
          },
        }))
        return
      }

      // Se não mudou, nada a fazer
      if (trimmed === sup.modelo_suprimento) return
      payloadValue = trimmed
    }

    // 2. Validação de Valor de Compra
    if (field === 'valor_compra') {
      const trimmed = rawVal.trim().replace(',', '.')
      if (trimmed === '') {
        // Permitir deixar nulo/pendente
        payloadValue = null
      } else {
        const parsed = parseFloat(trimmed)
        if (isNaN(parsed) || parsed < 0) {
          toast({
            title: 'Valor de compra inválido',
            description: 'O valor de compra deve ser um número positivo ou zero.',
            variant: 'destructive',
          })
          setInlineValues((prev) => ({
            ...prev,
            [sup.id]: {
              ...prev[sup.id],
              valor_compra:
                sup.valor_compra !== null && sup.valor_compra !== undefined
                  ? String(sup.valor_compra)
                  : '',
            },
          }))
          return
        }
        payloadValue = Math.round(parsed * 100) / 100
      }

      // Se não mudou
      if (payloadValue === (sup.valor_compra ?? null)) return
    }

    // 3. Validação de Rendimento em Páginas
    if (field === 'rendimento_paginas') {
      const trimmed = rawVal.trim()
      if (trimmed === '') {
        payloadValue = null
      } else {
        const parsed = parseInt(trimmed, 10)
        if (isNaN(parsed) || parsed <= 0 || !Number.isInteger(Number(trimmed))) {
          toast({
            title: 'Rendimento em páginas inválido',
            description:
              'O rendimento deve ser um número inteiro estritamente positivo (mínimo 1 pág).',
            variant: 'destructive',
          })
          setInlineValues((prev) => ({
            ...prev,
            [sup.id]: {
              ...prev[sup.id],
              rendimento_paginas:
                sup.rendimento_paginas !== null && sup.rendimento_paginas !== undefined
                  ? String(sup.rendimento_paginas)
                  : '',
            },
          }))
          return
        }
        payloadValue = parsed
      }

      // Se não mudou
      if (payloadValue === (sup.rendimento_paginas ?? null)) return
    }

    // Persistir e acionar recálculo em cascata
    setInlineSaving((prev) => ({ ...prev, [sup.id]: true }))
    try {
      const updated = await updateSuprimento(sup.id, { [field]: payloadValue }, sup)
      const novoCpp = calculateSupplyCPP(updated.valor_compra, updated.rendimento_paginas)

      toast({
        title: 'Suprimento atualizado!',
        description: `${updated.modelo_suprimento}: CPP atualizado para ${formatCPP6(novoCpp)}. Impressoras vinculadas recalculadas em cascata.`,
      })

      // Limpa override do campo salvo
      setInlineValues((prev) => {
        const next = { ...prev }
        if (next[sup.id]) {
          delete next[sup.id][field]
        }
        return next
      })

      onReload()
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Falha ao salvar alteração inline',
        description: err.message || 'Verifique se o modelo não está duplicado.',
        variant: 'destructive',
      })
    } finally {
      setInlineSaving((prev) => ({ ...prev, [sup.id]: false }))
    }
  }

  const handleDelete = async (sup: SuprimentoRecord) => {
    if (
      confirm(
        `Deseja inativar o suprimento "${sup.modelo_suprimento}"? (Exclusão lógica preservando contratos)`,
      )
    ) {
      await softDeleteSuprimento(sup.id)
      toast({ title: 'Suprimento inativado com sucesso.' })
      onReload()
    }
  }

  const handleApplyBatchUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    const pct = parseFloat(batchPercentual)
    if (isNaN(pct)) return

    setApplyingBatch(true)
    try {
      const res = await batchUpdateSupplyPrices({
        fabricante: batchFabricante,
        tipo: (batchTipo === 'todos' ? '' : batchTipo) as any,
        percentualReajuste: pct,
      })
      toast({
        title: 'Reajuste em lote concluído!',
        description: `${res.totalAfetados} insumos atualizados com reajuste de ${pct >= 0 ? '+' : ''}${pct}%.`,
      })
      setBatchModalOpen(false)
      onReload()
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao aplicar reajuste em lote', variant: 'destructive' })
    } finally {
      setApplyingBatch(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* BARRA SUPERIOR DE AÇÕES & FILTROS */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código (ex: TN-1035, T544-BK, FA04061)..."
              className="h-9 text-xs pl-8 font-medium"
            />
          </div>

          <select
            value={filterFabricante}
            onChange={(e) => setFilterFabricante(e.target.value)}
            className="h-9 text-xs rounded-md border border-slate-300 bg-white px-2.5 text-slate-700"
          >
            <option value="todos">Todos os Fabricantes</option>
            {fabricantesDisponiveis.map((fab) => (
              <option key={fab} value={fab}>
                {fab}
              </option>
            ))}
          </select>

          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
            className="h-9 text-xs rounded-md border border-slate-300 bg-white px-2.5 text-slate-700"
          >
            <option value="todos">Todos os Tipos</option>
            <option value="toner">Toner</option>
            <option value="tinta">Tinta</option>
            <option value="cartucho">Cartucho</option>
            <option value="fotocondutor">Fotocondutor (Cilindro)</option>
            <option value="unidade_fusora">Unidade Fusora</option>
            <option value="pelicula">Película</option>
            <option value="cabecote">Cabeçote</option>
            <option value="bobina">Bobina</option>
            <option value="fita">Fita</option>
            <option value="ribbon">Ribbon</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          {!readOnly && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setBatchModalOpen(true)}
                className="text-xs font-semibold text-slate-700 border-slate-300 hover:border-indigo-500 gap-1.5"
              >
                <TrendingUp className="h-3.5 w-3.5 text-indigo-600" /> Reajuste em Lote
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={handleOpenCreateModal}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5"
              >
                <Plus className="h-4 w-4" /> Novo Suprimento
              </Button>
            </>
          )}
        </div>
      </div>

      {/* TABELA DE SUPRIMENTOS COM EDIÇÃO MANUAL (Regra 20.1) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[620px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] sticky top-0 z-10 border-b border-slate-200 shadow-sm">
              <tr>
                <th className="py-2.5 px-3 min-w-[170px]">Descrição / Modelo *</th>
                <th className="py-2.5 px-3">Tipo</th>
                <th className="py-2.5 px-3">Fabricante</th>
                <th className="py-2.5 px-3 min-w-[140px]">Valor Compra (R$) *</th>
                <th className="py-2.5 px-3 min-w-[130px]">Rendimento (pág) *</th>
                <th className="py-2.5 px-3 min-w-[130px]">CPP Calculado</th>
                <th className="py-2.5 px-3">Compatibilidade</th>
                <th className="py-2.5 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredSupplies.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Nenhum suprimento encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                filteredSupplies.map((sup) => {
                  const isItemSaving = !!inlineSaving[sup.id]

                  // Valores inline atuais
                  const curModelo = getInlineVal(sup, 'modelo_suprimento')
                  const curPrecoStr = getInlineVal(sup, 'valor_compra')
                  const curRendStr = getInlineVal(sup, 'rendimento_paginas')

                  const curPrecoNum =
                    curPrecoStr.trim() !== '' ? parseFloat(curPrecoStr) : (sup.valor_compra ?? null)
                  const curRendNum =
                    curRendStr.trim() !== ''
                      ? parseInt(curRendStr, 10)
                      : (sup.rendimento_paginas ?? null)

                  const hasPrice =
                    curPrecoNum !== null &&
                    curPrecoNum !== undefined &&
                    !isNaN(curPrecoNum) &&
                    curPrecoNum > 0
                  const hasYield =
                    curRendNum !== null &&
                    curRendNum !== undefined &&
                    !isNaN(curRendNum) &&
                    curRendNum > 0

                  // CPP dinâmico para preview instantâneo na UI
                  const liveCpp = calculateSupplyCPP(curPrecoNum, curRendNum)

                  return (
                    <tr
                      key={sup.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isItemSaving ? 'bg-indigo-50/40 opacity-70' : ''
                      }`}
                    >
                      {/* 1. DESCRIÇÃO / MODELO DO PRODUTO (Editável Inline) */}
                      <td className="py-1.5 px-3">
                        {readOnly ? (
                          <span className="font-bold text-slate-900">{sup.modelo_suprimento}</span>
                        ) : (
                          <div className="relative">
                            <input
                              type="text"
                              value={curModelo}
                              disabled={isItemSaving}
                              onChange={(e) =>
                                handleInlineInputChange(sup.id, 'modelo_suprimento', e.target.value)
                              }
                              onBlur={() => handleInlineBlurOrEnter(sup, 'modelo_suprimento')}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur()
                                }
                              }}
                              placeholder="Descrição obrigatória"
                              className={`h-7 w-full min-w-[140px] px-2 font-mono font-bold text-xs rounded border transition-colors ${
                                !curModelo.trim()
                                  ? 'border-rose-400 bg-rose-50 text-rose-900 ring-1 ring-rose-400'
                                  : 'border-slate-300 bg-white text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                              }`}
                              title="Pressione Enter ou clique fora para salvar"
                            />
                          </div>
                        )}
                      </td>

                      <td className="py-2 px-3">
                        <Badge variant="outline" className="text-[10px] capitalize bg-slate-50">
                          {sup.tipo}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-slate-600">{sup.fabricante}</td>

                      {/* 2. VALOR DE COMPRA (Editável Inline) */}
                      <td className="py-1 px-3">
                        {readOnly ? (
                          <span className="font-mono text-slate-900">
                            {hasPrice ? Number(sup.valor_compra).toFixed(2) : '—'}
                          </span>
                        ) : (
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              disabled={isItemSaving}
                              value={curPrecoStr}
                              onChange={(e) =>
                                handleInlineInputChange(sup.id, 'valor_compra', e.target.value)
                              }
                              onBlur={() => handleInlineBlurOrEnter(sup, 'valor_compra')}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur()
                                }
                              }}
                              placeholder="0.00"
                              className={`h-7 w-28 text-right px-2 font-mono text-xs rounded border transition-colors ${
                                !hasPrice
                                  ? 'border-amber-400 bg-amber-50 text-amber-900 font-semibold'
                                  : 'border-slate-300 bg-white text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                              }`}
                              title={
                                !hasPrice
                                  ? 'Preencher valor de compra (pendente)'
                                  : 'Pressione Enter ou clique fora para salvar'
                              }
                            />
                          </div>
                        )}
                      </td>

                      {/* 3. RENDIMENTO PÁGINAS (Editável Inline - Inteiro Positivo) */}
                      <td className="py-1 px-3">
                        {readOnly ? (
                          <span className="font-mono text-slate-800">
                            {hasYield ? sup.rendimento_paginas : '—'}
                          </span>
                        ) : (
                          <div className="relative">
                            <input
                              type="number"
                              step="100"
                              min="1"
                              disabled={isItemSaving}
                              value={curRendStr}
                              onChange={(e) =>
                                handleInlineInputChange(
                                  sup.id,
                                  'rendimento_paginas',
                                  e.target.value,
                                )
                              }
                              onBlur={() => handleInlineBlurOrEnter(sup, 'rendimento_paginas')}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur()
                                }
                              }}
                              placeholder="1000"
                              className={`h-7 w-24 text-right px-2 font-mono text-xs rounded border transition-colors ${
                                !hasYield
                                  ? 'border-amber-400 bg-amber-50 text-amber-900 font-semibold'
                                  : 'border-slate-300 bg-white text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                              }`}
                              title={
                                !hasYield
                                  ? 'Preencher rendimento em páginas (pendente)'
                                  : 'Pressione Enter ou clique fora para salvar'
                              }
                            />
                          </div>
                        )}
                      </td>

                      {/* CPP CALCULADO (6 CASAS DECIMAIS - RECÁLCULO AUTOMÁTICO EM CASCATA) */}
                      <td className="py-2 px-3 font-mono font-bold text-indigo-950">
                        {hasPrice && hasYield ? (
                          <div className="flex items-center gap-1">
                            <span>{formatCPP6(liveCpp)}</span>
                            {isItemSaving && (
                              <RefreshCw className="h-3 w-3 text-indigo-500 animate-spin" />
                            )}
                          </div>
                        ) : (
                          <span className="text-amber-600 font-semibold text-[11px]">Pendente</span>
                        )}
                      </td>

                      <td
                        className="py-2 px-3 text-slate-500 max-w-[200px] truncate text-[11px]"
                        title={sup.impressoras_compativeis}
                      >
                        {sup.impressoras_compativeis || '—'}
                      </td>

                      {/* AÇÕES */}
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(sup)}
                            className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-100"
                            title="Editar todos os campos"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() => handleDelete(sup)}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              title="Inativar (exclusão lógica)"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-slate-50 border-t border-slate-200 text-slate-500 text-[11px] flex items-center justify-between">
          <span>
            Exibindo <strong>{filteredSupplies.length}</strong> de {supplies.length} suprimentos
            cadastrados
          </span>
          <span className="font-mono text-indigo-900 font-semibold">
            cpp_calculado = valor_compra / rendimento_paginas (persistido com 6 casas decimais)
          </span>
        </div>
      </div>

      {/* MODAL NOVO / EDITAR SUPRIMENTO COM TODOS OS CAMPOS DO SCHEMA */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-xl p-5 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-600" />
              <span>
                {editingSupply
                  ? `Editar Suprimento: ${editingSupply.modelo_suprimento}`
                  : 'Cadastrar Novo Suprimento'}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Preencha todas as informações da tabela <code>suprimentos</code>. Descrição, Tipo e
              Fabricante são obrigatórios. Valor de compra e rendimento são necessários para
              calcular o CPP e desbloquear precificação.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveSupply} className="space-y-4 py-2 text-xs">
            {/* Bloco 1: Identificação Básica */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
              <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wide block">
                1. Identificação do Suprimento / Peça
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Descrição do Produto / Modelo *</span>
                    <span className="text-[10px] text-rose-600 font-bold">Obrigatório</span>
                  </Label>
                  <Input
                    value={formModelo}
                    onChange={(e) => setFormModelo(e.target.value)}
                    placeholder="Ex: TN-1035, T544-BK, DR-1035, CAB-FA04061"
                    required
                    className="h-8 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-400">
                    Part number, código ou descrição comercial única na base
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Tipo de Suprimento *</span>
                    <span className="text-[10px] text-rose-600 font-bold">Obrigatório</span>
                  </Label>
                  <select
                    value={formTipo}
                    onChange={(e) => setFormTipo(e.target.value as TipoSuprimento)}
                    className="w-full h-8 text-xs rounded-md border border-slate-300 bg-white px-2 font-medium"
                  >
                    <option value="toner">Toner (Laser)</option>
                    <option value="tinta">Tinta (Tanque / Garrafa)</option>
                    <option value="cartucho">Cartucho (Jato / Monocromático / Color)</option>
                    <option value="fotocondutor">Fotocondutor / Cilindro (Drum)</option>
                    <option value="unidade_fusora">Unidade Fusora</option>
                    <option value="pelicula">Película de Fusão</option>
                    <option value="cabecote">Cabeçote de Impressão</option>
                    <option value="bobina">Bobina Térmica</option>
                    <option value="fita">Fita Matricial</option>
                    <option value="ribbon">Ribbon Transferência Térmica</option>
                  </select>
                  <p className="text-[10px] text-slate-400">
                    Define a categoria no mapeamento dos 5 slots
                  </p>
                </div>
              </div>

              {/* Fabricante com select de marcas conhecidas + opção Outro com texto */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Fabricante / Marca *</span>
                    <span className="text-[10px] text-rose-600 font-bold">Obrigatório</span>
                  </Label>
                  <select
                    value={formFabricante}
                    onChange={(e) => setFormFabricante(e.target.value)}
                    className="w-full h-8 text-xs rounded-md border border-slate-300 bg-white px-2 font-medium"
                  >
                    <option value="Brother">Brother</option>
                    <option value="Epson">Epson</option>
                    <option value="HP">HP</option>
                    <option value="Samsung">Samsung</option>
                    <option value="Canon">Canon</option>
                    <option value="Kyocera">Kyocera</option>
                    <option value="Zebra">Zebra</option>
                    <option value="Bematech">Bematech</option>
                    <option value="Elgin">Elgin</option>
                    <option value="Genérico">Genérico / Compatível</option>
                    <option value="Outro">Outro fabricante (digitar)...</option>
                  </select>
                </div>

                {formFabricante === 'Outro' && (
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">
                      Nome do Fabricante *
                    </Label>
                    <Input
                      value={formFabricanteCustom}
                      onChange={(e) => setFormFabricanteCustom(e.target.value)}
                      placeholder="Ex: Lexmark, Ricoh, Xerox"
                      required
                      className="h-8 text-xs"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Bloco 2: Valores & Rendimento (CPP) */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
              <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wide block">
                2. Custos & Rendimento em Páginas (Cálculo do CPP)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Valor de Compra (R$) *</span>
                    <span className="text-[10px] text-amber-600 font-medium">
                      Aceita vírgula ou ponto
                    </span>
                  </Label>
                  <Input
                    type="text"
                    value={formValorCompra}
                    onChange={(e) => setFormValorCompra(e.target.value)}
                    placeholder="Ex: 49,90 ou 49.90"
                    className="h-8 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-400">
                    Custo de aquisição NF. Obrigatório para desbloquear cálculo da proposta.
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Rendimento (páginas) *</span>
                    <span className="text-[10px] text-amber-600 font-medium">Inteiro ≥ 1</span>
                  </Label>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    value={formRendimento}
                    onChange={(e) => setFormRendimento(e.target.value)}
                    placeholder="Ex: 1000, 2600, 10000"
                    className="h-8 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-400">
                    Páginas estimadas no padrão 5% ISO/IEC.
                  </p>
                </div>
              </div>

              {/* Preview Dinâmico do CPP calculado */}
              <div className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-md flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-indigo-900 block">
                    CPP Unitário Estimado:
                  </span>
                  <span className="text-[10px] text-indigo-700">
                    cpp_calculado = valor_compra / rendimento_paginas
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-extrabold text-xs text-indigo-950">
                    {(() => {
                      const v = parseFloat(formValorCompra.trim().replace(',', '.'))
                      const r = parseInt(formRendimento.trim(), 10)
                      if (!isNaN(v) && v > 0 && !isNaN(r) && r > 0) {
                        return formatCPP6(calculateSupplyCPP(v, r))
                      }
                      return 'Pendente (R$ 0,000000)'
                    })()}
                  </span>
                </div>
              </div>
            </div>

            {/* Bloco 3: Compatibilidade & Homologação */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
              <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wide block">
                3. Compatibilidade, Homologação & Observações
              </span>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">
                  Modelos de Impressoras Compatíveis
                </Label>
                <Input
                  value={formImpressoras}
                  onChange={(e) => setFormImpressoras(e.target.value)}
                  placeholder="Ex: HL-1210W, HL-1212w, DCP-1617NW, DCP-L2540DW (separados por vírgula)"
                  className="h-8 text-xs"
                />
                <p className="text-[10px] text-slate-400">
                  Modelos onde este suprimento aparece destacado como &quot;⭐ Compatíveis com
                  [modelo]&quot; nos 5 slots do simulador
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">
                    Fonte do Preço / Homologação
                  </Label>
                  <Input
                    value={formFontePreco}
                    onChange={(e) => setFormFontePreco(e.target.value)}
                    placeholder="Ex: Tabela Homologada / NF 1234 / Cotação Distribuidor"
                    className="h-8 text-xs"
                  />
                  <p className="text-[10px] text-slate-400">
                    Origem do custo para histórico de auditoria
                  </p>
                </div>

                <div className="space-y-1 flex flex-col justify-end">
                  <div className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200 h-8">
                    <input
                      type="checkbox"
                      id="check-form-ativo"
                      checked={formAtivo}
                      onChange={(e) => setFormAtivo(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                    />
                    <Label
                      htmlFor="check-form-ativo"
                      className="text-xs font-semibold text-slate-800 cursor-pointer"
                    >
                      Suprimento Ativo na Base
                    </Label>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Inativos são ocultados nos dropdowns mas preservam contratos
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5"
              >
                {saving ? (
                  'Salvando...'
                ) : editingSupply ? (
                  'Salvar Alterações do Suprimento'
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    <span>Cadastrar Suprimento</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL DE REAJUSTE EM LOTE (Seção 19.1) */}
      <Dialog open={batchModalOpen} onOpenChange={setBatchModalOpen}>
        <DialogContent className="max-w-md p-5 text-xs">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-600" />
              <span>Reajuste em Lote de Suprimentos</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Aplica percentual de correção monetária sobre todos os suprimentos do grupo
              selecionado.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleApplyBatchUpdate} className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Fabricante Alvo</Label>
              <select
                value={batchFabricante}
                onChange={(e) => setBatchFabricante(e.target.value)}
                className="w-full h-8 text-xs rounded-md border border-slate-300 bg-white px-2"
              >
                <option value="todos">Todos os Fabricantes</option>
                {fabricantesDisponiveis.map((fab) => (
                  <option key={fab} value={fab}>
                    {fab}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Tipo de Suprimento</Label>
              <select
                value={batchTipo}
                onChange={(e) => setBatchTipo(e.target.value)}
                className="w-full h-8 text-xs rounded-md border border-slate-300 bg-white px-2"
              >
                <option value="todos">Todos os Tipos</option>
                <option value="toner">Toners</option>
                <option value="tinta">Tintas</option>
                <option value="cartucho">Cartuchos</option>
                <option value="fotocondutor">Fotocondutores</option>
                <option value="unidade_fusora">Unidades Fusoras</option>
                <option value="pelicula">Películas</option>
                <option value="cabecote">Cabeçotes</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">
                Percentual de Reajuste (%)
              </Label>
              <Input
                type="number"
                step="0.1"
                value={batchPercentual}
                onChange={(e) => setBatchPercentual(e.target.value)}
                placeholder="Ex: 8.5 (+8.5%) ou -5 (-5%)"
                required
                className="h-8 text-xs font-mono font-bold"
              />
              <p className="text-[10px] text-slate-400">
                Instrução atômica: valor_compra = valor_compra × (1 + % / 100)
              </p>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setBatchModalOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={applyingBatch}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
              >
                {applyingBatch ? 'Aplicando Reajuste...' : 'Confirmar Reajuste em Lote'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
