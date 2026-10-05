import {
  buildContractSnapshot,
  CONTRACT_DETAIL_FIELDS,
  type ContractDetails,
} from '@/lib/rental-contract-template'
import { useState, useEffect, useCallback } from 'react'
import {
  Printer,
  Calculator,
  FileText,
  FileSignature,
  Layers,
  RefreshCw,
  FolderClock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ModernRentalSimulator } from '@/components/pricing/ModernRentalSimulator'
import { RentalProposalPrintView } from '@/components/RentalProposalPrintView'
import { RentalContractPrintView } from '@/components/RentalContractPrintView'
import { RentalContractsList } from '@/components/RentalContractsList'
import { RentalQuotesList } from '@/components/RentalQuotesList'
import {
  getRentalQuotes,
  getRentalQuote,
  getRentalContracts,
  createRentalContract,
  generateNextContractNumber,
} from '@/services/rental'
import {
  getParametrosGlobais,
  getSuprimentos,
  getImpressoras,
  getPriceAuditHistory,
  createContratoPrecificacao,
  type ParametrosGlobais,
  type SuprimentoRecord,
  type ImpressoraRecord,
  type AuditoriaPrecoRecord,
} from '@/services/pricing-module'
import { usePermissions } from '@/hooks/use-permissions'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import type { RentalQuote, RentalContract, RentalMachineCalculation } from '@/types'

export default function LocacaoImpressoras() {
  const { toast } = useToast()
  const { isAdmin, hasPermission } = usePermissions()

  // Permissões: Admin bypass total; edição restrita a gerência/admin
  const canEditPricing = isAdmin || hasPermission('precificacao')

  // Aba ativa simplificada: 'simulador' | 'proposta' | 'propostas_lista' | 'contrato' | 'contratos_lista'
  // Suprimentos, Impressoras e Parâmetros & Auditoria agora ficam em cascata dentro do Simulador
  const [activeTab, setActiveTab] = useState<string>('simulador')
  const [simulatorCascadeSection, setSimulatorCascadeSection] = useState<string>('')

  // Proposta ativa no visualizador
  const [currentQuote, setCurrentQuote] = useState<RentalQuote | null>(null)

  // Contrato ativo no visualizador
  const [currentContract, setCurrentContract] = useState<RentalContract | null>(null)

  // Histórico de propostas cadastradas (rental_quotes)
  const [quotesList, setQuotesList] = useState<RentalQuote[]>([])
  const [loadingQuotes, setLoadingQuotes] = useState(false)

  // Lista de contratos cadastrados
  const [contractsList, setContractsList] = useState<RentalContract[]>([])
  const [loadingContracts, setLoadingContracts] = useState(false)

  // Dados do novo módulo de precificação
  const [parametros, setParametros] = useState<ParametrosGlobais>({
    id: 'default',
    mark_up_revenda: 1.45,
    vida_util_padrao_meses: 48,
    producao_mensal_referencia: 1000,
  })
  const [suppliesList, setSuppliesList] = useState<SuprimentoRecord[]>([])
  const [printersList, setPrintersList] = useState<ImpressoraRecord[]>([])
  const [auditList, setAuditList] = useState<AuditoriaPrecoRecord[]>([])
  const [loadingPricingData, setLoadingPricingData] = useState(false)

  // Modal de geração de contrato a partir da proposta
  const [contractModalOpen, setContractModalOpen] = useState(false)
  const [machineForContract, setMachineForContract] = useState<RentalMachineCalculation | null>(
    null,
  )
  const [creatingContract, setCreatingContract] = useState(false)
  const [nextContractNumber, setNextContractNumber] = useState('')
  const [contractStartDate, setContractStartDate] = useState(
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/Cuiaba' }),
  )
  const [clausulasAdicionais, setClausulasAdicionais] = useState('')
  const [contractDetails, setContractDetails] = useState<ContractDetails>({})

  // Carrega dados de precificação (parâmetros, suprimentos, impressoras e auditoria)
  const loadPricingData = useCallback(async () => {
    setLoadingPricingData(true)
    try {
      const [params, sups, imps, audits] = await Promise.all([
        getParametrosGlobais(),
        getSuprimentos(true),
        getImpressoras(true),
        getPriceAuditHistory(50),
      ])
      setParametros(params)
      setSuppliesList(sups)
      setPrintersList(imps)
      setAuditList(audits)
    } catch (err) {
      console.error('Erro ao carregar dados de precificação:', err)
    } finally {
      setLoadingPricingData(false)
    }
  }, [])

  // Carrega propostas existentes
  const loadQuotes = useCallback(async () => {
    setLoadingQuotes(true)
    try {
      const list = await getRentalQuotes()
      setQuotesList(list)
    } finally {
      setLoadingQuotes(false)
    }
  }, [])

  // Carrega contratos existentes
  const loadContracts = useCallback(async () => {
    setLoadingContracts(true)
    try {
      const list = await getRentalContracts()
      setContractsList(list)
    } finally {
      setLoadingContracts(false)
    }
  }, [])

  // Atualiza tudo
  const reloadAll = useCallback(() => {
    loadPricingData()
    loadQuotes()
    loadContracts()
  }, [loadPricingData, loadQuotes, loadContracts])

  useEffect(() => {
    loadPricingData()
    loadQuotes()
    loadContracts()
  }, [loadPricingData, loadQuotes, loadContracts])

  // Inscrição Realtime para atualizar propostas, contratos e dados de suprimentos/impressoras
  useRealtime('rental_quotes', () => loadQuotes())
  useRealtime('rental_contracts', () => loadContracts())
  useRealtime('suprimentos', () => loadPricingData())
  useRealtime('impressoras', () => loadPricingData())
  useRealtime('parametros', () => loadPricingData())

  // Quando proposta é gerada pelo simulador novo
  const handleQuoteGenerated = (quote: RentalQuote) => {
    setCurrentQuote(quote)
    loadQuotes()
    setActiveTab('proposta')
  }

  // Ao selecionar uma proposta no histórico para abrir
  const handleOpenQuote = (quote: RentalQuote) => {
    setCurrentQuote(quote)
    setActiveTab('proposta')
  }

  // Ao clicar em "Gerar Contrato" dentro da proposta
  const handleOpenGenerateContractModal = async (machine: RentalMachineCalculation) => {
    setMachineForContract(machine)
    try {
      const num = await generateNextContractNumber()
      setNextContractNumber(num)
    } catch {
      const curYear = new Date().getFullYear()
      setNextContractNumber(`CT-${curYear}-001`)
    }
    setContractStartDate(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Cuiaba' }))
    setClausulasAdicionais('')
    const c = currentQuote?.expand?.cliente_id
    setContractDetails({
      nome: c?.name || currentQuote?.cliente_nome_livre || '',
      documento: currentQuote?.cliente_documento || c?.cpf_cnpj || '',
      endereco: [currentQuote?.cliente_endereco || c?.endereco, c?.city, c?.state, c?.zip]
        .filter(Boolean)
        .join(', '),
      contato: c?.email || currentQuote?.cliente_telefone || c?.phone || '',
      serial: machine.serial || '',
      contador: machine.contador_inicial == null ? '' : String(machine.contador_inicial),
    })
    setContractModalOpen(true)
  }

  const buildDraft = (): Partial<RentalContract> | null => {
    if (!currentQuote || !machineForContract) return null
    const locatario = {
      nome: contractDetails.nome?.trim() || '',
      cpf_cnpj: contractDetails.documento?.trim() || '',
      endereco: contractDetails.endereco?.trim() || '',
      telefone: contractDetails.contato?.trim() || '',
    }
    const payload: Partial<RentalContract> = {
      proposta: currentQuote.id,
      numero: nextContractNumber.trim(),
      locatario_dados: locatario,
      franquia_paginas: currentQuote.franquia_paginas,
      valor_mensal: Math.round(machineForContract.franquiaSugerida * 100) / 100,
      excesso_pagina_valor: Math.round(machineForContract.excedenteSugerido * 10000) / 10000,
      contrato_meses: currentQuote.contrato_meses,
      data_inicio: contractStartDate,
      status: 'rascunho',
      clausulas_adicionais: clausulasAdicionais.trim() || undefined,
    }
    const snapshot = buildContractSnapshot(
      {
        numeroContrato: payload.numero || '',
        locatario: {
          nome: locatario.nome,
          cpfCnpj: locatario.cpf_cnpj,
          endereco: locatario.endereco,
          telefone: locatario.telefone,
        },
        equipamento: {
          nome: machineForContract.machineName,
          serial: contractDetails.serial || '',
          contadorInicial:
            contractDetails.contador === '' || contractDetails.contador == null
              ? undefined
              : Number(contractDetails.contador),
        },
        franquiaPaginas: payload.franquia_paginas || 0,
        valorMensal: payload.valor_mensal || 0,
        valorExcedentePagina: payload.excesso_pagina_valor || 0,
        prazoMeses: payload.contrato_meses || 0,
        dataInicio: contractStartDate,
      },
      contractDetails,
      clausulasAdicionais.trim(),
    )
    const equipment = {
      nome: machineForContract.machineName,
      produto_id: machineForContract.machineId,
      serial: contractDetails.serial || '',
      contador_inicial: snapshot.data.equipamento.contadorInicial,
      scanner: machineForContract.scanner,
      scanner_dados: machineForContract.scannerDados,
      supplies: machineForContract.supplies,
      modelo_contrato: snapshot,
    }
    payload.equipamento_dados = equipment
    return payload
  }

  const previewContract = () => {
    const draft = buildDraft()
    if (!draft) return
    setCurrentContract({ ...draft, id: '', created: new Date().toISOString() } as RentalContract)
    setContractModalOpen(false)
    setActiveTab('contrato')
  }

  const handleConfirmContract = async (e: React.FormEvent) => {
    e.preventDefault()
    const draft = buildDraft()
    if (
      !draft ||
      !draft.numero ||
      !contractStartDate ||
      !draft.contrato_meses ||
      draft.contrato_meses < 1 ||
      !draft.franquia_paginas ||
      draft.franquia_paginas < 1 ||
      !draft.valor_mensal ||
      draft.valor_mensal < 0 ||
      (draft.excesso_pagina_valor ?? -1) < 0
    ) {
      toast({
        title: 'Confira número, data, prazo, franquia e valores antes de salvar.',
        variant: 'destructive',
      })
      return
    }
    setCreatingContract(true)
    try {
      const created = await createRentalContract(draft)
      toast({
        title: 'Rascunho salvo',
        description:
          'Texto e dados desta versão foram guardados. Assinatura e entrega ainda precisam ser comprovadas.',
      })
      setCurrentContract(created)
      setContractModalOpen(false)
      loadContracts()
      setActiveTab('contrato')
    } catch {
      toast({
        title: 'Não foi possível salvar o rascunho',
        description:
          'Confira a conexão e se o número já existe. Nenhum recebimento ou assinatura foi registrado.',
        variant: 'destructive',
      })
    } finally {
      setCreatingContract(false)
    }
  }

  // Ao abrir proposta a partir da lista de contratos
  const handleOpenQuoteFromList = async (quoteId: string) => {
    try {
      const q = await getRentalQuote(quoteId)
      if (q) {
        setCurrentQuote(q)
        setActiveTab('proposta')
      } else {
        toast({ title: 'Proposta não encontrada', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Erro ao carregar proposta vinculada', variant: 'destructive' })
    }
  }

  const isRefreshing = loadingQuotes || loadingContracts || loadingPricingData

  return (
    <div className="space-y-6">
      {/* CABEÇALHO DO MÓDULO */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md">
            <Printer className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                Módulo de Precificação de Locação de Impressoras
              </h1>
              <span className="text-[10px] font-mono font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                v0.0.259
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Juca Cartuchos — Simulador com consultas em cascata, precificação por CPP e contratos
              congelados.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={reloadAll}
            disabled={isRefreshing}
            className="text-xs font-semibold text-slate-700 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* TABS PRINCIPAIS DO MÓDULO (SIMPLIFICADAS PARA LIBERAR ESPAÇO) */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setActiveTab(val)
        }}
        className="space-y-4"
      >
        <TabsList className="bg-slate-100 p-1 rounded-xl flex flex-wrap gap-1 max-w-full print:hidden">
          <TabsTrigger
            value="simulador"
            className="text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm gap-1.5"
          >
            <Calculator className="h-3.5 w-3.5" />
            <span>1. Simulador & Consultas</span>
          </TabsTrigger>

          <TabsTrigger
            value="proposta"
            disabled={!currentQuote}
            className="text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm gap-1.5 disabled:opacity-50"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>2. Proposta</span>
          </TabsTrigger>

          <TabsTrigger
            value="propostas_lista"
            className="text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm gap-1.5"
          >
            <FolderClock className="h-3.5 w-3.5" />
            <span>Propostas ({quotesList.length})</span>
          </TabsTrigger>

          <TabsTrigger
            value="contrato"
            disabled={!currentContract}
            className="text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm gap-1.5 disabled:opacity-50"
          >
            <FileSignature className="h-3.5 w-3.5" />
            <span>3. Contrato</span>
          </TabsTrigger>

          <TabsTrigger
            value="contratos_lista"
            className="text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm gap-1.5"
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Contratos ({contractsList.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* 1. SIMULADOR COM MOTOR PRECISO E OPÇÕES DE CONSULTA EM CASCATA */}
        <TabsContent value="simulador">
          <ModernRentalSimulator
            printers={printersList}
            supplies={suppliesList}
            parametros={parametros}
            auditHistory={auditList}
            onQuoteGenerated={handleQuoteGenerated}
            onReloadData={loadPricingData}
            initialCascadeSection={simulatorCascadeSection}
            onOpenSupplyEdit={(supModel) => {
              setSimulatorCascadeSection('suprimentos')
            }}
            readOnly={!canEditPricing}
          />
        </TabsContent>

        {/* 5. PROPOSTA COMERCIAL VISUALIZAÇÃO */}
        <TabsContent value="proposta">
          {currentQuote ? (
            <RentalProposalPrintView
              quote={currentQuote}
              onGenerateContract={handleOpenGenerateContractModal}
              onBack={() => setActiveTab('propostas_lista')}
            />
          ) : (
            <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
              <p className="text-xs text-slate-500">
                Nenhuma proposta selecionada. Utilize o Simulador ou o Histórico de Propostas para
                abrir uma proposta.
              </p>
            </div>
          )}
        </TabsContent>

        {/* 6. HISTÓRICO DE PROPOSTAS */}
        <TabsContent value="propostas_lista">
          <RentalQuotesList
            quotes={quotesList}
            onOpenQuote={handleOpenQuote}
            onReload={loadQuotes}
          />
        </TabsContent>

        {/* 7. CONTRATO IMPRESSÃO / VISUALIZAÇÃO */}
        <TabsContent value="contrato">
          {currentContract ? (
            <RentalContractPrintView
              contract={currentContract}
              onBack={() => {
                if (!currentContract.id) setContractModalOpen(true)
                else setActiveTab('contratos_lista')
              }}
            />
          ) : (
            <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
              <p className="text-xs text-slate-500">
                Nenhum contrato ativo selecionado. Escolha um contrato na lista ou gere a partir da
                proposta.
              </p>
            </div>
          )}
        </TabsContent>

        {/* 8. LISTA DE CONTRATOS */}
        <TabsContent value="contratos_lista">
          <RentalContractsList
            contracts={contractsList}
            onSelectContract={(c) => {
              setCurrentContract(c)
              setActiveTab('contrato')
            }}
            onOpenQuote={handleOpenQuoteFromList}
            onReload={loadContracts}
          />
        </TabsContent>
      </Tabs>

      {/* MODAL DE EMISSÃO DE CONTRATO (CONGELA OS DADOS COM CLÁUSULAS PADRONIZADAS) */}
      <Dialog open={contractModalOpen} onOpenChange={setContractModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-5">
          <DialogHeader>
            <div className="flex items-center gap-2 text-indigo-600">
              <FileSignature className="h-5 w-5" />
              <DialogTitle className="text-base font-bold text-slate-900">
                Preparar contrato de locação
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500">
              Modelo revisado com anexos e assinatura eletrônica. Salvar gera um rascunho, sem
              ativar a locação ou comprovar assinatura.
            </DialogDescription>
          </DialogHeader>

          {machineForContract && currentQuote && (
            <form onSubmit={handleConfirmContract} className="space-y-3 py-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <p>
                  <strong>Cliente:</strong> {currentQuote.cliente_nome_livre || 'Cliente'}
                </p>
                <p>
                  <strong>Equipamento Escolhido:</strong> {machineForContract.machineName}
                </p>
                <p>
                  <strong>Franquia Mensal:</strong> {currentQuote.franquia_paginas} páginas/mês
                </p>
                <p>
                  <strong>Valor Mensal:</strong> R$ {machineForContract.franquiaSugerida.toFixed(2)}
                </p>
                <p>
                  <strong>Excedente Homologado (CPP Venda):</strong> R${' '}
                  {machineForContract.excedenteSugerido.toFixed(4)} / pág
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Número do Contrato *</Label>
                <Input
                  value={nextContractNumber}
                  onChange={(e) => setNextContractNumber(e.target.value)}
                  placeholder="Ex: CT-2026-001"
                  required
                  className="h-9 text-xs font-mono font-bold text-indigo-900"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">
                  Data prevista de entrega e início
                </Label>
                <Input
                  type="date"
                  value={contractStartDate}
                  onChange={(e) => setContractStartDate(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">
                  Cláusulas / Observações Especiais (Opcional)
                </Label>
                <Input
                  value={clausulasAdicionais}
                  onChange={(e) => setClausulasAdicionais(e.target.value)}
                  placeholder="Ex: Entrega e treinamento no local..."
                  className="h-9 text-xs"
                />
              </div>

              <details className="rounded border p-3" open>
                <summary className="font-semibold cursor-pointer">
                  Conferir cliente, equipamento e anexos
                </summary>
                <p className="my-2 text-slate-600">
                  Preencha dados reais. Campos vazios ficam destacados no rascunho; fotos e
                  comprovantes devem acompanhar o PDF no provedor de assinatura.
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {CONTRACT_DETAIL_FIELDS.map(([key, label, type]) => (
                    <label key={key} className="space-y-1 block">
                      <span>{label}</span>
                      <Input
                        aria-label={label}
                        type={type}
                        min={type === 'number' ? 0 : undefined}
                        step={key === 'valorBem' ? '0.01' : '1'}
                        value={contractDetails[key] || ''}
                        onChange={(e) =>
                          setContractDetails((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                      />
                    </label>
                  ))}
                </div>
              </details>
              <p className="text-slate-600">
                Assinatura por link: envie o PDF e anexos por um provedor de assinatura. O sistema
                ainda não envia links nem armazena o PDF assinado automaticamente.
              </p>
              <DialogFooter className="pt-2 gap-2 flex-wrap">
                <Button type="button" variant="outline" onClick={previewContract}>
                  Visualizar sem salvar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setContractModalOpen(false)}
                  disabled={creatingContract}
                  className="text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={creatingContract}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5"
                >
                  <FileSignature className="h-3.5 w-3.5" />
                  <span>{creatingContract ? 'Salvando...' : 'Salvar rascunho'}</span>
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
