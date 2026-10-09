import { CommercialRentalSimulator } from '@/components/pricing/CommercialRentalSimulator'
import { useSearchParams } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import {
  buildContractSnapshot,
  inheritRentalContractDetails,
  CONTRACT_DETAIL_FIELDS,
  type ContractDetails,
} from '@/lib/rental-contract-template'
import { useState, useEffect, useCallback, useRef } from 'react'
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
  updateRentalContract,
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
  const [rentalSearch] = useSearchParams()
  const [deepLinkError, setDeepLinkError] = useState('')
  useEffect(() => {
    let alive = true
    const id = rentalSearch.get('contrato')
    if (id) {
      setDeepLinkError('')
      pb.collection('rental_contracts')
        .getOne<RentalContract>(id, { requestKey: null })
        .then((record) => {
          if (alive) {
            setCurrentContract(record)
            setActiveTab('contrato')
          }
        })
        .catch(() => {
          if (alive)
            setDeepLinkError(
              'Não foi possível abrir o contrato solicitado. Confira o acesso e tente novamente.',
            )
        })
    } else if (rentalSearch.get('proposta')) {
      setDeepLinkError('')
      pb.collection('rental_quotes')
        .getOne<RentalQuote>(rentalSearch.get('proposta')!, { requestKey: null })
        .then((record) => {
          if (alive) {
            setCurrentQuote(record)
            setActiveTab('proposta')
          }
        })
        .catch(() => {
          if (alive)
            setDeepLinkError(
              'Não foi possível abrir a proposta solicitada. Confira o acesso e tente novamente.',
            )
        })
    } else if (rentalSearch.get('aba') === 'contratos_lista') setActiveTab('contratos_lista')
    return () => {
      alive = false
    }
  }, [rentalSearch])
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
  const contractSaveLock = useRef(false)
  const [editingContractId, setEditingContractId] = useState('')
  const [nextContractNumber, setNextContractNumber] = useState('')
  const [contractStartDate, setContractStartDate] = useState(
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/Cuiaba' }),
  )
  const [clausulasAdicionais, setClausulasAdicionais] = useState('')
  const [contractDetails, setContractDetails] = useState<ContractDetails>({})

  // Carrega dados de precificação (parâmetros, suprimentos, impressoras e auditoria)
  const loadPricingData = useCallback(async () => {
    if (!isAdmin) {
      setSuppliesList([])
      setPrintersList([])
      setAuditList([])
      return
    }
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
  }, [isAdmin])

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
    const existing = contractsList.find(
      (c) =>
        c.proposta === currentQuote?.id &&
        c.status !== 'encerrado' &&
        c.equipamento_dados?.produto_id === machine.machineId &&
        c.equipamento_dados?.nome === machine.machineName,
    )
    const saved = existing?.equipamento_dados as typeof existing.equipamento_dados & {
      modelo_contrato?: ReturnType<typeof buildContractSnapshot>
    }
    if (existing && (existing.status !== 'rascunho' || !saved?.modelo_contrato)) {
      setCurrentContract(existing)
      setActiveTab('contrato')
      toast({
        title: 'Contrato existente aberto',
        description: 'O contrato arquivado foi preservado.',
      })
      return
    }
    if (existing && saved?.modelo_contrato) {
      setEditingContractId(existing.id)
      setNextContractNumber(existing.numero)
      setContractStartDate(existing.data_inicio?.slice(0, 10) || '')
      setClausulasAdicionais(existing.clausulas_adicionais || '')
      setContractDetails(saved.modelo_contrato.details)
      setContractModalOpen(true)
      return
    }
    setEditingContractId('')
    try {
      const num = await generateNextContractNumber()
      setNextContractNumber(num)
    } catch {
      const curYear = new Date().getFullYear()
      setNextContractNumber(`CT-${curYear}-001`)
    }
    setContractStartDate(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Cuiaba' }))
    setClausulasAdicionais('')
    setContractDetails(currentQuote ? inheritRentalContractDetails(currentQuote, machine) : {})
    setContractModalOpen(true)
  }

  const buildDraft = (): Partial<RentalContract> | null => {
    if (!currentQuote || !machineForContract) return null
    const locatario = {
      nome: contractDetails.nome?.trim() || '',
      cpf_cnpj: contractDetails.documento?.trim() || '',
      endereco: contractDetails.endereco?.trim() || '',
      telefone: contractDetails.contato?.trim() || '',
      rg_ie: currentQuote.expand?.cliente_id?.rg_ie || '',
      bairro: currentQuote.expand?.cliente_id?.bairro || '',
      cidade: currentQuote.expand?.cliente_id?.city || '',
      estado: currentQuote.expand?.cliente_id?.state || '',
      cep: currentQuote.expand?.cliente_id?.zip || '',
      email: currentQuote.expand?.cliente_id?.email || '',
    }
    const payload: Partial<RentalContract> = {
      proposta: currentQuote.id,
      numero: nextContractNumber.trim(),
      locatario_dados: locatario,
      franquia_paginas: currentQuote.franquia_paginas,
      valor_mensal: Math.round(machineForContract.franquiaSugerida * 100) / 100,
      excesso_pagina_valor: Math.round(machineForContract.excedenteSugerido * 1000000) / 1000000,
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
          scanner: machineForContract.scanner,
          scannerDados: machineForContract.scannerDados,
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
      origem_proposta: {
        id: currentQuote.id,
        cliente_id: currentQuote.cliente_id || '',
        versao_proposta: currentQuote.updated || currentQuote.created || '',
        maquina_escolhida: machineForContract,
        cliente: locatario,
        aprovacao_informada: {
          data: contractDetails.aprovacaoData || '',
          por: contractDetails.aprovacaoNome || '',
          referencia: contractDetails.aprovacaoReferencia || '',
        },
      },
    }
    payload.equipamento_dados = equipment
    return payload
  }

  const saveContract = async (requireApproval: boolean) => {
    if (contractSaveLock.current) return
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
    if (
      requireApproval &&
      (!contractDetails.aprovacaoData ||
        !contractDetails.aprovacaoNome?.trim() ||
        !contractDetails.aprovacaoReferencia?.trim())
    ) {
      toast({
        title: 'Registre a aprovação recebida do cliente',
        description:
          'Informe data, responsável e referência da mensagem ou documento. Isso não substitui a assinatura do contrato.',
        variant: 'destructive',
      })
      return
    }
    const sameContract = contractsList.find(
      (c) =>
        c.proposta === currentQuote?.id &&
        c.status !== 'encerrado' &&
        c.equipamento_dados?.produto_id === machineForContract?.machineId &&
        c.equipamento_dados?.nome === machineForContract?.machineName,
    )
    if (sameContract && sameContract.id !== editingContractId) {
      toast({
        title: 'Já existe contrato para esta proposta e equipamento',
        description:
          'Os dados preenchidos continuam na tela. Abra o contrato salvo pela lista para conferi-lo.',
      })
      return
    }
    contractSaveLock.current = true
    setCreatingContract(true)
    try {
      let created: RentalContract
      if (editingContractId) {
        const saved = await pb
          .collection('rental_contracts')
          .getOne<RentalContract>(editingContractId)
        if (saved.status !== 'rascunho') throw new Error('Contrato não está mais em rascunho')
        created = await updateRentalContract(editingContractId, draft)
      } else {
        created = await createRentalContract(draft)
      }
      if (!created.id) throw new Error('Gravação não confirmada')
      setEditingContractId(created.id)
      toast({
        title: 'Rascunho salvo',
        description:
          'Contrato arquivado em Contratos com os dados da proposta. Imprima para colher assinaturas; aprovação e entrega são etapas distintas.',
      })
      setCurrentContract(created)
      setContractModalOpen(false)
      setContractsList((list) => [created, ...list.filter((c) => c.id !== created.id)])
      setActiveTab('contrato')
    } catch {
      toast({
        title: 'Não foi possível salvar o rascunho',
        description:
          'Confira a conexão e se o número já existe. Nenhum recebimento ou assinatura foi registrado.',
        variant: 'destructive',
      })
    } finally {
      contractSaveLock.current = false
      setCreatingContract(false)
    }
  }

  const handleConfirmContract = (e: React.FormEvent) => {
    e.preventDefault()
    void saveContract(true)
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
      {deepLinkError && (
        <p role="alert" className="text-red-700">
          {deepLinkError}
        </p>
      )}
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
          {!isAdmin ? (
            <CommercialRentalSimulator onQuoteGenerated={handleQuoteGenerated} />
          ) : (
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
          )}
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
                  {machineForContract.excedenteSugerido.toFixed(6)} / pág
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

              <section className="rounded border p-3 space-y-3">
                <h3 className="font-semibold">Aprovação recebida do cliente</h3>
                <p>
                  Registre a aprovação da proposta selecionada. O contrato será arquivado como
                  rascunho para assinatura.
                </p>
                <label className="block">
                  Data da aprovação
                  <Input
                    aria-label="Data da aprovação"
                    type="date"
                    value={contractDetails.aprovacaoData || ''}
                    onChange={(e) =>
                      setContractDetails((p) => ({ ...p, aprovacaoData: e.target.value }))
                    }
                  />
                </label>
                <label className="block">
                  Quem aprovou
                  <Input
                    aria-label="Quem aprovou"
                    value={contractDetails.aprovacaoNome || ''}
                    onChange={(e) =>
                      setContractDetails((p) => ({ ...p, aprovacaoNome: e.target.value }))
                    }
                  />
                </label>
                <label className="block">
                  Referência da aprovação (mensagem, e-mail ou documento)
                  <Input
                    aria-label="Referência da aprovação"
                    value={contractDetails.aprovacaoReferencia || ''}
                    onChange={(e) =>
                      setContractDetails((p) => ({ ...p, aprovacaoReferencia: e.target.value }))
                    }
                  />
                </label>
                <label className="block">
                  Forma de assinatura
                  <select
                    aria-label="Forma de assinatura"
                    className="block w-full border rounded p-2 bg-white"
                    value={contractDetails.modalidade || 'impressa'}
                    onChange={(e) =>
                      setContractDetails((p) => ({ ...p, modalidade: e.target.value }))
                    }
                  >
                    <option value="impressa">Impressa — assinatura à mão</option>
                    <option value="eletronica">Eletrônica — por provedor externo</option>
                  </select>
                </label>
              </section>
              <details className="rounded border p-3" open>
                <summary className="font-semibold cursor-pointer">
                  Conferir cliente, equipamento e anexos
                </summary>
                <p className="my-2 text-slate-600">
                  Dados disponíveis foram herdados da proposta e dos cadastros vinculados. O valor
                  do bem vem da precificação da proposta e não é alterado aqui. Confira local de
                  instalação e suprimentos; informação ausente não é inventada. Fotos e comprovantes
                  devem acompanhar a via impressa ou o PDF.
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {CONTRACT_DETAIL_FIELDS.map(([key, label, type]) => (
                    <label key={key} className="space-y-1 block">
                      <span>{label}</span>
                      <Input
                        readOnly={key === 'valorBem'}
                        title={
                          key === 'valorBem'
                            ? 'Herdado da precificação da proposta. Para alterar, revise a precificação e emita nova proposta.'
                            : undefined
                        }
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
                <Button
                  type="button"
                  variant="outline"
                  disabled={creatingContract}
                  onClick={() => void saveContract(false)}
                >
                  {creatingContract ? 'Salvando...' : 'Salvar rascunho e visualizar'}
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
                  <span>
                    {creatingContract ? 'Salvando...' : 'Arquivar contrato para assinatura'}
                  </span>
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
