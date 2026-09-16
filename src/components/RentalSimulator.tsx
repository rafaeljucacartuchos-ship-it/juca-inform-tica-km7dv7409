import { useState, useEffect } from 'react'
import {
  Printer,
  Calculator,
  FileText,
  FileCheck2,
  TrendingUp,
  Plus,
  RotateCcw,
  Sparkles,
  ArrowRight,
  HelpCircle,
  Percent,
  Calendar,
  Layers,
  CheckCircle2,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  RentalCustomerSelect,
  type RentalCustomerSelection,
} from '@/components/RentalCustomerSelect'
import { RentalMachineCard, type MachineFormData } from '@/components/RentalMachineCard'
import {
  getRentalSettings,
  calculateMachineRental,
  calculateComparison,
  createRentalQuote,
  createRentalMachine,
  updateRentalSettings,
} from '@/services/rental'
import { useDraftState } from '@/hooks/use-draft-state'
import { useToast } from '@/hooks/use-toast'
import type { RentalQuote, RentalMachineCalculation, RentalQuoteResults } from '@/types'

interface RentalSimulatorProps {
  onQuoteGenerated: (quote: RentalQuote) => void
  initialQuote?: RentalQuote | null
}

const EMPTY_MACHINE: MachineFormData = {
  machineName: '',
  serial: '',
  contadorInicial: 0,
  valorCompra: 2500,
  paybackMeses: 18,
  scanner: true,
  scannerTipo: 'Alimentador ADF Duplex',
  scannerVelocidade: '35 ppm',
  supplies: [],
}

export function RentalSimulator({ onQuoteGenerated, initialQuote }: RentalSimulatorProps) {
  const { toast } = useToast()

  // Configurações globais
  const [defaultPayback, setDefaultPayback] = useState(18)
  const [defaultMargin, setDefaultMargin] = useState(50)

  // Cliente
  const [customer, setCustomer] = useState<RentalCustomerSelection>({
    cliente_nome_livre: '',
    cliente_telefone: '',
    cliente_documento: '',
    cliente_endereco: '',
  })

  // Parâmetros da simulação
  const [volumeMensal, setVolumeMensal] = useState<number>(1000)
  const [franquiaPaginas, setFranquiaPaginas] = useState<number>(1000)
  const [contratoMeses, setContratoMeses] = useState<number>(12)
  const [margemPct, setMargemPct] = useState<number>(50)
  const [tituloProposta, setTituloProposta] = useState<string>('Locação Corporativa')
  const [excedenteEditavel, setExcedenteEditavel] = useState<Record<number, number>>({})

  // Máquinas (1 ou 2)
  const [machines, setMachines] = useState<MachineFormData[]>([
    { ...EMPTY_MACHINE, machineName: '' },
  ])

  // Rascunho de simulação/máquina de locação
  const {
    draft: draftRental,
    saveDraft: saveDraftRental,
    clearDraft: clearDraftRental,
  } = useDraftState<any>('juca:draft:locacao-maquina', '/locacao', 'Locação de Impressoras')

  // Restaura rascunho de locação se não houver initialQuote
  useEffect(() => {
    if (initialQuote) return
    if (draftRental && draftRental.formData) {
      const data = draftRental.formData
      if (data.customer) setCustomer(data.customer)
      if (data.volumeMensal) setVolumeMensal(data.volumeMensal)
      if (data.franquiaPaginas) setFranquiaPaginas(data.franquiaPaginas)
      if (data.contratoMeses) setContratoMeses(data.contratoMeses)
      if (data.margemPct) setMargemPct(data.margemPct)
      if (data.tituloProposta) setTituloProposta(data.tituloProposta)
      if (Array.isArray(data.machines) && data.machines.length > 0) {
        setMachines(data.machines)
      }
    }
  }, [])

  // Salva rascunho com debounce quando os dados da máquina/locação mudam
  useEffect(() => {
    if (initialQuote) return
    const hasData =
      customer.cliente_nome_livre || machines.some((m) => m.machineName || m.valorCompra > 0)
    if (hasData) {
      saveDraftRental({
        customer,
        volumeMensal,
        franquiaPaginas,
        contratoMeses,
        margemPct,
        tituloProposta,
        machines,
      })
    }
  }, [
    customer,
    volumeMensal,
    franquiaPaginas,
    contratoMeses,
    margemPct,
    tituloProposta,
    machines,
    initialQuote,
    saveDraftRental,
  ])

  const [savingQuote, setSavingQuote] = useState(false)

  // Carrega configurações iniciais
  useEffect(() => {
    async function loadSettings() {
      const s = await getRentalSettings()
      setDefaultPayback(s.defaultPaybackMonths)
      setDefaultMargin(s.defaultMarginPct)
      setMargemPct(s.defaultMarginPct)
      setMachines([
        {
          ...EMPTY_MACHINE,
          paybackMeses: s.defaultPaybackMonths,
        },
      ])
    }
    loadSettings()
  }, [])

  // Carrega quote inicial se fornecido para edição
  useEffect(() => {
    if (!initialQuote) return
    if (initialQuote.cliente_id || initialQuote.cliente_nome_livre) {
      setCustomer({
        cliente_id: initialQuote.cliente_id,
        cliente_nome_livre: initialQuote.cliente_nome_livre || '',
        cliente_telefone: initialQuote.cliente_telefone || '',
        cliente_documento: initialQuote.cliente_documento || '',
        cliente_endereco: initialQuote.cliente_endereco || '',
      })
    }
    if (initialQuote.volume_mensal) setVolumeMensal(initialQuote.volume_mensal)
    if (initialQuote.franquia_paginas) setFranquiaPaginas(initialQuote.franquia_paginas)
    if (initialQuote.contrato_meses) setContratoMeses(initialQuote.contrato_meses)
    if (initialQuote.margem_pct !== undefined) setMargemPct(initialQuote.margem_pct)
    if (initialQuote.titulo) setTituloProposta(initialQuote.titulo)

    if (initialQuote.maquinas_comparadas && initialQuote.maquinas_comparadas.length > 0) {
      const mList: MachineFormData[] = initialQuote.maquinas_comparadas.map((mc) => ({
        machineId: mc.machineId,
        productId: undefined,
        machineName: mc.machineName,
        serial: mc.serial || '',
        contadorInicial: mc.contador_inicial || 0,
        valorCompra: mc.valorCompra || 0,
        paybackMeses: mc.paybackMeses || 18,
        scanner: mc.scanner ?? true,
        scannerTipo: mc.scannerDados || '',
        scannerVelocidade: '',
        supplies: mc.supplies || [],
      }))
      setMachines(mList)
    }
  }, [initialQuote])

  // CÁLCULO DAS MÁQUINAS EM TEMPO REAL
  const calculatedMachines: RentalMachineCalculation[] = machines.map((m, idx) => {
    return calculateMachineRental({
      machineId: m.machineId,
      machineName: m.machineName || `Máquina ${idx + 1}`,
      serial: m.serial,
      contadorInicial: m.contadorInicial,
      valorCompra: m.valorCompra,
      paybackMeses: m.paybackMeses,
      supplies: m.supplies,
      franquiaPaginas,
      contratoMeses,
      margemPct,
      scanner: m.scanner,
      scannerDados: m.scannerTipo,
      excedenteManual: excedenteEditavel[idx],
    })
  })

  // COMPARAÇÃO SE HOUVER 2 MÁQUINAS
  const comparison =
    calculatedMachines.length === 2
      ? calculateComparison(calculatedMachines[0], calculatedMachines[1], franquiaPaginas)
      : null

  const handleAddSecondMachine = () => {
    if (machines.length >= 2) return
    setMachines([
      ...machines,
      {
        ...EMPTY_MACHINE,
        paybackMeses: defaultPayback,
      },
    ])
  }

  const handleRemoveSecondMachine = () => {
    setMachines([machines[0]])
  }

  const handleGenerateProposal = async () => {
    // Validação
    if (!customer.cliente_nome_livre.trim()) {
      toast({
        title: 'Selecione ou informe o Cliente',
        description: 'É necessário identificar o cliente/locatário para gerar a proposta.',
        variant: 'destructive',
      })
      return
    }

    const hasInvalidMachine = machines.some((m) => !m.machineName.trim())
    if (hasInvalidMachine) {
      toast({
        title: 'Selecione o equipamento',
        description: 'Todos os cards de máquina devem ter uma impressora selecionada no catálogo.',
        variant: 'destructive',
      })
      return
    }

    setSavingQuote(true)
    try {
      // Cria registros em rental_machines para guardar os seriais e supplies
      const createdMachineIds: string[] = []
      for (const m of machines) {
        if (m.productId) {
          const rMach = await createRentalMachine({
            produto: m.productId,
            serial: m.serial,
            contador_inicial: m.contadorInicial,
            supplies: m.supplies,
            valor_compra: m.valorCompra,
            payback_meses: m.paybackMeses,
            scanner: m.scanner,
            scanner_tipo: m.scannerTipo,
            ativo: true,
          })
          createdMachineIds.push(rMach.id)
        }
      }

      const resultados: RentalQuoteResults = {
        machines: calculatedMachines,
        volumeMensal,
        franquiaPaginas,
        contratoMeses,
        margemPct,
        paybackMesesPadrao: defaultPayback,
        breakEvenPaginas: comparison?.breakEvenPaginas,
        vantagemDescricao: comparison?.vantagemDescricao,
        melhorOpcaoIndex: comparison?.melhorOpcaoIndex,
      }

      const quoteData: Partial<RentalQuote> = {
        cliente_id: customer.cliente_id || undefined,
        cliente_nome_livre: customer.cliente_nome_livre.trim(),
        cliente_telefone: customer.cliente_telefone.trim(),
        cliente_documento: customer.cliente_documento.trim(),
        cliente_endereco: customer.cliente_endereco.trim(),
        maquinas: createdMachineIds.length > 0 ? createdMachineIds : undefined,
        maquinas_comparadas: calculatedMachines,
        volume_mensal: volumeMensal,
        franquia_paginas: franquiaPaginas,
        contrato_meses: contratoMeses,
        excesso_pagina_valor: calculatedMachines[0]?.excedenteSugerido || 0,
        scanner: machines[0]?.scanner ?? true,
        scanner_dados: machines[0]?.scannerTipo || '',
        margem_pct: margemPct,
        payback_meses: defaultPayback,
        resultados,
        status: 'proposta_gerada',
        titulo: tituloProposta || 'Locação de Impressoras',
      }

      const createdQuote = await createRentalQuote(quoteData)

      toast({
        title: 'Proposta Comercial gerada com sucesso!',
        description: `Proposta vinculada a ${customer.cliente_nome_livre}.`,
      })

      clearDraftRental()
      onQuoteGenerated(createdQuote)
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao gerar proposta',
        description: 'Verifique se os dados estão completos e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSavingQuote(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* CABEÇALHO DO SIMULADOR */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Calculator className="h-5 w-5 text-indigo-600" />
            <span>Simulador & Precificação de Locação</span>
          </h2>
          <p className="text-xs text-slate-500">
            Funil de Locação: Precificação dos insumos (CPP) → Comparativo → Geração de Proposta →
            Contrato.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {machines.length === 1 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddSecondMachine}
              className="text-xs font-semibold text-indigo-600 border-indigo-200 hover:bg-indigo-50 gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar 2ª Máquina (Comparar)
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRemoveSecondMachine}
              className="text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Voltar para 1 Máquina
            </Button>
          )}

          <Button
            type="button"
            onClick={handleGenerateProposal}
            disabled={savingQuote}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 shadow-sm"
          >
            <FileText className="h-4 w-4" />
            <span>{savingQuote ? 'Gerando...' : 'GERAR PROPOSTA'}</span>
          </Button>
        </div>
      </div>

      {/* SELEÇÃO DO CLIENTE / LOCATÁRIO */}
      <RentalCustomerSelect value={customer} onChange={setCustomer} />

      {/* PARÂMETROS GERAIS DO CONTRATO (FRANQUIA, VOLUME, MARGEM, PRAZO) */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-indigo-600" />
            <h3 className="font-bold text-slate-800 text-xs">Parâmetros de Contrato & Franquia</h3>
          </div>
          <span className="text-[10px] text-slate-500">
            Fórmulas: CPP = custo ÷ durabilidade | Franquia = locação + (págs × CPP revenda)
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700">Franquia de Páginas *</Label>
            <Input
              type="number"
              min="100"
              step="100"
              value={franquiaPaginas || ''}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10) || 0
                setFranquiaPaginas(val)
                setVolumeMensal(val)
              }}
              className="h-9 text-xs font-mono font-bold text-indigo-950"
            />
            <p className="text-[10px] text-slate-400">Ex: 1.000 págs/mês</p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700">Margem (%) *</Label>
            <div className="relative">
              <Input
                type="number"
                min="0"
                max="500"
                value={margemPct || ''}
                onChange={(e) => setMargemPct(parseFloat(e.target.value) || 0)}
                className="h-9 text-xs font-mono font-bold pr-7"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">
                %
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Sobre o CPP de custo</p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700">Prazo Contrato</Label>
            <Input
              type="number"
              min="1"
              max="60"
              value={contratoMeses || ''}
              onChange={(e) => setContratoMeses(parseInt(e.target.value, 10) || 12)}
              className="h-9 text-xs font-mono"
            />
            <p className="text-[10px] text-slate-400">Padrão: 12 meses</p>
          </div>

          <div className="space-y-1 col-span-2">
            <Label className="text-xs font-semibold text-slate-700">Título da Proposta</Label>
            <Input
              value={tituloProposta}
              onChange={(e) => setTituloProposta(e.target.value)}
              placeholder="Ex: Locação de Multifuncional Laser - Contrato Anual"
              className="h-9 text-xs"
            />
            <p className="text-[10px] text-slate-400">
              Aparecerá no cabeçalho da proposta impressa
            </p>
          </div>
        </div>
      </div>

      {/* CARDS DAS MÁQUINAS (1 OU 2) */}
      <div
        className={`grid gap-4 ${machines.length === 2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}
      >
        {machines.map((mach, idx) => (
          <RentalMachineCard
            key={idx}
            index={idx}
            data={mach}
            onChange={(updated) => {
              const list = [...machines]
              list[idx] = updated
              setMachines(list)
            }}
            onRemove={handleRemoveSecondMachine}
            canRemove={machines.length > 1}
          />
        ))}
      </div>

      {/* RESULTADOS FINANCEIROS & ANÁLISE COMPARATIVA */}
      <div className="rounded-xl border-2 border-indigo-200 bg-white p-5 shadow space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-indigo-600" />
            <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wide">
              Resultados da Precificação & Franquia Sugerida
            </h3>
          </div>
          <Badge className="bg-indigo-600 text-white font-mono text-xs">
            Franquia: {franquiaPaginas.toLocaleString('pt-BR')} págs/mês
          </Badge>
        </div>

        <div
          className={`grid gap-4 ${calculatedMachines.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}
        >
          {calculatedMachines.map((cm, idx) => (
            <div
              key={idx}
              className={`rounded-lg border-2 p-4 space-y-3 transition-all ${
                comparison && comparison.melhorOpcaoIndex === idx
                  ? 'border-emerald-500 bg-emerald-50/30'
                  : 'border-slate-200 bg-slate-50/50'
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                    Opção {idx + 1}
                  </span>
                  <h4 className="font-bold text-slate-900 text-sm">{cm.machineName}</h4>
                </div>
                {comparison && comparison.melhorOpcaoIndex === idx && (
                  <Badge className="bg-emerald-600 text-white font-bold text-[10px]">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Mais Vantajosa
                  </Badge>
                )}
              </div>

              {/* MÉTRICAS CHAVE EM GRID */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-2 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">CPP Fornecedor:</span>
                  <span className="font-mono font-bold text-slate-800 text-xs tabular-nums">
                    R$ {cm.cppFornecedor.toFixed(4)} / pág
                  </span>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">
                    CPP Revenda ({margemPct}%):
                  </span>
                  <span className="font-mono font-bold text-indigo-700 text-xs tabular-nums">
                    R$ {cm.cppRevenda.toFixed(4)} / pág
                  </span>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">
                    Locação Mensal (Payback {cm.paybackMeses}m):
                  </span>
                  <span className="font-mono font-bold text-slate-800 text-xs tabular-nums">
                    R$ {cm.locacaoMensal.toFixed(2)} / mês
                  </span>
                </div>
                <div className="bg-indigo-50 p-2 rounded border border-indigo-200">
                  <span className="text-[10px] text-indigo-800 font-bold block">
                    FRANQUIA SUGERIDA:
                  </span>
                  <span className="font-mono font-black text-indigo-950 text-sm tabular-nums">
                    R$ {cm.franquiaSugerida.toFixed(2)} / mês
                  </span>
                </div>
              </div>

              {/* EXCEDENTE SUGERIDO E TCO */}
              <div className="space-y-2 pt-2 border-t border-slate-200 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Página Excedente (acima da franquia):</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-[11px] text-slate-500">R$</span>
                    <Input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={cm.excedenteSugerido}
                      onChange={(e) =>
                        setExcedenteEditavel({
                          ...excedenteEditavel,
                          [idx]: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="h-7 text-xs font-mono font-bold text-rose-700 text-right w-24"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-slate-600 pt-1 border-t border-slate-100">
                  <span>Custo Total do Contrato (TCO {contratoMeses} meses):</span>
                  <span className="font-mono font-bold text-slate-900 text-xs tabular-nums">
                    R$ {cm.tco.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* COMPARATIVO DE 2 MÁQUINAS: BREAK-EVEN EM PÁGINAS E DESTAQUE */}
        {comparison && (
          <div className="rounded-lg border-2 border-indigo-500 bg-indigo-50/70 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-600" />
              <h4 className="font-bold text-indigo-950 text-sm">
                Análise Comparativa & Ponto de Equilíbrio (Break-Even)
              </h4>
            </div>

            {comparison.breakEvenPaginas !== null && comparison.breakEvenPaginas > 0 && (
              <p className="text-xs text-indigo-900">
                • <strong>Ponto de Equilíbrio (Break-Even):</strong>{' '}
                <span className="font-mono font-extrabold text-sm text-indigo-950">
                  {comparison.breakEvenPaginas.toLocaleString('pt-BR')} páginas/mês
                </span>
                . Até esse volume mensal a máquina com menor custo fixo é mais rentável; acima dele,
                a com menor CPP gera maior economia.
              </p>
            )}

            <p className="text-xs font-semibold text-emerald-900 bg-emerald-100/70 p-2 rounded border border-emerald-300">
              ✓ {comparison.vantagemDescricao}
            </p>
          </div>
        )}

        {/* BOTÃO FINAL GERAR PROPOSTA */}
        <div className="pt-2 flex justify-end">
          <Button
            type="button"
            size="lg"
            onClick={handleGenerateProposal}
            disabled={savingQuote}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm gap-2 shadow"
          >
            <FileText className="h-5 w-5" />
            <span>{savingQuote ? 'Processando Proposta...' : 'GERAR PROPOSTA COMERCIAL'}</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
