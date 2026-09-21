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
  const [formImpressoras, setFormImpressoras] = useState('')
  const [formValorCompra, setFormValorCompra] = useState('')
  const [formRendimento, setFormRendimento] = useState('')
  const [formFontePreco, setFormFontePreco] = useState('')

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
    setFormImpressoras('')
    setFormValorCompra('')
    setFormRendimento('')
    setFormFontePreco('')
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (sup: SuprimentoRecord) => {
    setEditingSupply(sup)
    setFormModelo(sup.modelo_suprimento)
    setFormTipo(sup.tipo)
    setFormFabricante(sup.fabricante)
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
    setIsModalOpen(true)
  }

  const handleSaveSupply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formModelo.trim()) {
      toast({ title: 'Código/Modelo do suprimento é obrigatório', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const valorCompraNum = formValorCompra.trim() === '' ? null : parseFloat(formValorCompra)
      const rendimentoNum = formRendimento.trim() === '' ? null : parseInt(formRendimento, 10)

      if (editingSupply) {
        await updateSuprimento(
          editingSupply.id,
          {
            modelo_suprimento: formModelo.trim(),
            tipo: formTipo,
            fabricante: formFabricante.trim(),
            impressoras_compativeis: formImpressoras.trim(),
            valor_compra: valorCompraNum,
            rendimento_paginas: rendimentoNum,
            fonte_preco: formFontePreco.trim() || undefined,
          },
          editingSupply,
        )
        toast({ title: 'Suprimento atualizado com sucesso!' })
      } else {
        await createSuprimento({
          modelo_suprimento: formModelo.trim(),
          tipo: formTipo,
          fabricante: formFabricante.trim(),
          impressoras_compativeis: formImpressoras.trim(),
          valor_compra: valorCompraNum,
          rendimento_paginas: rendimentoNum,
          fonte_preco: formFontePreco.trim() || undefined,
          ativo: true,
        })
        toast({ title: 'Novo suprimento cadastrado com sucesso!' })
      }

      setIsModalOpen(false)
      onReload()
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao salvar suprimento',
        description: err.message || 'Verifique se o modelo já está cadastrado.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Edição inline direta na tabela (Regra 20.1)
  const handleInlineChange = async (
    sup: SuprimentoRecord,
    field: 'valor_compra' | 'rendimento_paginas',
    rawVal: string,
  ) => {
    const val =
      rawVal.trim() === ''
        ? null
        : field === 'valor_compra'
          ? parseFloat(rawVal)
          : parseInt(rawVal, 10)
    try {
      await updateSuprimento(sup.id, { [field]: val }, sup)
      onReload()
    } catch (err) {
      console.error(err)
      toast({ title: 'Falha ao salvar alteração inline', variant: 'destructive' })
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
                <th className="py-2.5 px-3">Modelo / Código</th>
                <th className="py-2.5 px-3">Tipo</th>
                <th className="py-2.5 px-3">Fabricante</th>
                <th className="py-2.5 px-3 min-w-[130px]">Valor Compra (R$)</th>
                <th className="py-2.5 px-3 min-w-[120px]">Rendimento (pág)</th>
                <th className="py-2.5 px-3 min-w-[120px]">CPP Calculado</th>
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
                  const hasPrice =
                    sup.valor_compra !== null &&
                    sup.valor_compra !== undefined &&
                    sup.valor_compra > 0
                  const hasYield =
                    sup.rendimento_paginas !== null &&
                    sup.rendimento_paginas !== undefined &&
                    sup.rendimento_paginas > 0
                  const cpp = calculateSupplyCPP(sup.valor_compra, sup.rendimento_paginas)

                  return (
                    <tr key={sup.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2 px-3 font-bold text-slate-900">
                        {sup.modelo_suprimento}
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant="outline" className="text-[10px] capitalize bg-slate-50">
                          {sup.tipo}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-slate-600">{sup.fabricante}</td>

                      {/* VALOR DE COMPRA (Editável Inline) */}
                      <td className="py-1 px-3">
                        {readOnly ? (
                          <span className="font-mono text-slate-900">
                            {hasPrice ? Number(sup.valor_compra).toFixed(2) : '—'}
                          </span>
                        ) : (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue={hasPrice ? sup.valor_compra : ''}
                            onBlur={(e) => handleInlineChange(sup, 'valor_compra', e.target.value)}
                            placeholder="Preencher"
                            className={`h-7 w-24 text-right px-1.5 font-mono text-xs rounded border transition-colors ${
                              !hasPrice
                                ? 'border-amber-400 bg-amber-50 text-amber-900 font-semibold'
                                : 'border-slate-300 bg-white'
                            }`}
                            title={!hasPrice ? 'Preencher manualmente' : ''}
                          />
                        )}
                      </td>

                      {/* RENDIMENTO PÁGINAS (Editável Inline) */}
                      <td className="py-1 px-3">
                        {readOnly ? (
                          <span className="font-mono text-slate-800">
                            {hasYield ? sup.rendimento_paginas : '—'}
                          </span>
                        ) : (
                          <input
                            type="number"
                            step="100"
                            min="1"
                            defaultValue={hasYield ? sup.rendimento_paginas : ''}
                            onBlur={(e) =>
                              handleInlineChange(sup, 'rendimento_paginas', e.target.value)
                            }
                            placeholder="Preencher"
                            className={`h-7 w-24 text-right px-1.5 font-mono text-xs rounded border transition-colors ${
                              !hasYield
                                ? 'border-amber-400 bg-amber-50 text-amber-900 font-semibold'
                                : 'border-slate-300 bg-white'
                            }`}
                            title={!hasYield ? 'Preencher manualmente' : ''}
                          />
                        )}
                      </td>

                      {/* CPP CALCULADO (6 CASAS DECIMAIS - SEMPRE CALCULADO) */}
                      <td className="py-2 px-3 font-mono font-bold text-indigo-950">
                        {hasPrice && hasYield ? (
                          formatCPP6(cpp)
                        ) : (
                          <span className="text-amber-600">Pendente</span>
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
                            title="Editar completo"
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

      {/* MODAL NOVO / EDITAR SUPRIMENTO */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              {editingSupply
                ? `Editar Suprimento: ${editingSupply.modelo_suprimento}`
                : 'Cadastrar Novo Suprimento'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Campos não preenchidos ficarão pendentes (NULL) com indicador visual de preenchimento.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveSupply} className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">
                  Modelo / Part Number *
                </Label>
                <Input
                  value={formModelo}
                  onChange={(e) => setFormModelo(e.target.value)}
                  placeholder="Ex: TN-1035, T544-BK"
                  required
                  className="h-8 text-xs font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Tipo de Insumo *</Label>
                <select
                  value={formTipo}
                  onChange={(e) => setFormTipo(e.target.value as TipoSuprimento)}
                  className="w-full h-8 text-xs rounded-md border border-slate-300 bg-white px-2"
                >
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
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Fabricante *</Label>
                <Input
                  value={formFabricante}
                  onChange={(e) => setFormFabricante(e.target.value)}
                  placeholder="Ex: Brother, Epson, HP"
                  required
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Valor de Compra (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formValorCompra}
                  onChange={(e) => setFormValorCompra(e.target.value)}
                  placeholder="Ex: 49.90"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Rendimento (págs)</Label>
                <Input
                  type="number"
                  step="100"
                  min="1"
                  value={formRendimento}
                  onChange={(e) => setFormRendimento(e.target.value)}
                  placeholder="Ex: 1000"
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Modelos Compatíveis</Label>
              <Input
                value={formImpressoras}
                onChange={(e) => setFormImpressoras(e.target.value)}
                placeholder="Ex: HL-1210W, HL-1212w, DCP-1617NW..."
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">
                Fonte do Preço / Origem
              </Label>
              <Input
                value={formFontePreco}
                onChange={(e) => setFormFontePreco(e.target.value)}
                placeholder="Ex: Cotação Distribuidor ABC / Nota Fiscal 1234"
                className="h-8 text-xs"
              />
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
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
              >
                {saving ? 'Salvando...' : 'Salvar Suprimento'}
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
