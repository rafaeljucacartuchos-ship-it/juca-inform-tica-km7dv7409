import { useState, useMemo } from 'react'
import {
  Plus,
  Search,
  Printer,
  Edit2,
  Trash2,
  Layers,
  AlertTriangle,
  Ban,
  CheckCircle2,
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
import type {
  ImpressoraRecord,
  SuprimentoRecord,
  TecnologiaImpressora,
} from '@/services/pricing-module'
import { createImpressora, updateImpressora, softDeleteImpressora } from '@/services/pricing-module'
import { useToast } from '@/hooks/use-toast'

interface PrintersManagementTabProps {
  printers: ImpressoraRecord[]
  supplies: SuprimentoRecord[]
  onReload: () => void
  readOnly?: boolean
}

export function PrintersManagementTab({
  printers,
  supplies,
  onReload,
  readOnly = false,
}: PrintersManagementTabProps) {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterTecnologia, setFilterTecnologia] = useState<string>('todos')
  const [filterFabricante, setFilterFabricante] = useState<string>('todos')

  // Modal Novo / Edição
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPrinter, setEditingPrinter] = useState<ImpressoraRecord | null>(null)
  const [saving, setSaving] = useState(false)

  // Form states
  const [formModelo, setFormModelo] = useState('')
  const [formFabricante, setFormFabricante] = useState('Brother')
  const [formTecnologia, setFormTecnologia] = useState<TecnologiaImpressora>('laser_mono')
  const [formValorCompra, setFormValorCompra] = useState('')
  const [formVidaUtil, setFormVidaUtil] = useState('48')
  const [formSlot1, setFormSlot1] = useState('')
  const [formSlot2, setFormSlot2] = useState('')
  const [formSlot3, setFormSlot3] = useState('')
  const [formSlot4, setFormSlot4] = useState('')
  const [formSlot5, setFormSlot5] = useState('')
  const [formFontePreco, setFormFontePreco] = useState('')
  const [formBloqueada, setFormBloqueada] = useState(false)
  const [formMotivoBloqueio, setFormMotivoBloqueio] = useState('')

  const fabricantesDisponiveis = useMemo(() => {
    const set = new Set<string>()
    printers.forEach((p) => {
      if (p.fabricante) set.add(p.fabricante)
    })
    return Array.from(set).sort()
  }, [printers])

  const filteredPrinters = useMemo(() => {
    return printers.filter((p) => {
      if (!p.ativo) return false
      if (filterTecnologia !== 'todos' && p.tecnologia !== filterTecnologia) return false
      if (filterFabricante !== 'todos' && p.fabricante !== filterFabricante) return false
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim()
        const matchModelo = p.modelo.toLowerCase().includes(term)
        const matchFab = p.fabricante.toLowerCase().includes(term)
        if (!matchModelo && !matchFab) return false
      }
      return true
    })
  }, [printers, searchTerm, filterTecnologia, filterFabricante])

  const handleOpenCreateModal = () => {
    setEditingPrinter(null)
    setFormModelo('')
    setFormFabricante('Brother')
    setFormTecnologia('laser_mono')
    setFormValorCompra('')
    setFormVidaUtil('48')
    setFormSlot1('')
    setFormSlot2('')
    setFormSlot3('')
    setFormSlot4('')
    setFormSlot5('')
    setFormFontePreco('')
    setFormBloqueada(false)
    setFormMotivoBloqueio('')
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (p: ImpressoraRecord) => {
    setEditingPrinter(p)
    setFormModelo(p.modelo)
    setFormFabricante(p.fabricante)
    setFormTecnologia(p.tecnologia)
    setFormValorCompra(
      p.valor_compra !== null && p.valor_compra !== undefined ? String(p.valor_compra) : '',
    )
    setFormVidaUtil(p.vida_util_meses ? String(p.vida_util_meses) : '48')
    setFormSlot1(p.suprimento_1 || '')
    setFormSlot2(p.suprimento_2 || '')
    setFormSlot3(p.suprimento_3 || '')
    setFormSlot4(p.suprimento_4 || '')
    setFormSlot5(p.suprimento_5 || '')
    setFormFontePreco(p.fonte_preco_equipamento || '')
    setFormBloqueada(!!p.bloqueada)
    setFormMotivoBloqueio(p.motivo_bloqueio || '')
    setIsModalOpen(true)
  }

  const handleSavePrinter = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formModelo.trim()) {
      toast({ title: 'Modelo da impressora é obrigatório', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const valorCompraNum = formValorCompra.trim() === '' ? null : parseFloat(formValorCompra)
      const vidaUtilNum = formVidaUtil.trim() === '' ? 48 : parseInt(formVidaUtil, 10)

      const payload: Partial<ImpressoraRecord> = {
        modelo: formModelo.trim(),
        fabricante: formFabricante.trim(),
        tecnologia: formTecnologia,
        valor_compra: valorCompraNum,
        vida_util_meses: vidaUtilNum,
        suprimento_1: formSlot1 || null,
        suprimento_2: formSlot2 || null,
        suprimento_3: formSlot3 || null,
        suprimento_4: formSlot4 || null,
        suprimento_5: formSlot5 || null,
        fonte_preco_equipamento: formFontePreco.trim() || undefined,
        bloqueada: formBloqueada,
        motivo_bloqueio: formMotivoBloqueio.trim() || undefined,
      }

      if (editingPrinter) {
        await updateImpressora(editingPrinter.id, payload, editingPrinter)
        toast({ title: 'Impressora atualizada com sucesso!' })
      } else {
        await createImpressora({
          ...payload,
          ativo: true,
        })
        toast({ title: 'Impressora cadastrada com sucesso!' })
      }

      setIsModalOpen(false)
      onReload()
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao salvar impressora',
        description: err.message || 'Verifique se o modelo já existe.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Edição inline de preço e vida útil (Regra 20.1)
  const handleInlineChange = async (
    p: ImpressoraRecord,
    field: 'valor_compra' | 'vida_util_meses',
    rawVal: string,
  ) => {
    const val =
      rawVal.trim() === ''
        ? null
        : field === 'valor_compra'
          ? parseFloat(rawVal)
          : parseInt(rawVal, 10)
    try {
      await updateImpressora(p.id, { [field]: val }, p)
      onReload()
    } catch (err) {
      console.error(err)
      toast({ title: 'Falha ao salvar alteração inline', variant: 'destructive' })
    }
  }

  const handleDelete = async (p: ImpressoraRecord) => {
    if (
      confirm(`Deseja inativar o modelo "${p.modelo}"? (Exclusão lógica preservando contratos)`)
    ) {
      await softDeleteImpressora(p.id)
      toast({ title: 'Impressora inativada com sucesso.' })
      onReload()
    }
  }

  const getTechLabel = (tec: string) => {
    switch (tec) {
      case 'laser_mono':
        return 'Laser Mono'
      case 'laser_colorido':
        return 'Laser Colorido'
      case 'tinta':
        return 'Tanque de Tinta'
      case 'termica':
        return 'Térmica'
      case 'matricial':
        return 'Matricial'
      default:
        return tec
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
              placeholder="Buscar por modelo ou fabricante..."
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
            value={filterTecnologia}
            onChange={(e) => setFilterTecnologia(e.target.value)}
            className="h-9 text-xs rounded-md border border-slate-300 bg-white px-2.5 text-slate-700"
          >
            <option value="todos">Todas as Tecnologias</option>
            <option value="laser_mono">Laser Monocromático</option>
            <option value="laser_colorido">Laser Colorido</option>
            <option value="tinta">Tanque de Tinta</option>
            <option value="termica">Térmica</option>
            <option value="matricial">Matricial</option>
          </select>
        </div>

        {!readOnly && (
          <Button
            type="button"
            size="sm"
            onClick={handleOpenCreateModal}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5"
          >
            <Plus className="h-4 w-4" /> Nova Impressora
          </Button>
        )}
      </div>

      {/* TABELA DE IMPRESSORAS COM EDIÇÃO MANUAL */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[620px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] sticky top-0 z-10 border-b border-slate-200 shadow-sm">
              <tr>
                <th className="py-2.5 px-3">Modelo</th>
                <th className="py-2.5 px-3">Fabricante</th>
                <th className="py-2.5 px-3">Tecnologia</th>
                <th className="py-2.5 px-3 min-w-[130px]">Valor Aquisição (R$)</th>
                <th className="py-2.5 px-3 min-w-[100px]">Vida Útil (meses)</th>
                <th className="py-2.5 px-3">Suprimentos Mapeados</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredPrinters.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Nenhuma impressora encontrada.
                  </td>
                </tr>
              ) : (
                filteredPrinters.map((p) => {
                  const hasPrice =
                    p.valor_compra !== null && p.valor_compra !== undefined && p.valor_compra > 0
                  const mappedSlotsCount = [
                    p.suprimento_1,
                    p.suprimento_2,
                    p.suprimento_3,
                    p.suprimento_4,
                    p.suprimento_5,
                  ].filter(Boolean).length

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2 px-3 font-bold text-slate-900">{p.modelo}</td>
                      <td className="py-2 px-3 text-slate-600">{p.fabricante}</td>
                      <td className="py-2 px-3">
                        <Badge variant="outline" className="text-[10px] bg-slate-50">
                          {getTechLabel(p.tecnologia)}
                        </Badge>
                      </td>

                      {/* VALOR DE COMPRA (Editável Inline) */}
                      <td className="py-1 px-3">
                        {readOnly ? (
                          <span className="font-mono text-slate-900">
                            {hasPrice ? Number(p.valor_compra).toFixed(2) : '—'}
                          </span>
                        ) : (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue={hasPrice ? p.valor_compra : ''}
                            onBlur={(e) => handleInlineChange(p, 'valor_compra', e.target.value)}
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

                      {/* VIDA ÚTIL EM MESES (24m ou 48m conforme regra 8.3) */}
                      <td className="py-1 px-3">
                        {readOnly ? (
                          <span className="font-mono text-slate-800">
                            {p.vida_util_meses || 48}m
                          </span>
                        ) : (
                          <input
                            type="number"
                            step="12"
                            min="12"
                            max="96"
                            defaultValue={p.vida_util_meses || 48}
                            onBlur={(e) => handleInlineChange(p, 'vida_util_meses', e.target.value)}
                            className="h-7 w-16 text-right px-1.5 font-mono text-xs rounded border border-slate-300 bg-white"
                          />
                        )}
                      </td>

                      {/* SLOTS MAPEADOS */}
                      <td className="py-2 px-3">
                        <span className="text-slate-600 text-[11px]">
                          {mappedSlotsCount} de 5 slots vinculados
                        </span>
                      </td>

                      {/* STATUS (Bloqueada / Ativa) */}
                      <td className="py-2 px-3 text-center">
                        {p.bloqueada ? (
                          <Badge
                            variant="destructive"
                            className="text-[9px] px-1.5 py-0"
                            title={p.motivo_bloqueio}
                          >
                            Bloqueada
                          </Badge>
                        ) : !hasPrice ? (
                          <Badge className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0">
                            Sem Preço
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0">
                            Pronta
                          </Badge>
                        )}
                      </td>

                      {/* AÇÕES */}
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(p)}
                            className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-100"
                            title="Editar impressora e slots"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() => handleDelete(p)}
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
            Exibindo <strong>{filteredPrinters.length}</strong> de {printers.length} impressoras
            cadastradas
          </span>
          <span className="font-mono text-indigo-900 font-semibold">
            Equipamentos usados podem sobrepor amortização para 24 meses (Regra 8.3)
          </span>
        </div>
      </div>

      {/* MODAL NOVO / EDITAR IMPRESSORA */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              {editingPrinter
                ? `Editar Impressora: ${editingPrinter.modelo}`
                : 'Cadastrar Nova Impressora'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Vincule até 5 insumos estruturais (toner/tinta, drum, fusor, película e cabeçote).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePrinter} className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1 col-span-2">
                <Label className="text-xs font-semibold text-slate-700">
                  Modelo do Equipamento *
                </Label>
                <Input
                  value={formModelo}
                  onChange={(e) => setFormModelo(e.target.value)}
                  placeholder="Ex: DCP-L2540DW, L3250"
                  required
                  className="h-8 text-xs font-bold"
                />
              </div>

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
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Tecnologia *</Label>
                <select
                  value={formTecnologia}
                  onChange={(e) => setFormTecnologia(e.target.value as TecnologiaImpressora)}
                  className="w-full h-8 text-xs rounded-md border border-slate-300 bg-white px-2"
                >
                  <option value="laser_mono">Laser Monocromático</option>
                  <option value="laser_colorido">Laser Colorido</option>
                  <option value="tinta">Tanque de Tinta</option>
                  <option value="termica">Térmica</option>
                  <option value="matricial">Matricial</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Valor de Compra (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formValorCompra}
                  onChange={(e) => setFormValorCompra(e.target.value)}
                  placeholder="Ex: 2094.33"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Vida Útil (meses)</Label>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  value={formVidaUtil}
                  onChange={(e) => setFormVidaUtil(e.target.value)}
                  placeholder="48"
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            {/* VÍNCULOS DOS 5 SLOTS */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <span className="text-[11px] font-bold text-slate-800 uppercase block">
                Vínculos de Suprimentos por Slot (1 a 5)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-slate-600">Slot 1 (Toner / Tinta BK):</Label>
                  <select
                    value={formSlot1}
                    onChange={(e) => setFormSlot1(e.target.value)}
                    className="w-full h-7 text-xs rounded border border-slate-300 bg-white px-1.5"
                  >
                    <option value="">[ Vazio / Não Vinculado ]</option>
                    {supplies.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.modelo_suprimento} ({s.tipo} - {s.fabricante})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-0.5">
                  <Label className="text-[10px] text-slate-600">Slot 2 (Drum / Tinta C):</Label>
                  <select
                    value={formSlot2}
                    onChange={(e) => setFormSlot2(e.target.value)}
                    className="w-full h-7 text-xs rounded border border-slate-300 bg-white px-1.5"
                  >
                    <option value="">[ Vazio / Não Vinculado ]</option>
                    {supplies.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.modelo_suprimento} ({s.tipo} - {s.fabricante})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-0.5">
                  <Label className="text-[10px] text-slate-600">Slot 3 (Fusor / Tinta M):</Label>
                  <select
                    value={formSlot3}
                    onChange={(e) => setFormSlot3(e.target.value)}
                    className="w-full h-7 text-xs rounded border border-slate-300 bg-white px-1.5"
                  >
                    <option value="">[ Vazio / Não Vinculado ]</option>
                    {supplies.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.modelo_suprimento} ({s.tipo} - {s.fabricante})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-0.5">
                  <Label className="text-[10px] text-slate-600">Slot 4 (Película / Tinta Y):</Label>
                  <select
                    value={formSlot4}
                    onChange={(e) => setFormSlot4(e.target.value)}
                    className="w-full h-7 text-xs rounded border border-slate-300 bg-white px-1.5"
                  >
                    <option value="">[ Vazio / Não Vinculado ]</option>
                    {supplies.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.modelo_suprimento} ({s.tipo} - {s.fabricante})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-0.5 sm:col-span-2">
                  <Label className="text-[10px] text-slate-600">
                    Slot 5 (Cabeçote / Peça Especial):
                  </Label>
                  <select
                    value={formSlot5}
                    onChange={(e) => setFormSlot5(e.target.value)}
                    className="w-full h-7 text-xs rounded border border-slate-300 bg-white px-1.5"
                  >
                    <option value="">[ Vazio / Não Vinculado ]</option>
                    {supplies.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.modelo_suprimento} ({s.tipo} - {s.fabricante})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">
                Origem / Fonte do Preço
              </Label>
              <Input
                value={formFontePreco}
                onChange={(e) => setFormFontePreco(e.target.value)}
                placeholder="Ex: Nova / Usada Revisada / NF 4580"
                className="h-8 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="check-bloqueada"
                checked={formBloqueada}
                onChange={(e) => setFormBloqueada(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              <Label
                htmlFor="check-bloqueada"
                className="text-xs font-semibold text-rose-800 cursor-pointer"
              >
                Bloquear precificação deste modelo (aguardando suprimento pendente)
              </Label>
            </div>

            {formBloqueada && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Motivo do Bloqueio</Label>
                <Input
                  value={formMotivoBloqueio}
                  onChange={(e) => setFormMotivoBloqueio(e.target.value)}
                  placeholder="Ex: Cabeçote específico a cadastrar (bloqueado)"
                  className="h-8 text-xs text-rose-800"
                />
              </div>
            )}

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
                {saving ? 'Salvando...' : 'Salvar Impressora'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
