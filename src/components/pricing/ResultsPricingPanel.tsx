import { useState } from 'react'
import { FileText, Sparkles, AlertCircle, Copy, Check, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import type { PricingEngineResult, BreakEvenResult } from '@/lib/pricing-engine'
import type { ImpressoraRecord } from '@/services/pricing-module'

interface ResultsPricingPanelProps {
  calculation: PricingEngineResult
  producaoMensal: number
  vidaUtil: number
  markup: number
  locacaoMensal: number
  breakEven?: BreakEvenResult | null
  generatingProposal?: boolean
  selectedPrinter: ImpressoraRecord | null
  onGenerateProposal: () => void
  printerScenarioB?: ImpressoraRecord | null
  locacaoScenarioB?: number
  onUpdateScenarioB?: (printer: ImpressoraRecord | null, locacao: number) => void
  availablePrinters?: ImpressoraRecord[]
}

export function ResultsPricingPanel({
  calculation,
  producaoMensal,
  vidaUtil,
  markup,
  locacaoMensal,
  breakEven,
  generatingProposal = false,
  selectedPrinter,
  onGenerateProposal,
  printerScenarioB,
  locacaoScenarioB = 0,
  onUpdateScenarioB,
  availablePrinters = [],
}: ResultsPricingPanelProps) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const [showBreakEvenSettings, setShowBreakEvenSettings] = useState(false)

  const handleCopySummary = () => {
    if (!selectedPrinter) return

    const summaryText = `=========================================
JUCA CARTUCHOS — RESUMO DE PRECIFICAÇÃO DE LOCAÇÃO
=========================================
Equipamento: ${selectedPrinter.modelo} (${selectedPrinter.fabricante} - ${selectedPrinter.tecnologia})
Franquia / Produção Estimada: ${producaoMensal.toLocaleString('pt-BR')} páginas/mês
Vigência Contratual: ${vidaUtil} meses
-----------------------------------------
CPP DE VENDA HOMOLOGADO: ${calculation.formatted.cppVenda} / página
CUSTO MENSAL ESTIMADO: ${calculation.formatted.custoMensalProducao}
FATURAMENTO TOTAL MENSAL: ${calculation.formatted.faturamentoTotalMensal}
=========================================`

    navigator.clipboard
      .writeText(summaryText)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
        toast({
          title: 'Resumo copiado!',
          description: 'Resumo comercial pronto para envio ao cliente.',
        })
      })
      .catch(() => {
        toast({
          title: 'Erro ao copiar',
          description: 'Selecione o texto na tela.',
          variant: 'destructive',
        })
      })
  }

  return (
    <div className="space-y-4">
      {/* CARD HERO DE PRECIFICAÇÃO */}
      <div className="rounded-xl border-2 border-indigo-200 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-white p-6 shadow-lg space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
              Precificação Automatizada em Tempo Real
            </span>
            <h3 className="text-base font-extrabold text-white">
              Custo por Página (CPP) de Venda & Faturamento
            </h3>
          </div>
          <Badge className="bg-amber-500 text-slate-950 font-bold text-xs">
            Mark-up: {markup.toFixed(2)}x
          </Badge>
        </div>

        {/* VALORES HERO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center sm:text-left space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
              CPP de Venda Homologado (com Mark-up)
            </span>
            <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white">
              {calculation.formatted.cppVenda}
            </div>
            <p className="text-[11px] text-indigo-300">
              Custo Total Fornecedor ({calculation.formatted.cppFornecedorTotal}) ×{' '}
              {markup.toFixed(2)}x
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center sm:text-left space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
              Custo Mensal de Produção Estimada ({producaoMensal.toLocaleString('pt-BR')} págs)
            </span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">
              {calculation.formatted.custoMensalProducao}
            </div>
            {locacaoMensal > 0 && (
              <p className="text-[11px] text-slate-300">
                Faturamento Total (Locação R$ {locacaoMensal.toFixed(2)} + Páginas):{' '}
                <strong className="text-white font-mono">
                  {calculation.formatted.faturamentoTotalMensal}
                </strong>
              </p>
            )}
          </div>
        </div>

        {/* DECOMPOSIÇÃO DE CUSTOS (CPP SUPRIMENTOS + EQUIPAMENTO + SOFTWARE PRINTWAY) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs pt-1">
          <div className="bg-black/30 p-2.5 rounded-lg border border-white/5">
            <span className="text-[10px] text-slate-400 block uppercase font-medium">
              1. CPP Suprimentos:
            </span>
            <span className="font-mono font-bold text-indigo-200 text-xs">
              {calculation.formatted.cppSuprimentos}
            </span>
          </div>

          <div className="bg-black/30 p-2.5 rounded-lg border border-white/5">
            <span className="text-[10px] text-slate-400 block uppercase font-medium">
              2. CPP Equipamento ({vidaUtil}m):
            </span>
            <span className="font-mono font-bold text-indigo-200 text-xs">
              {calculation.formatted.cppEquipamento}
            </span>
          </div>

          <div className="bg-black/30 p-2.5 rounded-lg border border-white/5">
            <span className="text-[10px] text-slate-400 block uppercase font-medium">
              3. Software Printway:
            </span>
            <span
              className="font-mono font-bold text-indigo-200 text-xs"
              title={`${calculation.formatted.valorSoftwarePrintway}/mês`}
            >
              {calculation.formatted.cppSoftwarePrintway}
            </span>
            <span className="text-[9px] text-slate-400 block font-mono">
              {calculation.formatted.valorSoftwarePrintway}/mês
            </span>
          </div>

          <div className="bg-black/30 p-2.5 rounded-lg border border-white/5">
            <span className="text-[10px] text-slate-400 block uppercase font-medium">
              4. CPP Total Fornecedor:
            </span>
            <span className="font-mono font-bold text-amber-300 text-xs">
              {calculation.formatted.cppFornecedorTotal}
            </span>
          </div>

          <div className="bg-black/30 p-2.5 rounded-lg border border-white/5 col-span-2 sm:col-span-1">
            <span className="text-[10px] text-slate-400 block uppercase font-medium">
              5. Margem Mark-up:
            </span>
            <span className="font-mono font-bold text-emerald-300 text-xs">
              {markup.toFixed(2)}x sobre total
            </span>
          </div>
        </div>

        {/* LISTA COMPACTA DE SLOTS INCLUÍDOS NO CÁLCULO */}
        <div className="pt-2 border-t border-white/10 text-xs">
          <div className="flex items-center justify-between pb-1.5">
            <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
              Slots no Cálculo (
              {
                calculation.slotsEnriquecidos.filter(
                  (s) => s.visualStatus !== 'empty' && s.included,
                ).length
              }{' '}
              incluídos):
            </span>
            <span className="text-[11px] font-mono text-emerald-300 font-bold">
              Subtotal CPP Suprimentos: {calculation.formatted.cppSuprimentos}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {calculation.slotsEnriquecidos
              .filter((s) => s.visualStatus !== 'empty' && s.included)
              .map((s) => (
                <div
                  key={s.slotNumber}
                  className="bg-white/10 hover:bg-white/15 px-2 py-1 rounded text-[11px] flex items-center gap-1.5 border border-white/10"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E87722]" />
                  <span className="font-bold text-white">S{s.slotNumber}:</span>
                  <span className="text-slate-200 font-mono">{s.modelo}</span>
                  <span className="text-amber-300 font-mono text-[10px]">
                    (R$ {s.cppCalculado.toFixed(4)})
                  </span>
                </div>
              ))}
            {calculation.slotsEnriquecidos.filter((s) => s.visualStatus !== 'empty' && s.included)
              .length === 0 && (
              <span className="text-slate-400 italic text-[11px]">
                Nenhum suprimento selecionado. O CPP de suprimentos está zerado.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* BLOCO DE BREAK-EVEN / PONTO DE EQUILÍBRIO (Seção 3.6 / 11.2) */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wide">
              Análise de Ponto de Equilíbrio (Break-Even entre Cenários)
            </h4>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowBreakEvenSettings(!showBreakEvenSettings)}
            className="text-[11px] font-semibold text-indigo-600 h-6 px-2"
          >
            {showBreakEvenSettings ? 'Ocultar Parâmetros' : 'Comparar Outro Modelo'}
          </Button>
        </div>

        {/* Configuração do Modelo B para Comparação */}
        {showBreakEvenSettings && onUpdateScenarioB && (
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3 text-xs">
            <p className="text-[11px] text-slate-600">
              Selecione um segundo equipamento para calcular o ponto de equilíbrio de volume:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-700">
                  Equipamento Concorrente (Cenário B)
                </Label>
                <select
                  value={printerScenarioB?.id || ''}
                  onChange={(e) => {
                    const found = availablePrinters.find((p) => p.id === e.target.value) || null
                    onUpdateScenarioB(found, locacaoScenarioB)
                  }}
                  className="w-full h-8 text-xs rounded-md border border-slate-300 bg-white px-2"
                >
                  <option value="">Selecione para comparar...</option>
                  {availablePrinters.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.modelo} ({p.fabricante} - {p.tecnologia})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-700">
                  Locação Mensal Base (Cenário B - R$)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={locacaoScenarioB || ''}
                  onChange={(e) =>
                    onUpdateScenarioB(printerScenarioB || null, parseFloat(e.target.value) || 0)
                  }
                  placeholder="Ex: 490.14"
                  className="h-8 text-xs font-mono"
                ></Input>
              </div>
            </div>
          </div>
        )}

        {/* Resultado do Break-Even */}
        {breakEven && breakEven.valid && breakEven.paginasBreakEven !== null ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2 p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg">
              <div>
                <span className="text-[11px] font-medium text-indigo-800 block">
                  Ponto de Inflexão (Break-Even):
                </span>
                <span className="font-mono font-black text-indigo-950 text-xl">
                  {Math.round(breakEven.paginasBreakEven).toLocaleString('pt-BR')} páginas/mês
                </span>
              </div>
              <div className="text-right text-[11px] text-indigo-900 space-y-0.5">
                <div>
                  Δ Locação: <strong>R$ {breakEven.diferencaLocacao.toFixed(2)}</strong>
                </div>
                <div>
                  Δ CPP Venda: <strong>R$ {breakEven.diferencaCPP.toFixed(6)}</strong>
                </div>
              </div>
            </div>

            <p className="text-xs p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-950 font-medium leading-relaxed">
              ✓ {breakEven.recomendacao}
            </p>
          </div>
        ) : breakEven && !breakEven.valid ? (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>{breakEven.recomendacao}</span>
          </div>
        ) : (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-xs text-center">
            Defina um segundo cenário para visualizar a curva de ponto de equilíbrio entre
            tecnologias.
          </div>
        )}
      </div>

      {/* AVISOS / BLOQUEIOS DE INTEGRIDADE (Seção 8.1 / 18) */}
      {!calculation.valid && (
        <div className="rounded-xl border-2 border-rose-300 bg-rose-50 p-4 space-y-2">
          <div className="flex items-center gap-2 text-rose-900 font-bold text-xs uppercase">
            <AlertCircle className="h-4 w-4 text-rose-600" />
            <span>Bloqueio de Integridade Cadastral (Proposta Impedida)</span>
          </div>
          <ul className="list-disc list-inside text-xs text-rose-800 space-y-1">
            {calculation.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* BOTÕES DE AÇÃO: COPIAR RESUMO & GERAR PROPOSTA */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopySummary}
          disabled={!selectedPrinter}
          className="text-xs font-semibold text-slate-700 gap-1.5"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <Copy className="h-3.5 w-3.5 text-indigo-600" />
          )}
          <span>{copied ? 'Copiado!' : 'Copiar Resumo da Proposta'}</span>
        </Button>

        <Button
          type="button"
          onClick={onGenerateProposal}
          disabled={!calculation.valid || generatingProposal}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm px-6 h-10 shadow-md gap-2"
        >
          <FileText className="h-4 w-4" />
          <span>{generatingProposal ? 'Gerando Proposta...' : 'GERAR PROPOSTA'}</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
