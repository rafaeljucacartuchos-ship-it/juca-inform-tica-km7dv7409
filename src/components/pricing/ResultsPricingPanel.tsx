import { usePermissions } from '@/hooks/use-permissions'
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
      {isAdmin && (
        <AdminRentalProfit
          key={selectedPrinter?.id}
          calculation={calculation}
          producaoMensal={producaoMensal}
          contratoMeses={contratoMeses}
          valorCompra={valorCompra}
          valido={dadosValidos}
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
}) {
  const { isAdmin } = usePermissions()
  const [impostos, setImpostos] = useState('')
  const [despesaMensal, setDespesaMensal] = useState('')
  const [despesaInicial, setDespesaInicial] = useState('')
  const [origem, setOrigem] = useState('parque')
  const [desgaste, setDesgaste] = useState('')
  const [custoAtendimento, setCustoAtendimento] = useState('')
  const [implantacao, setImplantacao] = useState('')
  const [foraCidade, setForaCidade] = useState(false)
  const [viagemVisita, setViagemVisita] = useState('')
  const [viagemInicial, setViagemInicial] = useState('')
  if (!isAdmin) return null
  const campos = [
    impostos,
    despesaMensal,
    despesaInicial,
    custoAtendimento,
    implantacao,
    ...(origem === 'parque' ? [desgaste] : []),
    ...(foraCidade ? [viagemVisita, viagemInicial] : []),
  ]
  const completos = campos.every((v) => v.trim() !== '')
  const custosValidos =
    campos.every((v) => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0)) &&
    Number(impostos) <= 100
  const validoFinal =
    valido &&
    custosValidos &&
    Number.isInteger(contratoMeses) &&
    contratoMeses > 0 &&
    Number.isFinite(valorCompra) &&
    valorCompra > 0
  const receita = calculation.faturamentoTotalMensal * contratoMeses
  const suprimentos = calculation.cppSuprimentos * producaoMensal * contratoMeses
  const printway = calculation.valorSoftwarePrintway * contratoMeses
  const tributos = (receita * Number(impostos)) / 100
  const extras = Number(despesaMensal) * contratoMeses + Number(despesaInicial)
  // Reserva proporcional: um atendimento por semestre, sem promessa de agenda de visitas.
  const atendimentosEquivalentes = contratoMeses / 6
  const assistencia = atendimentosEquivalentes * Number(custoAtendimento)
  const deslocamento = foraCidade
    ? atendimentosEquivalentes * Number(viagemVisita) + Number(viagemInicial)
    : 0
  const custoImplantacao = Number(implantacao)
  const custoEquipamento = origem === 'parque' ? Number(desgaste) * contratoMeses : valorCompra
  const resultado =
    receita -
    custoEquipamento -
    suprimentos -
    printway -
    tributos -
    extras -
    assistencia -
    deslocamento -
    custoImplantacao
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
        {origem === 'parque' ? (
          <>
            {campo(
              'profit-wear',
              'Desgaste mensal estimado da impressora (R$)',
              desgaste,
              setDesgaste,
            )}
            <p className="text-xs">
              A compra antiga não é descontada novamente. Informe o custo gerencial de uso da
              máquina. Não some uma segunda reserva de reposição nas outras despesas.
            </p>
          </>
        ) : (
          <p className="text-xs">
            A compra de {moeda(valorCompra)} será descontada uma única vez. Este cenário mostra o
            retorno após recuperar a compra integral, sem considerar revenda.
          </p>
        )}
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
        {validoFinal && (
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
        Informe 0 quando não houver custo. Não repita assistência, implantação ou deslocamentos nas
        outras despesas. Os valores são desta simulação: reduzem o resultado estimado, mas não
        reajustam automaticamente a mensalidade nem ficam salvos na proposta.
      </p>
      {!custosValidos && (
        <p role="alert" className="text-red-700">
          Informe custos não negativos e impostos entre 0% e 100%.
        </p>
      )}
      {!completos && (
        <p className="text-sm text-amber-800">
          Estimativa parcial: custos em branco ainda não foram descontados.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-3 rounded-lg bg-slate-50 p-4" aria-live="polite">
        <div>
          <p className="text-sm">
            {completos
              ? origem === 'parque'
                ? 'Lucro gerencial estimado'
                : 'Resultado após recuperar a compra'
              : 'Resultado antes dos custos não informados'}
          </p>
          <strong className={resultado < 0 ? 'text-2xl text-red-700' : 'text-2xl text-emerald-800'}>
            {validoFinal ? moeda(resultado) : 'Complete a precificação'}
          </strong>
          {validoFinal && resultado < 0 && (
            <p className="text-red-700 font-semibold">Prejuízo estimado</p>
          )}
        </div>
        <div>
          <p className="text-sm">Média mensal do resultado</p>
          <strong className="text-xl">
            {validoFinal ? moeda(resultado / contratoMeses) : '—'}
          </strong>
        </div>
        <div>
          <p className="text-sm">Margem sobre a receita</p>
          <strong className="text-xl">
            {validoFinal && receita > 0
              ? ((resultado / receita) * 100).toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }) + '%'
              : '—'}
          </strong>
        </div>
      </div>
      {validoFinal && (
        <details>
          <summary className="cursor-pointer font-semibold">
            Conferir receitas e custos do contrato
          </summary>
          <dl className="grid grid-cols-2 gap-2 mt-3 text-sm">
            <dt>Receita total prevista</dt>
            <dd className="text-right">{moeda(receita)}</dd>
            <dt>
              {origem === 'parque' ? 'Desgaste da impressora no contrato' : 'Compra da impressora'}
            </dt>
            <dd className="text-right">− {moeda(custoEquipamento)}</dd>
            <dt>Suprimentos e peças incluídos no CPP</dt>
            <dd className="text-right">− {moeda(suprimentos)}</dd>
            <dt>Printway no contrato</dt>
            <dd className="text-right">− {moeda(printway)}</dd>
            <dt>Assistência técnica prevista</dt>
            <dd className="text-right">− {moeda(assistencia)}</dd>
            <dt>Implantação técnica inicial</dt>
            <dd className="text-right">− {moeda(custoImplantacao)}</dd>
            <dt>Deslocamentos de implantação e visitas</dt>
            <dd className="text-right">− {moeda(deslocamento)}</dd>
            <dt>Impostos informados</dt>
            <dd className="text-right">
              {impostos === '' ? 'Não informado' : '− ' + moeda(tributos)}
            </dd>
            <dt>Outras despesas informadas</dt>
            <dd className="text-right">
              − {moeda(extras)}
              {despesaMensal === '' || despesaInicial === '' ? ' (incompleto)' : ''}
            </dd>
          </dl>
        </details>
      )}
      <p className="text-xs text-slate-600">
        Projeção com a franquia inteira consumida e todas as mensalidades recebidas. Não inclui
        excedentes nem valor de revenda. O lucro gerencial inclui desgaste, que não é pagamento
        mensal. O resultado real depende dos custos e recebimentos. Informação interna, ausente do
        resumo comercial e da impressão.
      </p>
    </section>
  )
}
