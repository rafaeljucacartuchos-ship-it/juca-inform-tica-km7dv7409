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
  const [formFabricanteCustom, setFormFabricanteCustom] = useState('')
  const [formTecnologia, setFormTecnologia] = useState<TecnologiaImpressora>('laser_mono')
  const [formValorCompra, setFormValorCompra] = useState('')
  const [formVidaUtil, setFormVidaUtil] = useState('48')
  const [formProducaoEstimada, setFormProducaoEstimada] = useState('1000')
  const [formPrintway, setFormPrintway] = useState('0')
  const [formSlot1, setFormSlot1] = useState('')
  const [formSlot2, setFormSlot2] = useState('')
  const [formSlot3, setFormSlot3] = useState('')
  const [formSlot4, setFormSlot4] = useState('')
  const [formSlot5, setFormSlot5] = useState('')
  const [formFontePreco, setFormFontePreco] = useState('')
  const [formBloqueada, setFormBloqueada] = useState(false)
  const [formMotivoBloqueio, setFormMotivoBloqueio] = useState('')
  const [formAtivo, setFormAtivo] = useState(true)

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
    setFormFabricanteCustom('')
    setFormTecnologia('laser_mono')
    setFormValorCompra('')
    setFormVidaUtil('48')
    setFormProducaoEstimada('1000')
    setFormPrintway('0')
    setFormSlot1('')
    setFormSlot2('')
    setFormSlot3('')
    setFormSlot4('')
    setFormSlot5('')
    setFormFontePreco('')
    setFormBloqueada(false)
    setFormMotivoBloqueio('')
    setFormAtivo(true)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (p: ImpressoraRecord) => {
    setEditingPrinter(p)
    setFormModelo(p.modelo)
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
    ]
    if (knownFabs.includes(p.fabricante)) {
      setFormFabricante(p.fabricante)
      setFormFabricanteCustom('')
    } else {
      setFormFabricante('Outro')
      setFormFabricanteCustom(p.fabricante || '')
    }
    setFormTecnologia(p.tecnologia)
    setFormValorCompra(
      p.valor_compra !== null && p.valor_compra !== undefined ? String(p.valor_compra) : '',
    )
    setFormVidaUtil(p.vida_util_meses ? String(p.vida_util_meses) : '48')
    setFormProducaoEstimada('1000')
    setFormPrintway(
      p.custo_mensal_software !== null && p.custo_mensal_software !== undefined
        ? String(p.custo_mensal_software)
        : '0',
    )
    setFormSlot1(p.suprimento_1 || '')
    setFormSlot2(p.suprimento_2 || '')
    setFormSlot3(p.suprimento_3 || '')
    setFormSlot4(p.suprimento_4 || '')
    setFormSlot5(p.suprimento_5 || '')
    setFormFontePreco(p.fonte_preco_equipamento || '')
    setFormBloqueada(!!p.bloqueada)
    setFormMotivoBloqueio(p.motivo_bloqueio || '')
    setFormAtivo(p.ativo !== false)
    setIsModalOpen(true)
  }

  const handleSavePrinter = async (e: React.FormEvent) => {
    e.preventDefault()
    const modeloTrim = formModelo.trim()
    if (!modeloTrim) {
      toast({ title: 'Modelo da impressora é obrigatório', variant: 'destructive' })
      return
    }

    const finalFabricante =
      formFabricante === 'Outro' ? formFabricanteCustom.trim() : formFabricante.trim()

    if (!finalFabricante) {
      toast({ title: 'Fabricante da impressora é obrigatório', variant: 'destructive' })
      return
    }

    // Validação de valor de compra (aceita vírgula ou ponto)
    let valorCompraNum: number | null = null
    const rawPreco = formValorCompra.trim().replace(',', '.')
    if (rawPreco !== '') {
      const parsed = parseFloat(rawPreco)
      if (isNaN(parsed) || parsed < 0) {
        toast({
          title: 'Valor de aquisição inválido',
          description: 'O valor deve ser um número positivo ou zero.',
          variant: 'destructive',
        })
        return
      }
      valorCompraNum = Math.round(parsed * 100) / 100
    }

    // Validação de vida útil em meses
    let vidaUtilNum = 48
    if (formVidaUtil.trim() !== '') {
      const parsedVida = parseInt(formVidaUtil.trim(), 10)
      if (isNaN(parsedVida) || parsedVida < 1) {
        toast({
          title: 'Vida útil inválida',
          description: 'A vida útil deve ser no mínimo 1 mês (padrão 48m novos, 24m usados).',
          variant: 'destructive',
        })
        return
      }
      vidaUtilNum = parsedVida
    }

    // Validação de custo mensal do software Printway (aceita vírgula ou ponto)
    let printwayNum = 0
    const rawPrintway = formPrintway.trim().replace(',', '.')
    if (rawPrintway !== '') {
      const parsedPw = parseFloat(rawPrintway)
      if (isNaN(parsedPw) || parsedPw < 0) {
        toast({
          title: 'Custo mensal de software inválido',
          description: 'O valor do software Printway deve ser positivo ou zero.',
          variant: 'destructive',
        })
        return
      }
      printwayNum = Math.round(parsedPw * 100) / 100
    }

    // Regra do projeto: se a impressora não tem valor de aquisição (NF) cadastrado,
    // nasce bloqueada com motivo explicativo, para não liberar proposta com custo distorcido
    let autoBloqueada = formBloqueada
    let autoMotivo = formMotivoBloqueio.trim()
    if (!valorCompraNum || valorCompraNum <= 0) {
      if (!autoBloqueada) {
        autoBloqueada = true
        autoMotivo =
          autoMotivo || 'Valor de aquisição pendente (preencher nota fiscal para desbloquear)'
      }
    }

    setSaving(true)
    try {
      const payload: Partial<ImpressoraRecord> = {
        modelo: modeloTrim,
        fabricante: finalFabricante,
        tecnologia: formTecnologia,
        valor_compra: valorCompraNum,
        vida_util_meses: vidaUtilNum,
        custo_mensal_software: printwayNum,
        suprimento_1: formSlot1 || null,
        suprimento_2: formSlot2 || null,
        suprimento_3: formSlot3 || null,
        suprimento_4: formSlot4 || null,
        suprimento_5: formSlot5 || null,
        fonte_preco_equipamento: formFontePreco.trim() || undefined,
        bloqueada: autoBloqueada,
        motivo_bloqueio: autoMotivo || undefined,
        ativo: formAtivo,
      }

      if (editingPrinter) {
        await updateImpressora(editingPrinter.id, payload, editingPrinter)
        toast({
          title: 'Impressora atualizada com sucesso!',
          description: `Modelo ${modeloTrim} atualizado com recálculo de custos consolidado.`,
        })
      } else {
        await createImpressora({
          ...payload,
          ativo: formAtivo,
        })
        toast({
          title: 'Impressora cadastrada com sucesso!',
          description: `Modelo ${modeloTrim} cadastrado com slots vinculados.`,
        })
      }

      setIsModalOpen(false)
      onReload()
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao salvar impressora',
        description: err.message || 'Verifique se o modelo já existe na base.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Agrupamento de suprimentos por compatibilidade para os selects dos 5 slots
  const getGroupedSuppliesForSlot = (printerModel: string) => {
    const compModel = printerModel.toLowerCase().trim()
    const compat: SuprimentoRecord[] = []
    const others: SuprimentoRecord[] = []

    supplies.forEach((s) => {
      if (!s.ativo) return
      let isCompat = false
      if (compModel && s.impressoras_compativeis) {
        const list = s.impressoras_compativeis
          .toLowerCase()
          .split(/[,;\n/]+/)
          .map((m) => m.trim())
          .filter(Boolean)
        if (list.some((item) => compModel.includes(item) || item.includes(compModel))) {
          isCompat = true
        }
      }
      if (isCompat) {
        compat.push(s)
      } else {
        others.push(s)
      }
    })

    const sortFn = (a: SuprimentoRecord, b: SuprimentoRecord) => {
      if (a.fabricante !== b.fabricante) return a.fabricante.localeCompare(b.fabricante)
      if (a.tipo !== b.tipo) return a.tipo.localeCompare(b.tipo)
      return a.modelo_suprimento.localeCompare(b.modelo_suprimento)
    }

    compat.sort(sortFn)
    others.sort(sortFn)

    return { compat, others }
  }

  const { compat: slotCompatSupplies, others: slotOtherSupplies } = useMemo(() => {
    return getGroupedSuppliesForSlot(formModelo)
  }, [formModelo, supplies])

  // Edição inline de preço, vida útil e software Printway (Regra 20.1)
  const handleInlineChange = async (
    p: ImpressoraRecord,
    field: 'valor_compra' | 'vida_util_meses' | 'custo_mensal_software',
    rawVal: string,
  ) => {
    const sanitized = rawVal.trim().replace(',', '.')
    let val: number | null = null
    if (sanitized !== '') {
      if (field === 'vida_util_meses') {
        val = parseInt(sanitized, 10)
      } else {
        const parsed = parseFloat(sanitized)
        val = isNaN(parsed) || parsed < 0 ? 0 : parsed
      }
    }
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
                <th className="py-2.5 px-3 min-w-[120px]">Software Printway (R$/mês)</th>
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

                      {/* SOFTWARE PRINTWAY (Editável Inline) */}
                      <td className="py-1 px-3">
                        {readOnly ? (
                          <span className="font-mono text-slate-800">
                            R$ {(p.custo_mensal_software || 0).toFixed(2)}
                          </span>
                        ) : (
                          <input
                            type="text"
                            defaultValue={
                              p.custo_mensal_software !== null &&
                              p.custo_mensal_software !== undefined
                                ? String(p.custo_mensal_software)
                                : '0'
                            }
                            onBlur={(e) =>
                              handleInlineChange(p, 'custo_mensal_software', e.target.value)
                            }
                            placeholder="0,00"
                            className="h-7 w-20 text-right px-1.5 font-mono text-xs rounded border border-slate-300 bg-white"
                            title="Valor mensal do software Printway para esta máquina"
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

      {/* MODAL NOVO / EDITAR IMPRESSORA COM TODOS OS CAMPOS DO SCHEMA */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl p-5 max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Printer className="h-4 w-4 text-indigo-600" />
              <span>
                {editingPrinter
                  ? `Editar Impressora: ${editingPrinter.modelo}`
                  : 'Cadastrar Nova Impressora no Parque'}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Preencha todos os campos da tabela <code>impressoras</code>. Vincule até 5 slots de
              suprimento compatíveis, informe o valor da nota fiscal de compra e custos de software
              Printway.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePrinter} className="space-y-4 py-2 text-xs">
            {/* Bloco 1: Identificação do Equipamento */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
              <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wide block">
                1. Identificação do Modelo & Fabricante
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Modelo da Impressora / Multifuncional *</span>
                    <span className="text-[10px] text-rose-600 font-bold">Obrigatório</span>
                  </Label>
                  <Input
                    value={formModelo}
                    onChange={(e) => setFormModelo(e.target.value)}
                    placeholder="Ex: DCP-L2540DW, L3250, M2070, HL-1210W"
                    required
                    className="h-8 text-xs font-bold font-mono"
                  />
                  <p className="text-[10px] text-slate-400">
                    Nome exato do equipamento (usado para casamento com suprimentos compatíveis)
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Tecnologia *</span>
                    <span className="text-[10px] text-rose-600 font-bold">Obrigatório</span>
                  </Label>
                  <select
                    value={formTecnologia}
                    onChange={(e) => setFormTecnologia(e.target.value as TecnologiaImpressora)}
                    className="w-full h-8 text-xs rounded-md border border-slate-300 bg-white px-2 font-medium"
                  >
                    <option value="laser_mono">Laser Monocromática</option>
                    <option value="laser_colorido">Laser Colorida</option>
                    <option value="tinta">Tanque de Tinta / Jato</option>
                    <option value="termica">Térmica Direta / Bobina</option>
                    <option value="matricial">Matricial de Impacto</option>
                  </select>
                </div>
              </div>

              {/* Fabricante com select de marcas conhecidas + opção Outro com texto */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Marca / Fabricante *</span>
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
                      placeholder="Ex: Lexmark, Ricoh, Pantum"
                      required
                      className="h-8 text-xs"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Bloco 2: Custos de Aquisição, Depreciação & Software */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
              <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wide block">
                2. Custos de Aquisição (NF), Depreciação & Software Printway
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Preço Aquisição NF (R$) *</span>
                    <span className="text-[10px] text-amber-600 font-medium">vírgula ou ponto</span>
                  </Label>
                  <Input
                    type="text"
                    value={formValorCompra}
                    onChange={(e) => setFormValorCompra(e.target.value)}
                    placeholder="Ex: 2094,33 ou 2094.33"
                    className={`h-8 text-xs font-mono font-bold ${
                      !formValorCompra || parseFloat(formValorCompra.replace(',', '.')) <= 0
                        ? 'border-amber-400 bg-amber-50 text-amber-900'
                        : ''
                    }`}
                  />
                  <p className="text-[10px] text-slate-400">
                    Sem NF a impressora nasce bloqueada para precificação
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Vida Útil (meses) *</span>
                    <span className="text-[10px] text-slate-500">Padrão 48m</span>
                  </Label>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    max="120"
                    value={formVidaUtil}
                    onChange={(e) => setFormVidaUtil(e.target.value)}
                    placeholder="48"
                    className="h-8 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-400">
                    Novos: 48 meses. Usados/revisados: 24 meses (Regra 8.3)
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Software Printway (R$/mês)</span>
                    <span className="text-[10px] text-indigo-700 font-medium">Default 0</span>
                  </Label>
                  <Input
                    type="text"
                    value={formPrintway}
                    onChange={(e) => setFormPrintway(e.target.value)}
                    placeholder="Ex: 0,00 ou 129,90"
                    className="h-8 text-xs font-mono font-bold text-indigo-950 bg-indigo-50/50"
                  />
                  <p className="text-[10px] text-slate-400">
                    Diluído pelo volume mensal de páginas
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">
                    Origem / Fonte do Preço do Equipamento
                  </Label>
                  <Input
                    value={formFontePreco}
                    onChange={(e) => setFormFontePreco(e.target.value)}
                    placeholder="Ex: NF Distribuidor ABC / Usada Revisada Garantia 6m"
                    className="h-8 text-xs"
                  />
                  <p className="text-[10px] text-slate-400">
                    Registro comprobatório do custo de aquisição
                  </p>
                </div>

                <div className="space-y-1 flex flex-col justify-end">
                  <div className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200 h-8">
                    <input
                      type="checkbox"
                      id="check-printer-ativo"
                      checked={formAtivo}
                      onChange={(e) => setFormAtivo(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                    />
                    <Label
                      htmlFor="check-printer-ativo"
                      className="text-xs font-semibold text-slate-800 cursor-pointer"
                    >
                      Impressora Ativa no Parque
                    </Label>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Inativas são ocultadas no simulador mantendo contratos
                  </p>
                </div>
              </div>
            </div>

            {/* Bloco 3: Mapeamento dos 5 Slots de Suprimento (agrupados por compatibilidade) */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wide">
                  3. Mapeamento Estrutural dos 5 Slots de Suprimento
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  {formModelo.trim()
                    ? `Filtrando por "${formModelo.trim()}"`
                    : 'Compatibilidade automática'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Selecione os insumos nos selects agrupados por compatibilidade. Se houver mais de um
                compatível, escolha manualmente (never assume).
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* SLOT 1 */}
                <div className="space-y-1 p-2 bg-white rounded-md border border-slate-200">
                  <Label className="text-[11px] font-bold text-slate-800 flex items-center justify-between">
                    <span>Slot 1: Toner / Tinta BK</span>
                    <Badge variant="outline" className="text-[9px] py-0">
                      Principal
                    </Badge>
                  </Label>
                  <select
                    value={formSlot1}
                    onChange={(e) => setFormSlot1(e.target.value)}
                    className="w-full h-7 text-xs rounded border border-slate-300 bg-white px-1.5 font-medium"
                  >
                    <option value="">— Vazio / Não Aplicável —</option>
                    {slotCompatSupplies.length > 0 && (
                      <optgroup label={`⭐ Compatíveis com ${formModelo || 'Impressora'}`}>
                        {slotCompatSupplies.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.modelo_suprimento} ({s.tipo} • {s.fabricante})
                            {!s.valor_compra || !s.rendimento_paginas ? ' ⚠️ (sem preço)' : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="Demais Suprimentos Cadastrados">
                      {slotOtherSupplies.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.modelo_suprimento} ({s.tipo} • {s.fabricante})
                          {!s.valor_compra || !s.rendimento_paginas ? ' ⚠️ (sem preço)' : ''}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* SLOT 2 */}
                <div className="space-y-1 p-2 bg-white rounded-md border border-slate-200">
                  <Label className="text-[11px] font-bold text-slate-800 flex items-center justify-between">
                    <span>Slot 2: Drum / Tinta C</span>
                    <Badge variant="outline" className="text-[9px] py-0">
                      Cilindro / Cor
                    </Badge>
                  </Label>
                  <select
                    value={formSlot2}
                    onChange={(e) => setFormSlot2(e.target.value)}
                    className="w-full h-7 text-xs rounded border border-slate-300 bg-white px-1.5 font-medium"
                  >
                    <option value="">— Vazio / Não Aplicável —</option>
                    {slotCompatSupplies.length > 0 && (
                      <optgroup label={`⭐ Compatíveis com ${formModelo || 'Impressora'}`}>
                        {slotCompatSupplies.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.modelo_suprimento} ({s.tipo} • {s.fabricante})
                            {!s.valor_compra || !s.rendimento_paginas ? ' ⚠️ (sem preço)' : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="Demais Suprimentos Cadastrados">
                      {slotOtherSupplies.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.modelo_suprimento} ({s.tipo} • {s.fabricante})
                          {!s.valor_compra || !s.rendimento_paginas ? ' ⚠️ (sem preço)' : ''}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* SLOT 3 */}
                <div className="space-y-1 p-2 bg-white rounded-md border border-slate-200">
                  <Label className="text-[11px] font-bold text-slate-800 flex items-center justify-between">
                    <span>Slot 3: Unidade Fusora / Tinta M</span>
                    <Badge variant="outline" className="text-[9px] py-0">
                      Fusor / Magenta
                    </Badge>
                  </Label>
                  <select
                    value={formSlot3}
                    onChange={(e) => setFormSlot3(e.target.value)}
                    className="w-full h-7 text-xs rounded border border-slate-300 bg-white px-1.5 font-medium"
                  >
                    <option value="">— Vazio / Não Aplicável —</option>
                    {slotCompatSupplies.length > 0 && (
                      <optgroup label={`⭐ Compatíveis com ${formModelo || 'Impressora'}`}>
                        {slotCompatSupplies.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.modelo_suprimento} ({s.tipo} • {s.fabricante})
                            {!s.valor_compra || !s.rendimento_paginas ? ' ⚠️ (sem preço)' : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="Demais Suprimentos Cadastrados">
                      {slotOtherSupplies.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.modelo_suprimento} ({s.tipo} • {s.fabricante})
                          {!s.valor_compra || !s.rendimento_paginas ? ' ⚠️ (sem preço)' : ''}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* SLOT 4 */}
                <div className="space-y-1 p-2 bg-white rounded-md border border-slate-200">
                  <Label className="text-[11px] font-bold text-slate-800 flex items-center justify-between">
                    <span>Slot 4: Película de Fusão / Tinta Y</span>
                    <Badge variant="outline" className="text-[9px] py-0">
                      Película / Yellow
                    </Badge>
                  </Label>
                  <select
                    value={formSlot4}
                    onChange={(e) => setFormSlot4(e.target.value)}
                    className="w-full h-7 text-xs rounded border border-slate-300 bg-white px-1.5 font-medium"
                  >
                    <option value="">— Vazio / Não Aplicável —</option>
                    {slotCompatSupplies.length > 0 && (
                      <optgroup label={`⭐ Compatíveis com ${formModelo || 'Impressora'}`}>
                        {slotCompatSupplies.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.modelo_suprimento} ({s.tipo} • {s.fabricante})
                            {!s.valor_compra || !s.rendimento_paginas ? ' ⚠️ (sem preço)' : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="Demais Suprimentos Cadastrados">
                      {slotOtherSupplies.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.modelo_suprimento} ({s.tipo} • {s.fabricante})
                          {!s.valor_compra || !s.rendimento_paginas ? ' ⚠️ (sem preço)' : ''}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* SLOT 5 */}
                <div className="space-y-1 p-2 bg-white rounded-md border border-slate-200 sm:col-span-2">
                  <Label className="text-[11px] font-bold text-slate-800 flex items-center justify-between">
                    <span>Slot 5: Cabeçote / Peça Especial / Bobina / Fita / Ribbon</span>
                    <Badge variant="outline" className="text-[9px] py-0">
                      Cabeçote / Outros
                    </Badge>
                  </Label>
                  <select
                    value={formSlot5}
                    onChange={(e) => setFormSlot5(e.target.value)}
                    className="w-full h-7 text-xs rounded border border-slate-300 bg-white px-1.5 font-medium"
                  >
                    <option value="">— Vazio / Não Aplicável —</option>
                    {slotCompatSupplies.length > 0 && (
                      <optgroup label={`⭐ Compatíveis com ${formModelo || 'Impressora'}`}>
                        {slotCompatSupplies.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.modelo_suprimento} ({s.tipo} • {s.fabricante})
                            {!s.valor_compra || !s.rendimento_paginas ? ' ⚠️ (sem preço)' : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="Demais Suprimentos Cadastrados">
                      {slotOtherSupplies.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.modelo_suprimento} ({s.tipo} • {s.fabricante})
                          {!s.valor_compra || !s.rendimento_paginas ? ' ⚠️ (sem preço)' : ''}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>
            </div>

            {/* Bloco 4: Bloqueio Operacional para Precificação */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wide block">
                4. Status Operacional de Precificação
              </span>

              <div className="flex items-start gap-2 pt-1">
                <input
                  type="checkbox"
                  id="check-bloqueada"
                  checked={formBloqueada}
                  onChange={(e) => setFormBloqueada(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-rose-600 mt-0.5"
                />
                <Label
                  htmlFor="check-bloqueada"
                  className="text-xs font-semibold text-rose-800 cursor-pointer leading-tight"
                >
                  Bloquear precificação deste modelo (aguardando suprimento ou homologação)
                </Label>
              </div>

              {formBloqueada && (
                <div className="space-y-1 pt-1">
                  <Label className="text-xs font-semibold text-rose-900">
                    Motivo do Bloqueio Cadastral *
                  </Label>
                  <Input
                    value={formMotivoBloqueio}
                    onChange={(e) => setFormMotivoBloqueio(e.target.value)}
                    placeholder="Ex: Cabeçote específico a cadastrar (bloqueado) / Valor de aquisição pendente"
                    className="h-8 text-xs text-rose-900 border-rose-300 bg-rose-50"
                  />
                  <p className="text-[10px] text-rose-700">
                    O motivo será exibido no simulador impedindo a emissão de proposta sem preço
                    correto.
                  </p>
                </div>
              )}
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
                ) : editingPrinter ? (
                  'Salvar Alterações da Impressora'
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    <span>Cadastrar Impressora</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
