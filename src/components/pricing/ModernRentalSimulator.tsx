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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { RentalCustomerSelect } from '@/components/RentalCustomerSelect'
import type { RentalCustomerSelection } from '@/components/RentalCustomerSelect'
import { PrinterSelectCombo } from './PrinterSelectCombo'
import { SupplySlotsGrid } from './SupplySlotsGrid'
import { ResultsPricingPanel } from './ResultsPricingPanel'
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
import { updateImpressora, updateSuprimento } from '@/services/pricing-module'
import { createRentalQuote } from '@/services/rental'
import type { RentalQuote } from '@/types'

interface ModernRentalSimulatorProps {
  printers: ImpressoraRecord[]
  supplies: SuprimentoRecord[]
  parametros: ParametrosGlobais
  onQuoteGenerated: (quote: RentalQuote) => void
  onReloadData: () => void
  onOpenSupplyEdit?: (supplyModel: string) => void
  readOnly?: boolean
}

export function ModernRentalSimulator({
  printers,
  supplies,
  parametros,
  onQuoteGenerated,
  onReloadData,
  onOpenSupplyEdit,
  readOnly = false,
}: ModernRentalSimulatorProps) {
  const { toast } = useToast()

  // Cliente / Locatário
  const [customer, setCustomer] = useState<RentalCustomerSelection>({
    cliente_nome_livre: '',
    cliente_telefone: '',
    cliente_documento: '',
    cliente_endereco: '',
  })

  // Equipamento Selecionado
  const [selectedPrinter, setSelectedPrinter] = useState<ImpressoraRecord | null>(null)

  // Cenário B para Comparação / Break-Even
  const [printerScenarioB, setPrinterScenarioB] = useState<ImpressoraRecord | null>(null)
  const [locacaoScenarioB, setLocacaoScenarioB] = useState<number>(490.14)

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
    setEquipPriceCustom(
      printer.valor_compra !== null && printer.valor_compra !== undefined
        ? String(printer.valor_compra)
        : '',
    )
    setVidaUtilCustom(printer.vida_util_meses || parametros.vida_util_padrao_meses || 48)
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
      }
    })
  }, [selectedPrinter, supplies])

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
      setSelectedPrinter(updated)
      onReloadData()
      toast({ title: `Slot ${slotNumber} atualizado com sucesso!` })
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

    setGeneratingQuote(true)
    try {
      // Monta suprimentos vinculados estruturados
      const suprimentosPayload = calculation.slotsEnriquecidos
        .filter((s) => s.visualStatus !== 'empty')
        .map((s) => ({
          slot: s.slotNumber,
          modelo_suprimento: s.modelo,
          tipo: s.tipo,
          valor_compra: s.valorCompra,
          rendimento_paginas: s.rendimentoPaginas,
          cpp_calculado: s.cppCalculado,
          is_provisao: s.isProvision,
          integrado_chassi: s.integratedToChassis,
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
          // Congelamento de memória de cálculo conforme seção 11.1
          pricingSnapshot: {
            impressora: {
              id: selectedPrinter.id,
              modelo: selectedPrinter.modelo,
              fabricante: selectedPrinter.fabricante,
              tecnologia: selectedPrinter.tecnologia,
              valor_compra: Number(equipPriceCustom) || 0,
            },
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
          readOnly={readOnly}
          onUpdateSlotSupply={handleUpdateSlotSupply}
          onUpdateSlotValues={handleUpdateSlotValues}
          onOpenSupplyEditModal={onOpenSupplyEdit}
        />
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
    </div>
  )
}
