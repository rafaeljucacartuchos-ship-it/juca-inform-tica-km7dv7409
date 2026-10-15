import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Printer,
  Save,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Info,
  DollarSign,
  TrendingUp,
  Percent,
  Check,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'
import { PrinterSelectCombo } from './PrinterSelectCombo'
import type {
  ImpressoraRecord,
  SuprimentoRecord,
  ParametrosGlobais,
} from '@/services/pricing-module'
import { saveOfficialPricing, getImpressoraById } from '@/services/pricing-module'

interface SimplifiedPrinterPricingPanelProps {
  printers: ImpressoraRecord[]
  supplies: SuprimentoRecord[]
  parametros: ParametrosGlobais
  selectedPrinter: ImpressoraRecord | null
  onSelectPrinter: (printer: ImpressoraRecord) => void
  onPricingSaved?: () => void
  readOnly?: boolean
}

export function SimplifiedPrinterPricingPanel({
  printers,
  supplies,
  parametros,
  selectedPrinter,
  onSelectPrinter,
  onPricingSaved,
  readOnly = false,
}: SimplifiedPrinterPricingPanelProps) {
  const { toast } = useToast()
  const { isAdmin } = usePermissions()

  // Seção recolhível de custos
  const [showCostDetails, setShowCostDetails] = useState(false)

  // Estados locais do modelo selecionado
  const [franquiaPaginas, setFranquiaPaginas] = useState<number>(1000)
  const [prazoMeses, setPrazoMeses] = useState<number>(12)
  const [paybackMeses, setPaybackMeses] = useState<number>(24)

  // Custos editáveis da impressora
  const [custoCompra, setCustoCompra] = useState<string>('')
  const [custoPrintway, setCustoPrintway] = useState<string>('')
  const [vidaUtilMeses, setVidaUtilMeses] = useState<number>(48)

  // Preço final digitado livremente pelo administrador
  const [precoFinalInput, setPrecoFinalInput] = useState<string>('')

  // Controle de alterações não salvas e proteção de concorrência
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [pendingPrinterToSwitch, setPendingPrinterToSwitch] = useState<ImpressoraRecord | null>(
    null,
  )
  const [unsavedWarningModalOpen, setUnsavedWarningModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [savedSuccessFlash, setSavedSuccessFlash] = useState(false)
  const initialLoadRef = useRef(true)

  // Popula os campos quando o modelo é selecionado ou alterado
  useEffect(() => {
    if (!selectedPrinter) {
      setCustoCompra('')
      setCustoPrintway('')
      setPrecoFinalInput('')
      setHasUnsavedChanges(false)
      return
    }

    initialLoadRef.current = true
    const premissas = selectedPrinter.premissas_precificacao

    // 1. Franquia e prazo
    setFranquiaPaginas(premissas?.franquia_paginas || parametros.producao_mensal_referencia || 1000)
    setPrazoMeses(premissas?.prazo_meses || 12)
    setPaybackMeses(premissas?.payback_meses || 24)

    // 2. Custos do modelo
    setCustoCompra(selectedPrinter.valor_compra != null ? String(selectedPrinter.valor_compra) : '')
    setCustoPrintway(
      selectedPrinter.custo_mensal_software != null
        ? String(selectedPrinter.custo_mensal_software)
        : '',
    )
    setVidaUtilMeses(selectedPrinter.vida_util_meses || parametros.vida_util_padrao_meses || 48)

    // 3. Preço final da locação
    if (selectedPrinter.preco_oficial != null && selectedPrinter.preco_oficial > 0) {
      setPrecoFinalInput(selectedPrinter.preco_oficial.toFixed(2))
    } else {
      setPrecoFinalInput('')
    }

    setHasUnsavedChanges(false)
    setTimeout(() => {
      initialLoadRef.current = false
    }, 50)
  }, [selectedPrinter?.id, parametros])

  // Identifica alterações não salvas
  const markChanged = () => {
    if (!initialLoadRef.current) {
      setHasUnsavedChanges(true)
    }
  }

  // Mapa de suprimentos para consulta de custos dos insumos
  const suppliesMap = useMemo(() => {
    const map = new Map<string, SuprimentoRecord>()
    supplies.forEach((s) => map.set(s.id, s))
    return map
  }, [supplies])

  // Custo por página (CPP) dos suprimentos vinculados
  const { cppSuprimentosTotal, listaInsumosComCusto } = useMemo(() => {
    if (!selectedPrinter) return { cppSuprimentosTotal: 0, listaInsumosComCusto: [] }

    const slotKeys: (keyof ImpressoraRecord)[] = [
      'suprimento_1',
      'suprimento_2',
      'suprimento_3',
      'suprimento_4',
      'suprimento_5',
    ]

    let cppSoma = 0
    const insumos: Array<{
      slot: number
      modelo: string
      tipo: string
      valorCompra: number
      rendimento: number
      cpp: number
    }> = []

    slotKeys.forEach((key, idx) => {
      const supId = selectedPrinter[key] as string | undefined
      if (supId && suppliesMap.has(supId)) {
        const sup = suppliesMap.get(supId)!
        const valor = Number(sup.valor_compra) || 0
        const rend = Number(sup.rendimento_paginas) || 0
        const cpp = rend > 0 && valor > 0 ? valor / rend : 0
        cppSoma += cpp
        insumos.push({
          slot: idx + 1,
          modelo: sup.modelo_suprimento,
          tipo: sup.tipo,
          valorCompra: valor,
          rendimento: rend,
          cpp,
        })
      }
    })

    return { cppSuprimentosTotal: cppSoma, listaInsumosComCusto: insumos }
  }, [selectedPrinter, suppliesMap])

  // CÁLCULOS FINANCEIROS NA MESMA BASE (MENSALIDADE):
  // 1. Custo mensal do equipamento: valor_compra ÷ paybackMeses (ou vida útil se payback for zero)
  const mesesAmortizacao = paybackMeses > 0 ? paybackMeses : vidaUtilMeses > 0 ? vidaUtilMeses : 48
  const compraNum = parseFloat(custoCompra.replace(',', '.')) || 0
  const custoEquipamentoMensal = compraNum > 0 ? compraNum / mesesAmortizacao : 0

  // 2. Custo mensal do software printway: valor em R$/mês
  const custoSoftwareMensal = parseFloat(custoPrintway.replace(',', '.')) || 0

  // 3. Custo mensal de suprimentos: cppSuprimentosTotal × franquiaPaginas
  const custoSuprimentosMensal = cppSuprimentosTotal * franquiaPaginas

  // 4. Custo total mensal considerado
  const custoTotalMensal = custoEquipamentoMensal + custoSoftwareMensal + custoSuprimentosMensal

  // 5. Preço final digitado pelo administrador
  const precoFinalNum = parseFloat(precoFinalInput.replace(',', '.'))
  const precoFinalValido = Number.isFinite(precoFinalNum) && precoFinalNum > 0

  // 6. Sugestão automática de preço (apenas informativa secundária, com markup padrão de revenda)
  const markupPadrao = parametros.mark_up_revenda || 1.45
  const precoSugeridoSecundario = custoTotalMensal > 0 ? custoTotalMensal * markupPadrao : 0

  // 7. Lucro estimado em R$, Margem sobre preço em %, e Markup multiplicador do custo
  const {
    lucroEstimado,
    margemLucroPct,
    markupCalculado,
    statusResultado,
    textoStatus,
    corBadgeStatus,
  } = useMemo(() => {
    if (!precoFinalValido || custoTotalMensal <= 0) {
      return {
        lucroEstimado: null,
        margemLucroPct: null,
        markupCalculado: null,
        statusResultado: 'incalculavel',
        textoStatus: 'Não calculável (informe custo e preço final)',
        corBadgeStatus: 'bg-slate-100 text-slate-700 border-slate-300',
      }
    }

    // Fórmulas exatas especificadas:
    // lucro = preço − custo
    // margem = lucro ÷ preço × 100
    // markup = preço ÷ custo
    const lucro = precoFinalNum - custoTotalMensal
    const margem = precoFinalNum > 0 ? (lucro / precoFinalNum) * 100 : 0
    const markup = custoTotalMensal > 0 ? precoFinalNum / custoTotalMensal : 0

    let status = 'lucro'
    let texto = 'Lucro estimado'
    let cor = 'bg-emerald-50 text-emerald-800 border-emerald-200'

    if (Math.abs(lucro) < 0.01) {
      status = 'equilibrio'
      texto = 'Ponto de equilíbrio (R$ 0,00)'
      cor = 'bg-amber-50 text-amber-800 border-amber-200'
    } else if (lucro < 0) {
      status = 'prejuizo'
      texto = 'Prejuízo estimado'
      cor = 'bg-rose-50 text-rose-800 border-rose-200'
    }

    return {
      lucroEstimado: lucro,
      margemLucroPct: margem,
      markupCalculado: markup,
      statusResultado: status,
      textoStatus: texto,
      corBadgeStatus: cor,
    }
  }, [precoFinalValido, precoFinalNum, custoTotalMensal])

  // Formatação de moeda BRL
  const moeda = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val)) return '—'
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  // Intercepta troca de modelo para avisar sobre alterações não salvas
  const handleSelectPrinterWithWarning = (printer: ImpressoraRecord) => {
    if (hasUnsavedChanges) {
      setPendingPrinterToSwitch(printer)
      setUnsavedWarningModalOpen(true)
      return
    }
    onSelectPrinter(printer)
  }

  const confirmSwitchPrinter = () => {
    if (pendingPrinterToSwitch) {
      setHasUnsavedChanges(false)
      onSelectPrinter(pendingPrinterToSwitch)
      setPendingPrinterToSwitch(null)
    }
    setUnsavedWarningModalOpen(false)
  }

  // SALVAR PRECIFICAÇÃO NO BANCO
  const handleSavePricing = async () => {
    if (!selectedPrinter) return
    if (!isAdmin) {
      toast({
        title: 'Acesso restrito',
        description: 'Apenas administradores podem salvar a precificação oficial.',
        variant: 'destructive',
      })
      return
    }

    if (!precoFinalValido) {
      toast({
        title: 'Preço final inválido',
        description: 'Digite um valor de locação maior que zero antes de salvar.',
        variant: 'destructive',
      })
      return
    }

    setIsSaving(true)
    try {
      // Salva no banco de dados na coleção impressoras:
      // - preco_oficial
      // - margem_referencia
      // - premissas_precificacao (com custos, lucro e premissas reproduzíveis)
      // Proteção de concorrência passando a data de updated esperada
      await saveOfficialPricing({
        printerId: selectedPrinter.id,
        newPrice: Math.round(precoFinalNum * 100) / 100,
        newMargin: margemLucroPct !== null ? Math.round(margemLucroPct * 100) / 100 : 0,
        expectedUpdatedAt: selectedPrinter.updated,
        updatedCustos: {
          valor_compra: compraNum,
          custo_mensal_software: custoSoftwareMensal,
          vida_util_meses: vidaUtilMeses,
        },
        premissas: {
          custo_total_mensal: Math.round(custoTotalMensal * 100) / 100,
          custo_equipamento_mensal: Math.round(custoEquipamentoMensal * 100) / 100,
          custo_suprimentos_mensal: Math.round(custoSuprimentosMensal * 100) / 100,
          custo_software_mensal: Math.round(custoSoftwareMensal * 100) / 100,
          cpp_suprimentos: cppSuprimentosTotal,
          franquia_paginas: franquiaPaginas,
          prazo_meses: prazoMeses,
          payback_meses: paybackMeses,
          vida_util_meses: vidaUtilMeses,
          markup_calculado:
            markupCalculado !== null ? Math.round(markupCalculado * 1000) / 1000 : null,
          lucro_estimado_reais:
            lucroEstimado !== null ? Math.round(lucroEstimado * 100) / 100 : null,
          margem_porcentagem:
            margemLucroPct !== null ? Math.round(margemLucroPct * 100) / 100 : null,
        },
      })

      // Sucesso confirmado após gravação efetiva no banco
      setHasUnsavedChanges(false)
      setSavedSuccessFlash(true)
      setTimeout(() => setSavedSuccessFlash(false), 3000)

      toast({
        title: 'Precificação salva com sucesso!',
        description: `Modelo ${selectedPrinter.modelo}: Preço oficial definido em ${moeda(precoFinalNum)}/mês.`,
      })

      if (onPricingSaved) {
        onPricingSaved()
      }
    } catch (err: any) {
      console.error('Erro ao salvar precificação:', err)
      // Em erro: mantém os dados digitados na tela e informa que não foram salvos
      toast({
        title: 'Não foi possível salvar a precificação',
        description:
          err.message ||
          'Os dados digitados continuam na tela para revisão. Confira a conexão e tente novamente.',
        variant: 'destructive',
      })

      // Se for conflito de concorrência, recarrega o registro para que o usuário veja
      if (err.message && err.message.includes('modificado por outro usuário')) {
        try {
          const fresh = await getImpressoraById(selectedPrinter.id)
          if (fresh) {
            onSelectPrinter(fresh)
          }
        } catch {
          /* intentionally ignored */
        }
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-6">
      {/* CABEÇALHO DA TELA SIMPLIFICADA */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-indigo-600" />
            Precificação do Modelo de Impressora
          </h2>
          <p className="text-xs text-slate-500">
            Defina livremente o preço final da locação do modelo, confira os custos e visualize o
            lucro estimado.
          </p>
        </div>

        {selectedPrinter && (
          <div className="flex items-center gap-2">
            {selectedPrinter.preco_oficial && selectedPrinter.preco_oficial > 0 ? (
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-xs gap-1">
                <Check className="h-3 w-3" />
                Oficial: {moeda(selectedPrinter.preco_oficial)}/mês
              </Badge>
            ) : (
              <Badge variant="outline" className="text-slate-500 border-slate-300 text-xs">
                Sem precificação cadastrada
              </Badge>
            )}
            {hasUnsavedChanges && (
              <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs gap-1 animate-pulse">
                <AlertTriangle className="h-3 w-3 text-amber-600" />
                Alterações não salvas
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* 1. SELEÇÃO DO MODELO DA IMPRESSORA */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold text-slate-800 uppercase tracking-wide">
            1. Selecionar Modelo da Impressora
          </Label>
          {selectedPrinter?.premissas_precificacao?.usuario_responsavel && (
            <span className="text-[11px] text-slate-400">
              Última precificação salva por:{' '}
              <strong>{selectedPrinter.premissas_precificacao.usuario_responsavel}</strong>
              {selectedPrinter.premissas_precificacao.data_precificacao && (
                <>
                  {' '}
                  em{' '}
                  {new Date(
                    selectedPrinter.premissas_precificacao.data_precificacao,
                  ).toLocaleDateString('pt-BR')}
                </>
              )}
            </span>
          )}
        </div>
        <PrinterSelectCombo
          printers={printers.filter((p) => p.ativo !== false)}
          selectedPrinter={selectedPrinter}
          onSelectPrinter={handleSelectPrinterWithWarning}
          disabled={readOnly}
        />
      </div>

      {selectedPrinter ? (
        <>
          {/* 2. GRADE SIMPLIFICADA: APENAS AS INFORMAÇÕES ESSENCIAIS VISÍVEIS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* CARD 1: CUSTO TOTAL MENSAL */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
                Custo Total Considerado (por mês)
              </span>
              <div className="text-2xl sm:text-3xl font-black font-mono text-slate-800">
                {moeda(custoTotalMensal)}
              </div>
              <p className="text-[11px] text-slate-500">
                Equipamento + Software + Insumos ({franquiaPaginas.toLocaleString('pt-BR')}{' '}
                págs/mês)
              </p>
            </div>

            {/* CARD 2: PREÇO FINAL DA LOCAÇÃO (EDITÁVEL LIVREMENTE) */}
            <div className="bg-indigo-50/60 border-2 border-indigo-300 rounded-xl p-4 space-y-1 relative">
              <Label
                htmlFor="preco-final-input"
                className="text-[11px] font-bold uppercase tracking-wider text-indigo-900 block"
              >
                Preço Final da Locação (por mês) *
              </Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-500 text-sm">
                  R$
                </span>
                <Input
                  id="preco-final-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={precoFinalInput}
                  onChange={(e) => {
                    setPrecoFinalInput(e.target.value)
                    markChanged()
                  }}
                  placeholder="0,00"
                  disabled={readOnly || !isAdmin}
                  className="pl-9 h-11 text-xl sm:text-2xl font-black font-mono text-indigo-950 bg-white border-indigo-400 focus:border-indigo-600 focus:ring-indigo-500"
                />
              </div>
              {precoSugeridoSecundario > 0 && (
                <p className="text-[11px] text-indigo-700/80 pt-1">
                  Sugestão com markup ({markupPadrao.toFixed(2)}x):{' '}
                  <strong>{moeda(precoSugeridoSecundario)}/mês</strong> (informativo)
                </p>
              )}
            </div>

            {/* CARD 3: LUCRO ESTIMADO E MARGEM */}
            <div
              className={`rounded-xl border p-4 space-y-1 ${
                statusResultado === 'prejuizo'
                  ? 'bg-rose-50/80 border-rose-300'
                  : statusResultado === 'lucro'
                    ? 'bg-emerald-50/80 border-emerald-300'
                    : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 block">
                  Lucro Estimado (por mês)
                </span>
                <Badge className={`text-[10px] font-bold ${corBadgeStatus}`}>{textoStatus}</Badge>
              </div>

              <div
                className={`text-2xl sm:text-3xl font-black font-mono ${
                  statusResultado === 'prejuizo'
                    ? 'text-rose-700'
                    : statusResultado === 'lucro'
                      ? 'text-emerald-700'
                      : 'text-slate-700'
                }`}
              >
                {lucroEstimado !== null ? moeda(lucroEstimado) : '—'}
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                <span className="text-slate-600 font-medium">
                  Margem de lucro:{' '}
                  <strong className="text-slate-900 font-mono">
                    {margemLucroPct !== null ? `${margemLucroPct.toFixed(1)}%` : 'Não calculável'}
                  </strong>
                </span>
                <span
                  className="text-slate-500 font-mono text-[11px]"
                  title="Markup multiplicador do custo (apenas leitura)"
                >
                  Markup:{' '}
                  <strong className="text-slate-800">
                    {markupCalculado !== null ? `${markupCalculado.toFixed(2)}x` : '—'}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* 3. SEÇÃO RECOLHÍVEL: VER E EDITAR COMPOSIÇÃO DOS CUSTOS */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowCostDetails(!showCostDetails)}
              className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Ver e editar composição dos custos
                </span>
                <Badge variant="outline" className="text-[10px] text-slate-600 bg-white">
                  {moeda(custoTotalMensal)}/mês total
                </Badge>
              </div>
              <div className="flex items-center gap-1 text-xs text-indigo-600 font-semibold">
                <span>{showCostDetails ? 'Ocultar detalhes' : 'Consultar e editar'}</span>
                {showCostDetails ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </button>

            {showCostDetails && (
              <div className="p-4 bg-white border-t border-slate-200 space-y-4 text-xs">
                <p className="text-slate-500 text-[11px]">
                  Os custos estão divididos e claramente identificados pela sua unidade (mensal ou
                  por página impressa):
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Custo de Aquisição do Equipamento */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-700">
                      Preço de compra do equipamento (R$)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={custoCompra}
                      onChange={(e) => {
                        setCustoCompra(e.target.value)
                        markChanged()
                      }}
                      disabled={readOnly || !isAdmin}
                      placeholder="Ex: 2500.00"
                      className="h-8 text-xs font-mono"
                    />
                    <p className="text-[10px] text-slate-400">
                      Amortização: {moeda(custoEquipamentoMensal)}/mês (em {mesesAmortizacao} meses)
                    </p>
                  </div>

                  {/* Custo do Software de Gerenciamento Printway */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-700">
                      Software Printway (R$ por mês)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={custoPrintway}
                      onChange={(e) => {
                        setCustoPrintway(e.target.value)
                        markChanged()
                      }}
                      disabled={readOnly || !isAdmin}
                      placeholder="0.00"
                      className="h-8 text-xs font-mono"
                    />
                    <p className="text-[10px] text-slate-400">
                      Custo fixo mensal de bilhetagem/gestão
                    </p>
                  </div>

                  {/* Franquia mensal de referência para o cálculo */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-700">
                      Franquia de páginas mensal considerada
                    </Label>
                    <Input
                      type="number"
                      step="100"
                      min="1"
                      value={franquiaPaginas}
                      onChange={(e) => {
                        setFranquiaPaginas(parseInt(e.target.value, 10) || 1)
                        markChanged()
                      }}
                      disabled={readOnly || !isAdmin}
                      className="h-8 text-xs font-mono"
                    />
                    <p className="text-[10px] text-slate-400">
                      Volume utilizado na projeção do custo de insumos
                    </p>
                  </div>
                </div>

                {/* Sub-tabela de Insumos / Suprimentos Vinculados */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                    <span className="font-semibold text-slate-700 text-[11px] uppercase tracking-wide">
                      Insumos Vinculados ({listaInsumosComCusto.length})
                    </span>
                    <span className="font-mono text-slate-700 font-bold text-[11px]">
                      CPP Insumos: R${' '}
                      {cppSuprimentosTotal.toLocaleString('pt-BR', {
                        minimumFractionDigits: 6,
                        maximumFractionDigits: 6,
                      })}{' '}
                      / pág ( = {moeda(custoSuprimentosMensal)}/mês na franquia)
                    </span>
                  </div>

                  {listaInsumosComCusto.length === 0 ? (
                    <div className="p-3 text-slate-400 text-center text-xs">
                      Nenhum suprimento com custo homologado vinculado a este modelo.
                    </div>
                  ) : (
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-500">
                          <th className="p-2 text-left">Insumo</th>
                          <th className="p-2 text-left">Tipo</th>
                          <th className="p-2 text-right">Compra</th>
                          <th className="p-2 text-right">Rendimento</th>
                          <th className="p-2 text-right">Custo p/ pág (CPP)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {listaInsumosComCusto.map((item) => (
                          <tr key={item.slot} className="hover:bg-slate-50/70">
                            <td className="p-2 font-medium text-slate-800">{item.modelo}</td>
                            <td className="p-2 text-slate-500">{item.tipo}</td>
                            <td className="p-2 text-right font-mono">{moeda(item.valorCompra)}</td>
                            <td className="p-2 text-right font-mono">
                              {item.rendimento.toLocaleString('pt-BR')} págs
                            </td>
                            <td className="p-2 text-right font-mono font-semibold text-slate-700">
                              R${' '}
                              {item.cpp.toLocaleString('pt-BR', {
                                minimumFractionDigits: 6,
                                maximumFractionDigits: 6,
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 4. BOTÃO PRINCIPAL: SALVAR PRECIFICAÇÃO */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="text-xs text-slate-500">
              {savedSuccessFlash && (
                <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                  Precificação salva com sucesso no banco de dados!
                </span>
              )}
            </div>

            <Button
              type="button"
              onClick={handleSavePricing}
              disabled={isSaving || readOnly || !isAdmin || !precoFinalValido}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm px-6 h-10 shadow-sm gap-2"
            >
              <Save className={`h-4 w-4 ${isSaving ? 'animate-spin' : ''}`} />
              <span>{isSaving ? 'Salvando precificação...' : 'Salvar precificação'}</span>
            </Button>
          </div>
        </>
      ) : (
        <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
          <Printer className="h-8 w-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">
            Nenhum modelo de impressora selecionado
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Selecione uma impressora no campo acima para carregar os custos, definir o preço final e
            salvar.
          </p>
        </div>
      )}

      {/* DIÁLOGO DE AVISO DE ALTERAÇÕES NÃO SALVAS AO TROCAR DE MODELO */}
      <Dialog open={unsavedWarningModalOpen} onOpenChange={setUnsavedWarningModalOpen}>
        <DialogContent className="max-w-md p-5">
          <DialogHeader>
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle className="text-base font-bold text-slate-900">
                Alterações não salvas
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-600 pt-1">
              Você alterou o preço ou custos do modelo <strong>{selectedPrinter?.modelo}</strong>{' '}
              sem salvar.
            </DialogDescription>
          </DialogHeader>

          <p className="text-xs text-slate-600 py-2">
            Se você trocar de modelo agora, os valores alterados não serão persistidos no banco de
            dados. Deseja descartar as alterações e continuar?
          </p>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setUnsavedWarningModalOpen(false)}
              className="text-xs"
            >
              Continuar editando
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={confirmSwitchPrinter}
              className="text-xs"
            >
              Descartar e trocar de modelo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
