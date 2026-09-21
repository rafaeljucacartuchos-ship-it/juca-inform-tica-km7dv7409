import { useState, useEffect, useMemo } from 'react'
import {
  Calculator,
  TrendingUp,
  FileText,
  AlertCircle,
  Sparkles,
  Layers,
  Wrench,
  DollarSign,
  ArrowRight,
  ShieldAlert,
  ChevronDown,
  Package,
  Printer,
  Settings as SettingsIcon,
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { RentalCustomerSelect } from '@/components/RentalCustomerSelect'
import type { RentalCustomerSelection } from '@/components/RentalCustomerSelect'
import { PrinterSelectCombo } from './PrinterSelectCombo'
import { SupplySlotsGrid } from './SupplySlotsGrid'
import { ResultsPricingPanel } from './ResultsPricingPanel'
import { SuppliesManagementTab } from './SuppliesManagementTab'
import { PrintersManagementTab } from './PrintersManagementTab'
import { ParametersAndAuditTab } from './ParametersAndAuditTab'
import {
  calculatePricing,
  calculateBreakEven,
  type PricingEngineResult,
  type BreakEvenResult,
  type SupplySlotInput,
} from '@/lib/pricing-engine'
import type {
  ImpressoraRecord,
  SuprimentoRecord,
  ParametrosGlobais,
} from '@/services/pricing-module'
import {
  updateImpressora,
  updateSuprimento,
  recalculateLinkedPrintersForSupply,
} from '@/services/pricing-module'
import { createRentalQuote } from '@/services/rental'
import type { RentalQuote } from '@/types'

interface ModernRentalSimulatorProps {
  printers: ImpressoraRecord[]
  supplies: SuprimentoRecord[]
  parametros: ParametrosGlobais
  auditHistory?: import('@/services/pricing-module').AuditoriaPrecoRecord[]
  onQuoteGenerated: (quote: RentalQuote) => void
  onReloadData: () => void
  onOpenSupplyEdit?: (supplyModel: string) => void
  readOnly?: boolean
  initialCascadeSection?: string
}

export function ModernRentalSimulator({
  printers,
  supplies,
  parametros,
  auditHistory = [],
  onQuoteGenerated,
  onReloadData,
  onOpenSupplyEdit,
  readOnly = false,
  initialCascadeSection,
}: ModernRentalSimulatorProps) {
  const { toast } = useToast()
  // Controle de cascata aberta (accordion expansível sob demanda)
  const [cascadeOpen, setCascadeOpen] = useState<string>(initialCascadeSection || '')

  // Tratador para quando clicar em cadastrar preço de insumo pendente
  const handleOpenSupplyEditInternal = (supplyModel: string) => {
    setCascadeOpen('suprimentos')
    if (onOpenSupplyEdit) {
      onOpenSupplyEdit(supplyModel)
    }
  }

  // Cliente / Locatário
  const [customer, setCustomer] = useState<RentalCustomerSelection>({
    cliente_nome_livre: '',
    cliente_telefone: '',
    cliente_documento: '',
    cliente_endereco: '',
  })

  // Equipamento Selecionado
  const [selectedPrinter, setSelectedPrinter] = useState<ImpressoraRecord | null>(null)

  // Estado de inclusão por slot: todos os slots com suprimento vinculado iniciam marcados por padrão (true)
  const [includedSlots, setIncludedSlots] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
  })

  // Diálogo de confirmação para gerar proposta com suprimentos essenciais/estruturais desmarcados
  const [essentialWarningModalOpen, setEssentialWarningModalOpen] = useState(false)
  const [unconfirmedStructuralSlots, setUnconfirmedStructuralSlots] = useState<
    { slotNumber: number; modelo: string; tipo: string }[]
  >([])

  // Modal para resolver ambiguidade se houver múltiplos suprimentos compatíveis
  const [ambiguousSlotModal, setAmbigousSlotModal] = useState<{
    slotNumber: 1 | 2 | 3 | 4 | 5
    supplies: SuprimentoRecord[]
  } | null>(null)

  // Cenário B para Comparação / Break-Even
  const [printerScenarioB, setPrinterScenarioB] = useState<ImpressoraRecord | null>(null)
  const [locacaoScenarioB, setLocacaoScenarioB] = useState<number>(490.14)

  // Atualiza seção de cascata se informada externamente
  useEffect(() => {
    if (initialCascadeSection !== undefined) {
      setCascadeOpen(initialCascadeSection)
    }
  }, [initialCascadeSection])

  // Parâmetros da Simulação
  const [producaoMensal, setProducaoMensal] = useState<number>(
    parametros.producao_mensal_referencia || 1000,
  )
  const [locacaoMensal, setLocacaoMensal] = useState<number>(87.21)
  const [vidaUtilCustom, setVidaUtilCustom] = useState<number>(48)
  const [markupCustom, setMarkupCustom] = useState<number>(parametros.mark_up_revenda || 1.45)
  const [equipPriceCustom, setEquipPriceCustom] = useState<string>('')
  const [tituloProposta, setTituloProposta] = useState<string>(
    'Locação de Impressoras — Proposta Comercial',
  )
  const [contratoMeses, setContratoMeses] = useState<number>(12)
  const [generatingQuote, setGeneratingQuote] = useState(false)

  // Seleciona impressora padrão (DCP-L2540DW ou primeira)
  useEffect(() => {
    if (!selectedPrinter && printers.length > 0) {
      const preferred = printers.find((p) => p.modelo === 'DCP-L2540DW') || printers[0]
      selectPrinter(preferred)
    }
  }, [printers])

  // Atualiza parâmetros padrão quando o registro de parametros mudar
  useEffect(() => {
    if (parametros.mark_up_revenda) setMarkupCustom(parametros.mark_up_revenda)
  }, [parametros])

  const selectPrinter = (printer: ImpressoraRecord) => {
    setSelectedPrinter(printer)
    // Ao selecionar nova impressora, reseta todos os slots como marcados por padrão
    setIncludedSlots({
      1: true,
      2: true,
      3: true,
      4: true,
      5: true,
    })
    setEquipPriceCustom(
      printer.valor_compra !== null && printer.valor_compra !== undefined
        ? String(printer.valor_compra)
        : '',
    )
    setVidaUtilCustom(printer.vida_util_meses || parametros.vida_util_padrao_meses || 48)
  }

  const handleToggleSlotInclusion = (slotNumber: 1 | 2 | 3 | 4 | 5, included: boolean) => {
    setIncludedSlots((prev) => ({
      ...prev,
      [slotNumber]: included,
    }))
  }

  // Prepara os 5 slots de suprimento vinculados à impressora selecionada
  const activeSupplySlots = useMemo<SupplySlotInput[]>(() => {
    if (!selectedPrinter) return []

    const slotsRaw = [
      selectedPrinter.expand?.suprimento_1 ||
        supplies.find((s) => s.id === selectedPrinter.suprimento_1),
      selectedPrinter.expand?.suprimento_2 ||
        supplies.find((s) => s.id === selectedPrinter.suprimento_2),
      selectedPrinter.expand?.suprimento_3 ||
        supplies.find((s) => s.id === selectedPrinter.suprimento_3),
      selectedPrinter.expand?.suprimento_4 ||
        supplies.find((s) => s.id === selectedPrinter.suprimento_4),
      selectedPrinter.expand?.suprimento_5 ||
        supplies.find((s) => s.id === selectedPrinter.suprimento_5),
    ]

    // Brother compactas: chassi integrado nos slots fusor/película (regra 4.3)
    const isBrotherCompacta = [
      'HL-1200',
      'HL-1210W',
      'HL-1212w',
      'DCP-1600',
      'DCP-1610NW',
      'DCP-1617NW',
    ].includes(selectedPrinter.modelo)

    return [1, 2, 3, 4, 5].map((slotNum) => {
      const sup = slotsRaw[slotNum - 1]

      if (isBrotherCompacta && (slotNum === 3 || slotNum === 4)) {
        return {
          slotNumber: slotNum as any,
          modelo: 'INTEGRADO',
          tipo: slotNum === 3 ? 'unidade_fusora' : 'pelicula',
          fabricante: 'Brother',
          valorCompra: 0,
          rendimentoPaginas: 50000,
          integratedToChassis: true,
        }
      }

      if (!sup) {
        return {
          slotNumber: slotNum as any,
          modelo: '',
          tipo: 'insumo',
          fabricante: '',
          valorCompra: null,
          rendimentoPaginas: null,
        }
      }

      return {
        slotNumber: slotNum as any,
        supplyId: sup.id,
        modelo: sup.modelo_suprimento,
        tipo: sup.tipo,
        fabricante: sup.fabricante,
        valorCompra: sup.valor_compra ?? null,
        rendimentoPaginas: sup.rendimento_paginas ?? null,
        included: includedSlots[slotNum] !== false,
      }
    })
  }, [selectedPrinter, supplies, includedSlots])

  // CÁLCULO REATIVO EM TEMPO REAL (< 100ms)
  const calculation = useMemo<PricingEngineResult>(() => {
    if (!selectedPrinter) {
      return {
        valid: false,
        errors: ['Selecione um equipamento.'],
        warnings: [],
        isThermalOrMatrix: false,
        cppSuprimentos: 0,
        cppEquipamento: 0,
        cppFornecedorTotal: 0,
        markUpAplicado: markupCustom,
        cppVenda: 0,
        custoMensalProducao: 0,
        faturamentoTotalMensal: 0,
        slotsEnriquecidos: [],
        formatted: {
          cppSuprimentos: 'R$ 0,000000',
          cppEquipamento: 'R$ 0,000000',
          cppFornecedorTotal: 'R$ 0,000000',
          cppVenda: 'R$ 0,000000',
          custoMensalProducao: 'R$ 0,00',
          faturamentoTotalMensal: 'R$ 0,00',
        },
      }
    }

    const valorCompraNum = equipPriceCustom.trim() === '' ? null : parseFloat(equipPriceCustom)

    return calculatePricing({
      printerId: selectedPrinter.id,
      modelo: selectedPrinter.modelo,
      fabricante: selectedPrinter.fabricante,
      tecnologia: selectedPrinter.tecnologia,
      valorCompra: valorCompraNum,
      vidaUtilMeses: vidaUtilCustom,
      producaoMensalEstimada: producaoMensal,
      locacaoMensalProposta: locacaoMensal,
      markUpRevenda: markupCustom,
      supplies: activeSupplySlots,
      bloqueada: selectedPrinter.bloqueada,
      motivoBloqueio: selectedPrinter.motivo_bloqueio,
    })
  }, [
    selectedPrinter,
    activeSupplySlots,
    equipPriceCustom,
    vidaUtilCustom,
    producaoMensal,
    locacaoMensal,
    markupCustom,
  ])

  // CÁLCULO DE BREAK-EVEN SE HOUVER CENÁRIO B
  const breakEvenResult = useMemo<BreakEvenResult | null>(() => {
    if (!selectedPrinter || !printerScenarioB || selectedPrinter.id === printerScenarioB.id) {
      return null
    }

    // Calcula cenário B
    const slotsBRaw = [
      printerScenarioB.expand?.suprimento_1 ||
        supplies.find((s) => s.id === printerScenarioB.suprimento_1),
      printerScenarioB.expand?.suprimento_2 ||
        supplies.find((s) => s.id === printerScenarioB.suprimento_2),
      printerScenarioB.expand?.suprimento_3 ||
        supplies.find((s) => s.id === printerScenarioB.suprimento_3),
      printerScenarioB.expand?.suprimento_4 ||
        supplies.find((s) => s.id === printerScenarioB.suprimento_4),
      printerScenarioB.expand?.suprimento_5 ||
        supplies.find((s) => s.id === printerScenarioB.suprimento_5),
    ]

    const slotsBInput: SupplySlotInput[] = [1, 2, 3, 4, 5].map((sNum) => {
      const sup = slotsBRaw[sNum - 1]
      return {
        slotNumber: sNum as any,
        modelo: sup?.modelo_suprimento || '',
        tipo: sup?.tipo || 'insumo',
        fabricante: sup?.fabricante || '',
        valorCompra: sup?.valor_compra ?? null,
        rendimentoPaginas: sup?.rendimento_paginas ?? null,
      }
    })

    const calcB = calculatePricing({
      modelo: printerScenarioB.modelo,
      fabricante: printerScenarioB.fabricante,
      tecnologia: printerScenarioB.tecnologia,
      valorCompra: printerScenarioB.valor_compra,
      vidaUtilMeses: printerScenarioB.vida_util_meses || 48,
      producaoMensalEstimada: producaoMensal,
      markUpRevenda: markupCustom,
      supplies: slotsBInput,
    })

    return calculateBreakEven(
      {
        modelo: selectedPrinter.modelo,
        locacaoMensal,
        cppVenda: calculation.cppVenda,
      },
      {
        modelo: printerScenarioB.modelo,
        locacaoMensal: locacaoScenarioB,
        cppVenda: calcB.cppVenda,
      },
      producaoMensal,
    )
  }, [
    selectedPrinter,
    printerScenarioB,
    locacaoScenarioB,
    locacaoMensal,
    calculation.cppVenda,
    producaoMensal,
    markupCustom,
    supplies,
  ])

  // Atualização de insumo ou slot na impressora selecionada
  const handleUpdateSlotSupply = async (slotNumber: 1 | 2 | 3 | 4 | 5, supplyId: string | null) => {
    if (!selectedPrinter) return
    const field = `suprimento_${slotNumber}` as keyof ImpressoraRecord

    try {
      const updated = await updateImpressora(
        selectedPrinter.id,
        { [field]: supplyId },
        selectedPrinter,
      )
      // Dispara recálculo automático em cascata para garantir que os CPPs da impressora fiquem salvos
      if (supplyId) {
        await recalculateLinkedPrintersForSupply(supplyId)
      } else if (selectedPrinter[field]) {
        // Se desvinculou, recalcula pelo suprimento anterior
        await recalculateLinkedPrintersForSupply(selectedPrinter[field] as string)
      }

      // Atualiza o estado da impressora selecionada e recarrega os dados globais
      setSelectedPrinter({
        ...selectedPrinter,
        ...updated,
        [field]: supplyId,
      })
      onReloadData()

      const newSup = supplyId ? supplies.find((s) => s.id === supplyId) : null
      toast({
        title: `Slot ${slotNumber} atualizado!`,
        description: newSup
          ? `Insumo ${newSup.modelo_suprimento} vinculado com sucesso.`
          : 'Slot desvinculado (Vazio / Não Aplicável).',
      })
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao atualizar slot', variant: 'destructive' })
    }
  }

  // Edição inline direta dos valores do suprimento pelo card de slots
  const handleUpdateSlotValues = async (
    slotNumber: 1 | 2 | 3 | 4 | 5,
    valorCompra: number | null,
    rendimentoPaginas: number | null,
  ) => {
    const slot = activeSupplySlots[slotNumber - 1]
    if (!slot || !slot.supplyId) return

    const existingSupply = supplies.find((s) => s.id === slot.supplyId)
    if (!existingSupply) return

    // Validações
    if (valorCompra !== null && valorCompra < 0) {
      toast({ title: 'Valor de compra não pode ser negativo', variant: 'destructive' })
      return
    }
    if (
      rendimentoPaginas !== null &&
      (rendimentoPaginas <= 0 || !Number.isInteger(rendimentoPaginas))
    ) {
      toast({ title: 'Rendimento deve ser número inteiro positivo', variant: 'destructive' })
      return
    }

    try {
      await updateSuprimento(
        slot.supplyId,
        {
          valor_compra: valorCompra,
          rendimento_paginas: rendimentoPaginas,
        },
        existingSupply,
      )
      toast({
        title: 'Suprimento atualizado!',
        description: `Valores de ${slot.modelo} atualizados e recalculados na impressora.`,
      })
      onReloadData()
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao atualizar suprimento do slot', variant: 'destructive' })
    }
  }

  // Executa a persistência da proposta comercial
  const proceedGenerateProposal = async () => {
    if (!selectedPrinter) return

    setGeneratingQuote(true)
    try {
      // Identifica os códigos/modelos dos suprimentos efetivamente incluídos no cálculo
      const slotsIncluidosCodigos = calculation.slotsEnriquecidos
        .filter((s) => s.visualStatus !== 'empty' && s.included)
        .map((s) => s.supplyId || s.modelo)

      // Monta suprimentos vinculados estruturados apenas para os slots incluídos na proposta
      const suprimentosPayload = calculation.slotsEnriquecidos
        .filter((s) => s.visualStatus !== 'empty' && s.included)
        .map((s) => ({
          slot: s.slotNumber,
          modelo_suprimento: s.modelo,
          tipo: s.tipo,
          valor_compra: s.valorCompra,
          rendimento_paginas: s.rendimentoPaginas,
          cpp_calculado: s.cppCalculado,
          is_provisao: s.isProvision,
          integrado_chassi: s.integratedToChassis,
          included: true,
        }))

      // Mapeamento completo dos 5 slots para snapshot de auditoria
      const allSlotsSnapshot = calculation.slotsEnriquecidos.map((s) => ({
        slot: s.slotNumber,
        modelo_suprimento: s.modelo,
        tipo: s.tipo,
        cpp_calculado: s.cppCalculado,
        included: s.included,
        is_structural: s.isStructural,
        structural_warning: s.structuralWarning,
      }))

      const quoteData: Partial<RentalQuote> = {
        cliente_id: customer.cliente_id || undefined,
        cliente_nome_livre: customer.cliente_nome_livre.trim(),
        cliente_telefone: customer.cliente_telefone.trim(),
        cliente_documento: customer.cliente_documento.trim(),
        cliente_endereco: customer.cliente_endereco.trim(),
        volume_mensal: producaoMensal,
        franquia_paginas: producaoMensal,
        contrato_meses: contratoMeses,
        excesso_pagina_valor: calculation.cppVenda,
        scanner: true,
        scanner_dados: 'Alimentador ADF Duplex',
        margem_pct: Math.round((markupCustom - 1) * 100),
        payback_meses: vidaUtilCustom,
        status: 'proposta_gerada',
        titulo: tituloProposta || 'Proposta de Locação Corporativa',
        maquinas_comparadas: [
          {
            machineName: `${selectedPrinter.modelo} (${selectedPrinter.fabricante})`,
            valorCompra: Number(equipPriceCustom) || 0,
            paybackMeses: vidaUtilCustom,
            cppFornecedor: calculation.cppFornecedorTotal,
            cppRevenda: calculation.cppVenda,
            locacaoMensal: locacaoMensal,
            franquiaSugerida: calculation.faturamentoTotalMensal,
            excedenteSugerido: calculation.cppVenda,
            tco: calculation.faturamentoTotalMensal * contratoMeses,
            scanner: true,
            scannerDados: 'ADF Duplex',
            supplies: suprimentosPayload.map((s) => ({
              product: s.modelo_suprimento,
              nome: s.modelo_suprimento,
              tipo: s.tipo,
              valor: s.valor_compra || 0,
              durabilidade_paginas: s.rendimento_paginas || 0,
              custo: s.valor_compra || 0,
              durabilidade: s.rendimento_paginas || 0,
              cpp: s.cpp_calculado,
            })),
          },
        ],
        resultados: {
          machines: [],
          volumeMensal: producaoMensal,
          franquiaPaginas: producaoMensal,
          contratoMeses,
          margemPct: Math.round((markupCustom - 1) * 100),
          paybackMesesPadrao: vidaUtilCustom,
          breakEvenPaginas: breakEvenResult?.paginasBreakEven || undefined,
          vantagemDescricao: breakEvenResult?.recomendacao || undefined,
          // Campo especificado: slots_incluidos com os códigos dos suprimentos efetivamente no cálculo
          slots_incluidos: slotsIncluidosCodigos,
          // Congelamento de memória de cálculo conforme seção 11.1
          pricingSnapshot: {
            impressora: {
              id: selectedPrinter.id,
              modelo: selectedPrinter.modelo,
              fabricante: selectedPrinter.fabricante,
              tecnologia: selectedPrinter.tecnologia,
              valor_compra: Number(equipPriceCustom) || 0,
            },
            slots_incluidos: slotsIncluidosCodigos,
            todos_slots: allSlotsSnapshot,
            suprimentos_vinculados: suprimentosPayload,
            memoria_calculo: {
              cpp_suprimentos: calculation.cppSuprimentos,
              cpp_equipamento: calculation.cppEquipamento,
              cpp_fornecedor_total: calculation.cppFornecedorTotal,
              mark_up_aplicado: calculation.markUpAplicado,
              cpp_venda_fechado: calculation.cppVenda,
              custo_mensal_producao: calculation.custoMensalProducao,
              faturamento_total_mensal: calculation.faturamentoTotalMensal,
            },
            alertas_operacionais: calculation.warnings,
          },
        } as any,
      }

      const created = await createRentalQuote(quoteData)

      toast({
        title: 'Proposta Gerada com Sucesso!',
        description: `Proposta vinculada a ${customer.cliente_nome_livre}. CPP de venda congelado em ${calculation.formatted.cppVenda}.`,
      })

      onQuoteGenerated(created)
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao gerar proposta',
        description: err.message || 'Verifique se os dados estão completos.',
        variant: 'destructive',
      })
    } finally {
      setGeneratingQuote(false)
    }
  }

  // GERAR PROPOSTA COMERCIAL CONGELANDO DADOS (Seção 5, 11 e Regra 20.3)
  const handleGenerateProposal = async () => {
    if (!customer.cliente_nome_livre.trim()) {
      toast({
        title: 'Informe o Cliente / Locatário',
        description: 'É necessário identificar o cliente para emissão da proposta.',
        variant: 'destructive',
      })
      return
    }

    if (!selectedPrinter) {
      toast({ title: 'Selecione uma impressora', variant: 'destructive' })
      return
    }

    // Bloqueios de integridade (Seções 8.1 e 18)
    if (!calculation.valid) {
      toast({
        title: 'Bloqueio de Integridade Cadastral',
        description: calculation.errors[0] || 'Resolva as pendências cadastrais para prosseguir.',
        variant: 'destructive',
      })
      return
    }

    // Verificação de slots essenciais / estruturais desmarcados antes de gerar a proposta
    const unselectedStructural = calculation.slotsEnriquecidos.filter(
      (s) =>
        s.visualStatus !== 'empty' &&
        s.visualStatus !== 'integrated' &&
        !s.included &&
        (s.isStructural || s.tipo === 'toner' || s.tipo === 'tinta'),
    )

    if (unselectedStructural.length > 0) {
      setUnconfirmedStructuralSlots(
        unselectedStructural.map((s) => ({
          slotNumber: s.slotNumber,
          modelo: s.modelo,
          tipo: s.tipo,
        })),
      )
      setEssentialWarningModalOpen(true)
      return
    }

    await proceedGenerateProposal()
  }

  return (
    <div className="space-y-6">
      {/* SELEÇÃO DO CLIENTE / LOCATÁRIO */}
      <RentalCustomerSelect value={customer} onChange={setCustomer} />

      {/* BLOCO 1: SELEÇÃO DA IMPRESSORA & PARÂMETROS CONTRATUAIS */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-indigo-600" />
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">
                1. Seleção do Equipamento & Parâmetros Comerciais
              </h3>
              <p className="text-xs text-slate-500">
                Escolha a impressora do parque; seus insumos e taxas de depreciação serão carregados
                imediatamente.
              </p>
            </div>
          </div>

          {selectedPrinter && (
            <Badge className="bg-indigo-50 text-indigo-900 border border-indigo-200 font-bold text-xs">
              {selectedPrinter.modelo} ({selectedPrinter.fabricante})
            </Badge>
          )}
        </div>

        {/* COMBO DE SELEÇÃO DA IMPRESSORA */}
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-800">
            Impressora / Multifuncional do Parque *
          </Label>
          <PrinterSelectCombo
            printers={printers}
            selectedPrinter={selectedPrinter}
            onSelectPrinter={selectPrinter}
          />
        </div>

        {/* INPUTS DE PARÂMETROS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1 text-xs">
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700">Valor de Compra (R$) *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={equipPriceCustom}
              onChange={(e) => setEquipPriceCustom(e.target.value)}
              placeholder="Ex: 2094.33"
              className={`h-9 text-xs font-mono font-bold ${
                !equipPriceCustom || parseFloat(equipPriceCustom) <= 0
                  ? 'border-amber-400 bg-amber-50 text-amber-900'
                  : ''
              }`}
            />
            <p className="text-[10px] text-slate-400">Ativo para depreciação</p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700">
              Franquia / Produção (pág/mês) *
            </Label>
            <Input
              type="number"
              step="100"
              min="1"
              value={producaoMensal || ''}
              onChange={(e) => setProducaoMensal(parseInt(e.target.value, 10) || 1)}
              className="h-9 text-xs font-mono font-bold text-indigo-950"
            />
            <p className="text-[10px] text-slate-400">Volume estimado</p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700">Locação Mensal Base (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={locacaoMensal || ''}
              onChange={(e) => setLocacaoMensal(parseFloat(e.target.value) || 0)}
              className="h-9 text-xs font-mono font-bold"
            />
            <p className="text-[10px] text-slate-400">Parcela locatícia fixa</p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700">Vida Útil (meses)</Label>
            <Input
              type="number"
              step="12"
              min="12"
              max="96"
              value={vidaUtilCustom || ''}
              onChange={(e) => setVidaUtilCustom(parseInt(e.target.value, 10) || 48)}
              className="h-9 text-xs font-mono"
            />
            <p className="text-[10px] text-slate-400">Padrão: 48m (usados: 24m)</p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700">
              Mark-up Revenda (Fator) *
            </Label>
            <Input
              type="number"
              step="0.01"
              min="1.0"
              value={markupCustom || ''}
              onChange={(e) => setMarkupCustom(parseFloat(e.target.value) || 1.45)}
              className="h-9 text-xs font-mono font-bold text-indigo-950"
            />
            <p className="text-[10px] text-slate-400">Ex: 1.4500 (sobre total)</p>
          </div>
        </div>

        {/* ALERTA SE MODELO BLOQUEADO OU FALTANDO PREÇO */}
        {selectedPrinter?.bloqueada && (
          <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-900 text-xs flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600" />
            <div>
              <strong>Equipamento Bloqueado para Precificação:</strong>{' '}
              {selectedPrinter.motivo_bloqueio ||
                'Insumo essencial não homologado para este modelo.'}
            </div>
          </div>
        )}
      </div>

      {/* BLOCO 2: SUPRIMENTOS VINCULADOS (5 SLOTS COLORIDOS) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
        <SupplySlotsGrid
          slots={calculation.slotsEnriquecidos}
          allSupplies={supplies}
          printerModel={selectedPrinter?.modelo}
          printerManufacturer={selectedPrinter?.fabricante}
          readOnly={readOnly}
          onToggleSlotInclusion={handleToggleSlotInclusion}
          onUpdateSlotSupply={handleUpdateSlotSupply}
          onUpdateSlotValues={handleUpdateSlotValues}
          onOpenSupplyEditModal={handleOpenSupplyEditInternal}
        />{' '}
      </div>

      {/* BLOCO 3: RESULTADOS DA PRECIFICAÇÃO & BREAK-EVEN */}
      <ResultsPricingPanel
        calculation={calculation}
        selectedPrinter={selectedPrinter}
        producaoMensal={producaoMensal}
        locacaoMensal={locacaoMensal}
        markup={markupCustom}
        vidaUtil={vidaUtilCustom}
        breakEven={breakEvenResult}
        onGenerateProposal={handleGenerateProposal}
        generatingProposal={generatingQuote}
        printerScenarioB={printerScenarioB}
        locacaoScenarioB={locacaoScenarioB}
        onUpdateScenarioB={(p, loc) => {
          setPrinterScenarioB(p)
          setLocacaoScenarioB(loc)
        }}
        availablePrinters={printers}
      />

      {/* BLOCO EM CASCATA: CONSULTAS & GESTÃO (SUPRIMENTOS, IMPRESSORAS E PARÂMETROS/AUDITORIA) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all">
        <div className="bg-gradient-to-r from-slate-50 via-indigo-50/30 to-slate-50 p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-indigo-600/10 text-indigo-700 flex items-center justify-center font-bold">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-900 text-sm">
                  Consultas e Parâmetros em Cascata
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                  Expansível sob demanda
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Consulte ou ajuste insumos, máquinas do parque e parâmetros globais sem sair do
                simulador.
              </p>
            </div>
          </div>

          {/* Atalhos rápidos para abrir/fechar direto */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              type="button"
              variant={cascadeOpen === 'suprimentos' ? 'default' : 'outline'}
              size="sm"
              onClick={() =>
                setCascadeOpen((prev) => (prev === 'suprimentos' ? '' : 'suprimentos'))
              }
              className={`h-8 text-xs font-semibold gap-1.5 ${
                cascadeOpen === 'suprimentos'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-700 border-slate-300 hover:border-indigo-400'
              }`}
            >
              <Package className="h-3.5 w-3.5" />
              <span>Suprimentos ({supplies.length})</span>
            </Button>

            <Button
              type="button"
              variant={cascadeOpen === 'impressoras' ? 'default' : 'outline'}
              size="sm"
              onClick={() =>
                setCascadeOpen((prev) => (prev === 'impressoras' ? '' : 'impressoras'))
              }
              className={`h-8 text-xs font-semibold gap-1.5 ${
                cascadeOpen === 'impressoras'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-700 border-slate-300 hover:border-indigo-400'
              }`}
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Impressoras ({printers.length})</span>
            </Button>

            <Button
              type="button"
              variant={cascadeOpen === 'parametros' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCascadeOpen((prev) => (prev === 'parametros' ? '' : 'parametros'))}
              className={`h-8 text-xs font-semibold gap-1.5 ${
                cascadeOpen === 'parametros'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-700 border-slate-300 hover:border-indigo-400'
              }`}
            >
              <SettingsIcon className="h-3.5 w-3.5" />
              <span>Parâmetros & Auditoria</span>
            </Button>

            {cascadeOpen && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCascadeOpen('')}
                className="h-8 text-xs text-slate-500 hover:text-slate-900"
              >
                Recolher
              </Button>
            )}
          </div>
        </div>

        {/* Accordion das 3 seções */}
        <Accordion
          type="single"
          collapsible
          value={cascadeOpen}
          onValueChange={setCascadeOpen}
          className="w-full divide-y divide-slate-100"
        >
          {/* 1. SEÇÃO EM CASCATA: SUPRIMENTOS */}
          <AccordionItem value="suprimentos" className="border-b-0 px-4">
            <AccordionTrigger className="py-3.5 hover:no-underline group">
              <div className="flex items-center gap-2.5 text-left">
                <div className="h-7 w-7 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <Package className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      Consulta & Edição de Suprimentos
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-slate-50 font-mono">
                      {supplies.length} cadastrados
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-500 font-normal">
                    Edição inline de valor de compra, rendimento em páginas, recálculo de CPP e
                    reajuste em lote.
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-5">
              <div className="bg-slate-50/60 p-3 sm:p-4 rounded-xl border border-slate-200">
                <SuppliesManagementTab
                  supplies={supplies}
                  onReload={onReloadData}
                  readOnly={readOnly}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* 2. SEÇÃO EM CASCATA: IMPRESSORAS */}
          <AccordionItem value="impressoras" className="border-b-0 px-4">
            <AccordionTrigger className="py-3.5 hover:no-underline group">
              <div className="flex items-center gap-2.5 text-left">
                <div className="h-7 w-7 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                  <Printer className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      Consulta & Cadastro de Impressoras do Parque
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-slate-50 font-mono">
                      {printers.length} modelos
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-500 font-normal">
                    Parque de máquinas, mapeamento dos 5 slots de suprimentos, custos de aquisição e
                    vida útil.
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-5">
              <div className="bg-slate-50/60 p-3 sm:p-4 rounded-xl border border-slate-200">
                <PrintersManagementTab
                  printers={printers}
                  supplies={supplies}
                  onReload={onReloadData}
                  readOnly={readOnly}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* 3. SEÇÃO EM CASCATA: PARÂMETROS & AUDITORIA */}
          <AccordionItem value="parametros" className="border-b-0 px-4">
            <AccordionTrigger className="py-3.5 hover:no-underline group">
              <div className="flex items-center gap-2.5 text-left">
                <div className="h-7 w-7 rounded-md bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                  <SettingsIcon className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      Parâmetros Globais, Trilha de Auditoria & Exportação
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-slate-50 font-mono">
                      {auditHistory.length} logs de auditoria
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-500 font-normal">
                    Mark-up padrão, vida útil padrão de 48m, histórico imutável de alterações e
                    backup JSON.
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-5">
              <div className="bg-slate-50/60 p-3 sm:p-4 rounded-xl border border-slate-200">
                <ParametersAndAuditTab
                  parametros={parametros}
                  auditHistory={auditHistory}
                  supplies={supplies}
                  printers={printers}
                  onReload={onReloadData}
                  readOnly={readOnly}
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* MODAL DE CONFIRMAÇÃO SE HOUVER SLOTS ESTRUTURAIS/ESSENCIAIS DESMARCADOS */}
      <Dialog
        open={essentialWarningModalOpen}
        onOpenChange={(open) => !open && setEssentialWarningModalOpen(false)}
      >
        <DialogContent className="max-w-md p-5">
          <DialogHeader>
            <div className="flex items-center gap-2 text-amber-600">
              <ShieldAlert className="h-5 w-5" />
              <DialogTitle className="text-sm font-bold text-slate-900">
                Confirmação de Item Essencial / Estrutural Desmarcado
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-600 pt-1">
              Você desmarcou um ou mais itens de desgaste essencial ou estrutural da composição do
              cálculo da locação:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 bg-amber-50/80 rounded-lg border-2 border-amber-300 text-amber-950 space-y-2">
              <p className="font-semibold">Itens fora da proposta:</p>
              <ul className="list-disc list-inside space-y-1 font-mono text-[11px]">
                {unconfirmedStructuralSlots.map((item) => (
                  <li key={item.slotNumber}>
                    Slot {item.slotNumber}: <strong>{item.modelo}</strong> ({item.tipo})
                  </li>
                ))}
              </ul>
              <p className="text-[11px] leading-tight font-medium pt-1 border-t border-amber-200">
                ⚠️ <strong>Atenção:</strong> Ao excluir esses insumos do cálculo, o custo de
                substituição ou reposição destas peças{' '}
                <strong>ficará sob sua responsabilidade</strong> ou deverá ser cobrado à parte do
                locatário.
              </p>
            </div>
            <p className="text-[11px] text-slate-500">
              Deseja prosseguir e gerar a proposta comercial sem o custo destes itens no CPP de
              venda?
            </p>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEssentialWarningModalOpen(false)}
              className="text-xs"
            >
              Revisar Seleção
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setEssentialWarningModalOpen(false)
                proceedGenerateProposal()
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-1.5 shadow"
            >
              Confirmar e Gerar Proposta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
