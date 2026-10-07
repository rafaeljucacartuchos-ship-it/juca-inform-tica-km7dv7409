import { usePermissions } from '@/hooks/use-permissions'
import { useState, useEffect, useRef } from 'react'
import reservePb from '@/lib/pocketbase/client'
import { FileText, Sparkles, AlertCircle, Copy, Check, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import type { PricingEngineResult, BreakEvenResult } from '@/lib/pricing-engine'
import type { ImpressoraRecord } from '@/services/pricing-module'

interface ResultsPricingPanelProps {
  fund: ReserveState
  calculation: PricingEngineResult
  producaoMensal: number
  contratoMeses?: number
  valorCompra?: number
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
  fund,
  calculation,
  producaoMensal,
  contratoMeses = 0,
  valorCompra = 0,
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
  const { isAdmin } = usePermissions()
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const [showBreakEvenSettings, setShowBreakEvenSettings] = useState(false)

  const [usoSimulado, setUsoSimulado] = useState('')
  const usoPaginas = usoSimulado === '' ? producaoMensal : Number(usoSimulado)
  const usoValido = Number.isFinite(usoPaginas) && usoPaginas >= 0 && Number.isInteger(usoPaginas)
  const excedentes = usoValido ? Math.max(0, usoPaginas - producaoMensal) : 0
  const valorExcedente = excedentes * calculation.cppVenda
  const totalComExcedente = calculation.faturamentoTotalMensal + valorExcedente
  const custoMensalEstimado = calculation.cppFornecedorTotal * producaoMensal
  const receitaPrevista = calculation.faturamentoTotalMensal
  const resultadoParcial = receitaPrevista - custoMensalEstimado
  const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const margemParcial = receitaPrevista > 0 ? (resultadoParcial / receitaPrevista) * 100 : 0
  const dadosValidos = calculation.valid && !!selectedPrinter
  const handleCopySummary = () => {
    if (!selectedPrinter) return

    const summaryText = `=========================================
JUCA CARTUCHOS — RESUMO DE PRECIFICAÇÃO DE LOCAÇÃO
=========================================
Equipamento: ${selectedPrinter.modelo} (${selectedPrinter.fabricante} - ${selectedPrinter.tecnologia})
Franquia incluída na mensalidade: ${producaoMensal.toLocaleString('pt-BR')} páginas/mês
Vida útil de referência: ${vidaUtil} meses (separada do payback e do contrato)
-----------------------------------------
CPP DE VENDA SIMULADO: ${calculation.formatted.cppVenda} / página
COMPONENTE DE FORMAÇÃO DA FRANQUIA (não somar novamente): ${calculation.formatted.custoMensalProducao}
MENSALIDADE COM FRANQUIA INCLUÍDA: ${calculation.formatted.faturamentoTotalMensal}
EXCEDENTE: ${calculation.formatted.cppVenda} por página acima da franquia
Total do mês = mensalidade + máximo(0, páginas do mês − franquia) × tarifa excedente.
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
      {isAdmin && <RentalReserveAdmin fund={fund} />}
      {isAdmin && (
        <AdminRentalProfit
          key={selectedPrinter?.id}
          calculation={calculation}
          producaoMensal={producaoMensal}
          contratoMeses={contratoMeses}
          valorCompra={valorCompra}
          valido={dadosValidos}
          reservaPagina={fund.rate ?? 0}
        />
      )}
      <section className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-3">
        <h3 className="font-bold">Franquia contratada + excedente</h3>
        <p className="text-sm">
          {producaoMensal.toLocaleString('pt-BR')} páginas incluídas por mês por{' '}
          {dadosValidos ? moeda(receitaPrevista) : 'valor a calcular'}. Excedente:{' '}
          {calculation.formatted.cppVenda} por página.
        </p>
        <label className="block text-sm font-semibold">
          Páginas no mês — simulação
          <Input
            type="number"
            min="0"
            step="1"
            value={usoSimulado}
            placeholder={String(producaoMensal)}
            onChange={(e) => setUsoSimulado(e.target.value)}
            className="mt-1 bg-white max-w-xs"
          />
        </label>
        {!usoValido && (
          <p role="alert" className="text-red-700">
            Informe uma quantidade inteira de páginas, igual ou maior que zero.
          </p>
        )}
        <div className="grid sm:grid-cols-3 gap-3 text-sm">
          <div>
            Páginas excedentes
            <strong className="block">
              {dadosValidos && usoValido ? excedentes.toLocaleString('pt-BR') : '—'}
            </strong>
          </div>
          <div>
            Valor do excedente
            <strong className="block">
              {dadosValidos && usoValido ? moeda(valorExcedente) : '—'}
            </strong>
          </div>
          <div>
            Total mensal simulado
            <strong className="block">
              {dadosValidos && usoValido ? moeda(totalComExcedente) : '—'}
            </strong>
          </div>
        </div>
        <p className="text-xs">
          Até a franquia, vale a mensalidade contratada. Só páginas acima da franquia geram
          excedente. Esta simulação não registra leitura, cobrança nem recebimento. Tarifa excedente
          sugerida pelo CPP de venda atual; prevalecem as condições do contrato.
        </p>
      </section>
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer font-semibold">
          Abrir composição do preço e comparação
        </summary>
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
                CPP de Venda Simulado (com Mark-up)
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
                Componente da franquia referente às páginas (
                {producaoMensal.toLocaleString('pt-BR')} págs)
              </span>
              <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">
                {calculation.formatted.custoMensalProducao}
              </div>
              {locacaoMensal > 0 && (
                <p className="text-[11px] text-slate-300">
                  Mensalidade da franquia (base R$ {locacaoMensal.toFixed(2)} + componente de
                  páginas):{' '}
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
                2. Equipamento no CPP:
              </span>
              <span className="font-mono font-bold text-indigo-200 text-xs">
                {calculation.formatted.cppEquipamento}
              </span>
            </div>

            <div className="bg-black/30 p-2.5 rounded-lg border border-white/5">
              <span className="text-[10px] text-slate-400 block uppercase font-medium">
                3. Printway no CPP:
              </span>
              <span
                className="font-mono font-bold text-indigo-200 text-xs"
                title={`${calculation.formatted.valorSoftwarePrintway}/mês`}
              >
                {calculation.formatted.cppSoftwarePrintway}
              </span>
              <span className="text-[9px] text-slate-400 block font-mono">
                {calculation.formatted.valorSoftwarePrintway}/mês incluído na base
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
                5. Fator de acréscimo:
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
      </details>
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

function AdminRentalProfit({
  reservaPagina,
  calculation,
  producaoMensal,
  contratoMeses,
  valorCompra,
  valido,
}: {
  calculation: PricingEngineResult
  producaoMensal: number
  contratoMeses: number
  valorCompra: number
  valido: boolean
  reservaPagina: number
}) {
  const { isAdmin } = usePermissions()
  const [margemDesejada, setMargemDesejada] = useState('')
  const [impostos, setImpostos] = useState('')
  const [despesaMensal, setDespesaMensal] = useState('')
  const [despesaInicial, setDespesaInicial] = useState('')
  const [origem, setOrigem] = useState('parque')
  const [custoAtendimento, setCustoAtendimento] = useState('')
  const [implantacao, setImplantacao] = useState('')
  const [foraCidade, setForaCidade] = useState(false)
  const [viagemVisita, setViagemVisita] = useState('')
  const [viagemInicial, setViagemInicial] = useState('')
  if (!isAdmin) return null
  const entradas = [
    { nome: 'Impostos sobre receita', valor: impostos, id: 'profit-tax' },
    { nome: 'Outras despesas mensais', valor: despesaMensal, id: 'profit-monthly' },
    { nome: 'Outras despesas iniciais', valor: despesaInicial, id: 'profit-initial' },
    { nome: 'Custo interno por atendimento', valor: custoAtendimento, id: 'profit-service' },
    { nome: 'Implantação técnica inicial', valor: implantacao, id: 'profit-install' },
    ...(foraCidade
      ? [
          { nome: 'Deslocamento por atendimento', valor: viagemVisita, id: 'profit-trip-service' },
          { nome: 'Deslocamento da implantação', valor: viagemInicial, id: 'profit-trip-install' },
        ]
      : []),
  ]
  const pendentes = entradas.filter((e) => e.valor.trim() === '')
  const completos = pendentes.length === 0
  const custosValidos =
    entradas.every(
      (e) => e.valor === '' || (Number.isFinite(Number(e.valor)) && Number(e.valor) >= 0),
    ) && Number(impostos) <= 100
  const validoFinal =
    valido &&
    custosValidos &&
    Number.isInteger(contratoMeses) &&
    contratoMeses > 0 &&
    Number.isFinite(valorCompra) &&
    valorCompra > 0
  const resultadoCompleto = validoFinal && completos
  const receita = calculation.faturamentoTotalMensal * contratoMeses
  const suprimentos = calculation.cppSuprimentos * producaoMensal * contratoMeses
  const printway = calculation.valorSoftwarePrintway * contratoMeses
  const tributos = (receita * Number(impostos)) / 100
  const extras = Number(despesaMensal) * contratoMeses + Number(despesaInicial)
  const atendimentosEquivalentes = contratoMeses / 6
  const assistencia = atendimentosEquivalentes * Number(custoAtendimento)
  const deslocamento = foraCidade
    ? atendimentosEquivalentes * Number(viagemVisita) + Number(viagemInicial)
    : 0
  const custoImplantacao = Number(implantacao)
  const reservaContrato = reservaPagina * producaoMensal * contratoMeses
  const custoEquipamento = origem === 'parque' ? 0 : valorCompra
  const custosSemImposto =
    suprimentos +
    printway +
    extras +
    assistencia +
    deslocamento +
    custoImplantacao +
    custoEquipamento +
    reservaContrato
  const custoTotal = custosSemImposto + tributos
  const resultado = receita - custoTotal
  // Reserva é destinação prevista, não depósito realizado nem despesa contábil.
  const sobraCaixa = resultado + reservaContrato
  const margemValida =
    margemDesejada.trim() !== '' &&
    Number.isFinite(Number(margemDesejada)) &&
    Number(margemDesejada) >= 0 &&
    Number(margemDesejada) < 100 &&
    Number(impostos) + Number(margemDesejada) < 100
  const podeSugerir = resultadoCompleto && margemValida
  const divisor = 1 - (Number(impostos) + Number(margemDesejada)) / 100
  const mensalidadeSugerida = podeSugerir
    ? Math.ceil((custosSemImposto / contratoMeses / divisor) * 100) / 100
    : null
  const receitaSugerida = mensalidadeSugerida === null ? null : mensalidadeSugerida * contratoMeses
  const lucroSugerido =
    receitaSugerida === null
      ? null
      : receitaSugerida * (1 - Number(impostos) / 100) - custosSemImposto
  const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const campo = (
    id: string,
    label: string,
    value: string,
    setValue: (v: string) => void,
    max?: number,
  ) => (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min="0"
        max={max}
        step="0.01"
        placeholder="Não informado"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </div>
  )
  return (
    <section
      aria-label="Resultado exclusivo do administrador"
      className="rounded-xl border-2 border-emerald-600 bg-white p-5 space-y-4 print:hidden"
    >
      <div>
        <Badge>Exclusivo do administrador</Badge>
        <h3 className="text-lg font-bold mt-2">Resultado ao final do contrato</h3>
        <p className="text-sm text-slate-600">
          {contratoMeses} meses • {producaoMensal.toLocaleString('pt-BR')} páginas por mês.
        </p>
      </div>
      <div className="rounded-lg border p-3 space-y-3">
        <Label htmlFor="profit-origin">Equipamento do projeto</Label>
        <select
          id="profit-origin"
          className="w-full rounded-md border p-2 bg-white"
          value={origem}
          onChange={(e) => setOrigem(e.target.value)}
        >
          <option value="parque">Impressora do nosso parque</option>
          <option value="compra">Compra para este projeto</option>
        </select>
        <p className="text-xs">
          {origem === 'parque'
            ? 'A compra antiga não é descontada novamente.'
            : 'A compra de ' +
              moeda(valorCompra) +
              ' é considerada uma vez para avaliar a recuperação do investimento. Se foi paga pelo fundo coletivo, use a opção impressora do nosso parque para não descontar novamente.'}
        </p>
        <p className="font-semibold">
          Reserva prevista: {moeda(reservaPagina * producaoMensal)}/mês · {moeda(reservaContrato)}{' '}
          no contrato
        </p>
        <p className="text-xs">
          {producaoMensal.toLocaleString('pt-BR')} páginas/mês × R${' '}
          {reservaPagina.toLocaleString('pt-BR', {
            minimumFractionDigits: 6,
            maximumFractionDigits: 6,
          })}
          /página. Já incluída na mensalidade e no excedente. Não repita nas outras despesas.
        </p>
      </div>
      <fieldset className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 space-y-3">
        <legend className="font-semibold px-1">Assistência técnica e implantação</legend>
        <p className="text-sm font-medium">Previsão: 1 atendimento a cada 6 meses</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {campo(
            'profit-service',
            'Custo interno por atendimento (R$)',
            custoAtendimento,
            setCustoAtendimento,
          )}
          {campo('profit-install', 'Implantação técnica inicial (R$)', implantacao, setImplantacao)}
        </div>
        <p className="text-xs">
          Use o custo interno da mão de obra, sem lucro e sem deslocamento. Os R$ 150 do atendimento
          avulso não são utilizados. A implantação é coberta uma única vez. Não repita peças já
          incluídas no CPP.
        </p>
        <label className="flex gap-2 items-center text-sm font-medium">
          <input
            type="checkbox"
            checked={foraCidade}
            onChange={(e) => setForaCidade(e.target.checked)}
          />
          Atendimento fora da cidade
        </label>
        {foraCidade && (
          <div className="grid gap-3 sm:grid-cols-2">
            {campo(
              'profit-trip-service',
              'Deslocamento por atendimento — ida e volta (R$)',
              viagemVisita,
              setViagemVisita,
            )}
            {campo(
              'profit-trip-install',
              'Deslocamento da implantação — ida e volta (R$)',
              viagemInicial,
              setViagemInicial,
            )}
            <p className="text-xs sm:col-span-2">
              Inclua combustível, pedágios, tempo de viagem e, quando necessário, alimentação e
              hospedagem, sem repetir custos já informados.
            </p>
          </div>
        )}
        {resultadoCompleto && (
          <p className="text-sm" role="status">
            Reserva de assistência: {moeda(assistencia / contratoMeses)}/mês. Implantação e
            deslocamentos: {moeda(custoImplantacao + deslocamento)} no contrato.
          </p>
        )}
        <p className="text-xs">
          Reserva proporcional ao prazo: meses ÷ 6 × custo por atendimento. Exemplo: 12 meses = 2
          atendimentos; 36 meses = 6. Frações de semestre geram reserva proporcional. Esta previsão
          não agenda visitas.
        </p>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-3">
        {campo('profit-tax', 'Impostos sobre receita (%)', impostos, setImpostos, 100)}
        {campo('profit-monthly', 'Outras despesas mensais (R$)', despesaMensal, setDespesaMensal)}
        {campo(
          'profit-initial',
          'Outras despesas iniciais (R$)',
          despesaInicial,
          setDespesaInicial,
        )}
      </div>
      <p className="text-xs text-slate-600">
        Informe 0 apenas quando confirmar que não há custo. Inclua a parcela das despesas
        administrativas em outras despesas mensais. Não repita peças, assistência, implantação ou
        deslocamentos já informados.
      </p>
      {!custosValidos && (
        <p role="alert" className="text-red-700">
          Corrija os custos negativos ou inválidos. Impostos devem estar entre 0% e 100%.
        </p>
      )}
      {!completos && (
        <div role="status" className="rounded-lg border border-amber-400 bg-amber-50 p-4">
          <h4 className="font-bold text-amber-900">
            Lucro pendente — faltam {pendentes.length} custos
          </h4>
          <p className="text-sm">
            Campo vazio não significa custo zero. Preencha ou confirme 0 em cada item:
          </p>
          <ul className="list-disc pl-5 text-sm mt-2">
            {pendentes.map((e) => (
              <li key={e.id}>
                <a className="underline" href={'#' + e.id}>
                  {e.nome}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <section
        aria-label="Resumo financeiro mensal"
        className="rounded-lg bg-slate-50 p-4 space-y-3"
      >
        <h4 className="font-bold">Com a mensalidade atual</h4>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-sm">Cliente paga por mês</p>
            <strong className="text-xl">
              {validoFinal ? moeda(calculation.faturamentoTotalMensal) : 'Complete a precificação'}
            </strong>
          </div>
          <div>
            <p className="text-sm">Custos e reserva por mês</p>
            <strong className="text-xl">
              {resultadoCompleto ? moeda(custoTotal / contratoMeses) : 'Pendente'}
            </strong>
            <p className="text-xs">
              Inclui impostos e{' '}
              {origem === 'parque' ? 'reserva por página' : 'compra e reserva por página'}.
            </p>
          </div>
          <div>
            <p className="text-sm">Resultado antes da reserva por mês</p>
            <strong className="text-xl">
              {resultadoCompleto ? moeda(sobraCaixa / contratoMeses) : 'Pendente'}
            </strong>
            <p className="text-xs">Previsão após pagamentos; não é saldo bancário.</p>
          </div>
          <div>
            <p className="text-sm">
              {origem === 'parque'
                ? 'Resultado após reserva por mês'
                : 'Retorno após compra e reserva por mês'}
            </p>
            <strong
              className={resultado < 0 ? 'text-2xl text-red-700' : 'text-2xl text-emerald-800'}
            >
              {resultadoCompleto ? moeda(resultado / contratoMeses) : 'Pendente'}
            </strong>
          </div>
        </div>
        {resultadoCompleto && (
          <p className={resultado < 0 ? 'text-red-700 font-semibold' : 'text-sm'}>
            {resultado < 0 ? 'Prejuízo estimado. ' : ''}Margem atual:{' '}
            {receita > 0
              ? ((resultado / receita) * 100).toLocaleString('pt-BR', {
                  maximumFractionDigits: 2,
                }) + '%'
              : 'Não calculável sem receita'}
            .
          </p>
        )}
      </section>
      <section aria-label="Resultado total do contrato" className="rounded-lg border p-4">
        <h4 className="font-bold">No contrato inteiro — {contratoMeses} meses</h4>
        <div className="grid gap-3 sm:grid-cols-3 mt-3">
          <div>
            <p className="text-sm">Receita total</p>
            <strong>{validoFinal ? moeda(receita) : 'Pendente'}</strong>
          </div>
          <div>
            <p className="text-sm">Resultado antes da reserva</p>
            <strong>{resultadoCompleto ? moeda(sobraCaixa) : 'Pendente'}</strong>
          </div>
          <div>
            <p className="text-sm">
              {origem === 'parque' ? 'Resultado após reserva' : 'Retorno após compra e reserva'}
            </p>
            <strong>{resultadoCompleto ? moeda(resultado) : 'Pendente'}</strong>
          </div>
        </div>
        <p className="text-xs mt-3">
          {origem === 'parque'
            ? 'A diferença entre os resultados é a reserva prevista por página. Ela não é depreciação contábil nem dinheiro já depositado. A compra antiga não é descontada novamente.'
            : 'A compra nova é descontada uma única vez. Isto é retorno do projeto após recuperar o investimento, não lucro contábil.'}{' '}
          Valores médios: implantação e visitas têm pagamentos em datas diferentes.
        </p>
      </section>
      <section
        aria-label="Mensalidade para margem desejada"
        className="rounded-lg border-2 border-indigo-500 bg-indigo-50 p-4 space-y-3"
      >
        <h4 className="font-bold">Qual mensalidade entrega a margem desejada?</h4>
        {campo(
          'profit-target-margin',
          'Margem desejada sobre a receita (%)',
          margemDesejada,
          setMargemDesejada,
          99.99,
        )}
        {margemDesejada !== '' && !margemValida && (
          <p role="alert" className="text-red-700">
            Use uma margem não negativa. A soma de impostos e margem precisa ser menor que 100%.
          </p>
        )}
        {!podeSugerir ? (
          <p className="text-sm">
            Complete todos os custos, a precificação e a margem desejada para calcular uma sugestão.
          </p>
        ) : (
          <div className="space-y-2" aria-live="polite">
            <p>
              Mensalidade sugerida com a franquia incluída:{' '}
              <strong className="text-2xl">{moeda(mensalidadeSugerida!)}</strong>
            </p>
            <p>
              Resultado projetado com esse preço:{' '}
              <strong>{moeda(lucroSugerido! / contratoMeses)}/mês</strong> e{' '}
              <strong>{moeda(lucroSugerido!)} no contrato</strong>.
            </p>
            <p>
              {mensalidadeSugerida! > calculation.faturamentoTotalMensal
                ? 'Aumento necessário: ' +
                  moeda(mensalidadeSugerida! - calculation.faturamentoTotalMensal) +
                  '/mês.'
                : 'A mensalidade atual já alcança a margem desejada; não é necessário reduzir o preço.'}
            </p>
          </div>
        )}
        <p className="text-xs">
          Custo mensal sem impostos ÷ (1 − impostos − margem desejada). Impostos são recalculados
          sobre o preço sugerido; arredondamento para cima ao centavo. A sugestão é gerencial e não
          altera automaticamente a proposta.
        </p>
      </section>
      <details open className="rounded-lg border p-4">
        <summary className="cursor-pointer font-semibold">
          Cada custo: média mensal e total do contrato
        </summary>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Item</th>
                <th className="text-right p-2">Por mês</th>
                <th className="text-right p-2">No contrato</th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  nome: 'Suprimentos e peças incluídos no CPP',
                  total: suprimentos,
                  informado: true,
                },
                { nome: 'Printway', total: printway, informado: true },
                { nome: 'Reserva prevista por página', total: reservaContrato, informado: true },
                {
                  nome:
                    origem === 'parque'
                      ? 'Compra antiga (não descontada novamente)'
                      : 'Compra para o projeto (uma vez)',
                  total: custoEquipamento,
                  informado: true,
                },
                {
                  nome: 'Assistência: 1 atendimento por semestre',
                  total: assistencia,
                  informado: custoAtendimento !== '',
                },
                {
                  nome: 'Implantação técnica (uma vez)',
                  total: custoImplantacao,
                  informado: implantacao !== '',
                },
                {
                  nome: 'Deslocamento das visitas',
                  total: foraCidade ? atendimentosEquivalentes * Number(viagemVisita) : 0,
                  informado: !foraCidade || viagemVisita !== '',
                },
                {
                  nome: 'Deslocamento da implantação (uma vez)',
                  total: foraCidade ? Number(viagemInicial) : 0,
                  informado: !foraCidade || viagemInicial !== '',
                },
                {
                  nome: 'Impostos sobre a receita atual',
                  total: tributos,
                  informado: impostos !== '',
                },
                {
                  nome: 'Outras despesas mensais',
                  total: Number(despesaMensal) * contratoMeses,
                  informado: despesaMensal !== '',
                },
                {
                  nome: 'Outras despesas iniciais (uma vez)',
                  total: Number(despesaInicial),
                  informado: despesaInicial !== '',
                },
              ].map((item) => (
                <tr key={item.nome} className="border-b">
                  <td className="p-2">{item.nome}</td>
                  <td className="p-2 text-right">
                    {!item.informado
                      ? 'Não informado'
                      : validoFinal
                        ? moeda(item.total / contratoMeses)
                        : 'Pendente'}
                  </td>
                  <td className="p-2 text-right">
                    {!item.informado
                      ? 'Não informado'
                      : validoFinal
                        ? moeda(item.total)
                        : 'Pendente'}
                  </td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="p-2">Custos e reserva</td>
                <td className="text-right p-2">
                  {resultadoCompleto ? moeda(custoTotal / contratoMeses) : 'Pendente'}
                </td>
                <td className="text-right p-2">
                  {resultadoCompleto ? moeda(custoTotal) : 'Pendente'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
      <p className="text-xs text-slate-600">
        Estimativa com a franquia inteira consumida e todas as mensalidades recebidas. Não inclui
        excedentes nem revenda. Valores privados desta simulação, não salvos na proposta e ausentes
        do resumo comercial e da impressão. O resultado real depende dos custos e recebimentos.
      </p>
    </section>
  )
}

type ReserveConfig = {
  year: number
  purchases: number
  unitPrice: number
  repairs: number
  monthlyPages: number
}
type ReserveRow = { id: string; created: string; payload: any }
const reserveMoney = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export function reserveRate(c: ReserveConfig): number {
  if (
    !Number.isInteger(c.year) ||
    c.year < 2020 ||
    c.year > 2100 ||
    !Number.isInteger(c.purchases) ||
    c.purchases < 0 ||
    !Number.isFinite(c.unitPrice) ||
    c.unitPrice < 0 ||
    !Number.isFinite(c.repairs) ||
    c.repairs < 0 ||
    !Number.isSafeInteger(c.monthlyPages) ||
    c.monthlyPages <= 0
  )
    throw new Error('Preencha valores não negativos e um volume mensal inteiro maior que zero.')
  return (
    Math.ceil(((c.purchases * c.unitPrice + c.repairs) / (c.monthlyPages * 12)) * 1000000) / 1000000
  )
}
export function useRentalReserve() {
  const { isAdmin } = usePermissions()
  const [rate, setRate] = useState<number | null>(null)
  const [rateId, setRateId] = useState('')
  const [rows, setRows] = useState<ReserveRow[]>([])
  const [config, setConfig] = useState<ReserveConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const refresh = async () => {
    setLoading(true)
    setError('')
    try {
      const rates = await reservePb
        .collection('rental_reserve')
        .getList<ReserveRow>(1, 1, {
          filter: 'payload.kind = "rate"',
          sort: '-created,-id',
          requestKey: null,
        })
      const latest = rates.items[0]
      const nextRate = latest ? Number(latest.payload.rate) : null
      if (nextRate !== null && (!Number.isFinite(nextRate) || nextRate < 0))
        throw new Error('Tarifa cadastrada inválida.')
      let privateRows: ReserveRow[] = []
      if (isAdmin)
        privateRows = await reservePb
          .collection('rental_reserve')
          .getFullList<ReserveRow>({
            filter: 'payload.kind != "rate"',
            sort: '-created,-id',
            requestKey: null,
          })
      const matching = privateRows.find((r) => r.id === latest?.payload.configId)
      setRows(privateRows)
      setConfig(matching?.payload.config || null)
      setRate(nextRate)
      setRateId(latest?.id || '')
    } catch {
      setRate(null)
      setError('Não foi possível carregar a reserva. Atualize antes de gerar propostas.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void refresh()
  }, [isAdmin])
  return { rate, rateId, rows, config, loading, error, refresh }
}
type ReserveState = ReturnType<typeof useRentalReserve>
export function applyRentalReserve(
  base: PricingEngineResult,
  rate: number | null,
  pages: number,
  loading: boolean,
  error: string,
): PricingEngineResult {
  if (loading || error || rate === null)
    return {
      ...base,
      valid: false,
      errors: [
        ...base.errors,
        error ||
          (loading
            ? 'Carregando reserva do parque.'
            : 'Administrador: salve o planejamento da reserva antes de gerar novas propostas.'),
      ],
    }
  const cppVenda = base.cppVenda + rate
  const custoMensalProducao = cppVenda * pages
  const faturamentoTotalMensal = base.faturamentoTotalMensal + rate * pages
  return {
    ...base,
    cppVenda,
    custoMensalProducao,
    faturamentoTotalMensal,
    formatted: {
      ...base.formatted,
      cppVenda: cppVenda.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 6,
        maximumFractionDigits: 6,
      }),
      custoMensalProducao: reserveMoney(custoMensalProducao),
      faturamentoTotalMensal: reserveMoney(faturamentoTotalMensal),
    },
  }
}

function RentalReserveAdmin({ fund }: { fund: ReserveState }) {
  const { isAdmin } = usePermissions()
  const [draft, setDraft] = useState({
    year: '2026',
    purchases: '2',
    unitPrice: '2000',
    repairs: '1000',
    monthlyPages: '200000',
  })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [entry, setEntry] = useState({
    date: new Date().toLocaleDateString('en-CA'),
    direction: 'out',
    category: 'compra',
    amount: '',
    equipment: '',
    note: '',
  })
  const requestId = useRef('')
  const saveLock = useRef(false)
  useEffect(() => {
    if (fund.config)
      setDraft(
        Object.fromEntries(
          Object.entries(fund.config).map(([k, v]) => [k, String(v)]),
        ) as typeof draft,
      )
  }, [fund.config])
  if (!isAdmin) return null
  const proposed = Object.fromEntries(
    Object.entries(draft).map(([k, v]) => [k, Number(v)]),
  ) as ReserveConfig
  let suggested: number | null = null
  try {
    if (Object.values(draft).every((v) => v.trim() !== '')) suggested = reserveRate(proposed)
  } catch {}
  const annual = proposed.purchases * proposed.unitPrice + proposed.repairs
  const entries = fund.rows.filter((r) => r.payload.kind === 'entry')
  const validEntries = entries.every(
    (r) =>
      Number.isSafeInteger(r.payload.cents) &&
      r.payload.cents > 0 &&
      ['in', 'out'].includes(r.payload.direction),
  )
  const incoming =
    entries.filter((r) => r.payload.direction === 'in').reduce((n, r) => n + r.payload.cents, 0) /
    100
  const outgoing =
    entries.filter((r) => r.payload.direction === 'out').reduce((n, r) => n + r.payload.cents, 0) /
    100
  const yearOut =
    entries
      .filter(
        (r) => r.payload.direction === 'out' && String(r.payload.date).startsWith(draft.year + '-'),
      )
      .reduce((n, r) => n + r.payload.cents, 0) / 100
  const commit = async (payload: any) => {
    if (!requestId.current) requestId.current = crypto.randomUUID().replaceAll('-', '').slice(0, 15)
    const id = requestId.current
    try {
      await reservePb.collection('rental_reserve').create({ id, payload })
    } catch (error) {
      const existing = await reservePb
        .collection('rental_reserve')
        .getOne<ReserveRow>(id)
        .catch(() => null)
      if (!existing || JSON.stringify(existing.payload) !== JSON.stringify(payload)) throw error
    }
    requestId.current = ''
    return id
  }
  const savePlan = async () => {
    if (saveLock.current || suggested === null || fund.loading) return
    saveLock.current = true
    setBusy(true)
    setMessage('')
    try {
      const configId = await commit({ kind: 'config', config: proposed, version: 1 })
      await commit({ kind: 'rate', rate: suggested, configId, version: 1 })
      await fund.refresh()
      setMessage(
        'Planejamento salvo. A taxa passa a valer nesta simulação e nas novas propostas. Propostas e contratos salvos permanecem congelados.',
      )
    } catch {
      requestId.current = ''
      setMessage(
        'Não foi possível confirmar a ativação. Atualize para conferir a tarifa vigente antes de tentar novamente.',
      )
    } finally {
      saveLock.current = false
      setBusy(false)
    }
  }
  const saveEntry = async () => {
    const cents = Math.round(Number(entry.amount) * 100)
    if (
      saveLock.current ||
      !Number.isSafeInteger(cents) ||
      cents <= 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) ||
      !entry.note.trim() ||
      (entry.direction === 'out' && !entry.equipment.trim())
    ) {
      setMessage('Informe data, valor positivo, descrição e equipamento nas saídas.')
      return
    }
    saveLock.current = true
    setBusy(true)
    setMessage('')
    try {
      await commit({ kind: 'entry', ...entry, amount: undefined, cents, version: 1 })
      await fund.refresh()
      setEntry({ ...entry, amount: '', equipment: '', note: '' })
      setMessage(
        'Movimentação registrada. O saldo foi atualizado; a tarifa não foi aumentada automaticamente.',
      )
    } catch {
      setMessage(
        'Não foi possível confirmar o lançamento. Mantenha os dados e tente novamente para verificar o mesmo registro, sem duplicá-lo.',
      )
    } finally {
      saveLock.current = false
      setBusy(false)
    }
  }
  const field = (key: keyof typeof draft, label: string, step = '1') => (
    <label className="text-sm space-y-1">
      {label}
      <Input
        type="number"
        min="0"
        step={step}
        value={draft[key]}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
        disabled={busy}
      />
    </label>
  )
  return (
    <section
      aria-label="Fundo de renovação do parque"
      className="rounded-xl border-2 border-indigo-500 bg-white p-5 space-y-4 print:hidden"
    >
      <Badge>Exclusivo do administrador</Badge>
      <h3 className="text-lg font-bold">Reserva do parque — orçamento e movimentações</h3>
      <p className="text-sm">
        Reserva coletiva para renovação parcial e reparos eventuais. Tinta, toner, cabeçote, fusor e
        película já incluídos no CPP não entram novamente aqui.
      </p>
      {fund.error && (
        <p role="alert" className="text-red-700">
          {fund.error}
        </p>
      )}
      {!fund.config && (
        <p className="bg-amber-50 p-3 text-sm">
          Cenário inicial estimado: 2 impressoras de R$ 2.000, R$ 1.000 de reparos e 200.000
          páginas/mês (200 locadas × 1.000). Não é histórico real nem garantia de reposição em 48
          meses. Salve para ativar.
        </p>
      )}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {field('year', 'Ano do orçamento')}
        {field('purchases', 'Impressoras novas previstas no ano')}
        {field('unitPrice', 'Preço médio por impressora nova (R$)', '0.01')}
        {field('repairs', 'Reparos eventuais previstos no ano (R$)', '0.01')}
        {field('monthlyPages', 'Páginas mensais previstas das máquinas locadas')}
      </div>
      <p className="text-xs">
        Máquinas em estoque não entram no volume. Atualize a previsão com relatórios do Printway;
        não há integração automática de contadores. Alterar o volume não muda a taxa até salvar uma
        nova referência.
      </p>
      <div className="grid sm:grid-cols-3 gap-3 bg-indigo-50 p-3 rounded-lg">
        <div>
          Orçamento anual
          <strong className="block text-xl">
            {suggested === null ? 'Dados inválidos' : reserveMoney(annual)}
          </strong>
        </div>
        <div>
          Taxa calculada por página
          <strong className="block text-xl">
            {suggested === null
              ? 'Pendente'
              : 'R$ ' +
                suggested.toLocaleString('pt-BR', {
                  minimumFractionDigits: 6,
                  maximumFractionDigits: 6,
                })}
          </strong>
        </div>
        <div>
          Taxa vigente
          <strong className="block text-xl">
            {fund.loading
              ? 'Carregando'
              : fund.rate === null
                ? 'Não ativada'
                : 'R$ ' +
                  fund.rate.toLocaleString('pt-BR', {
                    minimumFractionDigits: 6,
                    maximumFractionDigits: 6,
                  })}
          </strong>
        </div>
      </div>
      <p className="text-xs">
        (Compras previstas × preço médio + reparos) ÷ (páginas mensais × 12). Arredondamento para
        cima em 6 casas decimais. A taxa entra uma vez na franquia e no excedente, sem mark-up
        adicional. Impostos e margem continuam visíveis na análise do administrador.
      </p>
      <div className="flex gap-3">
        <Button
          type="button"
          disabled={busy || fund.loading || suggested === null}
          onClick={savePlan}
        >
          Salvar planejamento e atualizar taxa
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy || fund.loading}
          onClick={() => void fund.refresh()}
        >
          Atualizar fundo
        </Button>
      </div>
      {message && (
        <p role="status" className="rounded border p-3 text-sm">
          {message}
        </p>
      )}
      <div className="grid sm:grid-cols-3 gap-3 rounded-lg bg-emerald-50 p-3">
        <div>
          Entradas registradas
          <strong className="block">
            {validEntries ? reserveMoney(incoming) : 'Revisar registros'}
          </strong>
        </div>
        <div>
          Saídas registradas
          <strong className="block">
            {validEntries ? reserveMoney(outgoing) : 'Revisar registros'}
          </strong>
        </div>
        <div>
          Saldo registrado do fundo
          <strong className="block text-xl">
            {validEntries ? reserveMoney(incoming - outgoing) : 'Revisar registros'}
          </strong>
        </div>
      </div>
      <p className="text-sm">
        Saídas registradas em {draft.year}:{' '}
        {validEntries ? reserveMoney(yearOut) : 'Revisar registros'}. Orçamento restante do ano:{' '}
        {suggested !== null && validEntries ? reserveMoney(annual - yearOut) : 'Pendente'}.
      </p>
      <p className="text-xs">
        Previsão não é dinheiro disponível. O saldo reúne somente lançamentos registrados, não
        consulta conta bancária. Uma compra ou reparo reduz o fundo e não é descontado novamente do
        resultado dos contratos. Gastos maiores sinalizam revisão do orçamento, sem reajuste
        automático de contratos.
      </p>
      <details className="border rounded-lg p-3">
        <summary className="font-semibold cursor-pointer">
          Registrar entrada, compra ou reparo realizado
        </summary>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <label>
            Data
            <Input
              type="date"
              value={entry.date}
              onChange={(e) => {
                requestId.current = ''
                setEntry({ ...entry, date: e.target.value })
              }}
            />
          </label>
          <label>
            Movimentação
            <select
              className="w-full border rounded p-2"
              value={entry.direction}
              onChange={(e) => {
                requestId.current = ''
                setEntry({
                  ...entry,
                  direction: e.target.value,
                  category: e.target.value === 'in' ? 'aporte' : 'compra',
                })
              }}
            >
              <option value="in">Entrada efetivamente reservada</option>
              <option value="out">Saída paga pelo fundo</option>
            </select>
          </label>
          <label>
            Categoria
            <select
              className="w-full border rounded p-2"
              value={entry.category}
              onChange={(e) => {
                requestId.current = ''
                setEntry({ ...entry, category: e.target.value })
              }}
            >
              {(entry.direction === 'in'
                ? ['aporte', 'saldo inicial', 'ajuste de entrada']
                : ['compra', 'placa', 'mecanismo', 'outro reparo', 'ajuste de saída']
              ).map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Valor realizado (R$)
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={entry.amount}
              onChange={(e) => {
                requestId.current = ''
                setEntry({ ...entry, amount: e.target.value })
              }}
            />
          </label>
          <label>
            Equipamento / patrimônio / série
            <Input
              value={entry.equipment}
              onChange={(e) => {
                requestId.current = ''
                setEntry({ ...entry, equipment: e.target.value })
              }}
            />
          </label>
          <label>
            Descrição / comprovante / referência
            <Input
              value={entry.note}
              onChange={(e) => {
                requestId.current = ''
                setEntry({ ...entry, note: e.target.value })
              }}
            />
          </label>
        </div>
        <Button
          type="button"
          className="mt-3"
          disabled={busy || fund.loading || !!fund.error}
          onClick={saveEntry}
        >
          Registrar movimentação realizada
        </Button>
        <p className="text-xs mt-2">
          Histórico preservado. Para corrigir um lançamento, registre um ajuste no sentido contrário
          e cite o registro original. Nenhuma transferência bancária é feita por este botão.
        </p>
      </details>
      <details className="border rounded-lg p-3">
        <summary className="font-semibold cursor-pointer">
          Histórico de movimentações ({entries.length})
        </summary>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Categoria / equipamento</th>
                <th>Descrição</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.payload.date}</td>
                  <td>{r.payload.direction === 'in' ? 'Entrada' : 'Saída'}</td>
                  <td>
                    {r.payload.category} · {r.payload.equipment || '—'}
                  </td>
                  <td>
                    {r.payload.note}
                    <small className="block">Registro: {r.id}</small>
                  </td>
                  <td>{reserveMoney(r.payload.cents / 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {entries.length === 0 && <p className="p-3">Nenhuma movimentação real registrada.</p>}
        </div>
      </details>
    </section>
  )
}
