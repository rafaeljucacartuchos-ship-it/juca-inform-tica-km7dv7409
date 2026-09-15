import { useState, useEffect, useCallback } from 'react'
import {
  Printer,
  Calculator,
  FileText,
  FileSignature,
  Layers,
  Settings as SettingsIcon,
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
import { RentalSimulator } from '@/components/RentalSimulator'
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
  getRentalSettings,
  updateRentalSettings,
} from '@/services/rental'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import type { RentalQuote, RentalContract, RentalMachineCalculation } from '@/types'

export default function LocacaoImpressoras() {
  const { toast } = useToast()

  // Aba ativa: 'simulador' | 'proposta' | 'propostas_lista' | 'contrato' | 'contratos_lista'
  const [activeTab, setActiveTab] = useState<string>('simulador')

  // Proposta ativa no visualizador
  const [currentQuote, setCurrentQuote] = useState<RentalQuote | null>(null)

  // Proposta para edição/reabertura no simulador
  const [quoteForEdit, setQuoteForEdit] = useState<RentalQuote | null>(null)

  // Contrato ativo no visualizador
  const [currentContract, setCurrentContract] = useState<RentalContract | null>(null)

  // Histórico de propostas cadastradas (rental_quotes)
  const [quotesList, setQuotesList] = useState<RentalQuote[]>([])
  const [loadingQuotes, setLoadingQuotes] = useState(false)

  // Lista de contratos cadastrados
  const [contractsList, setContractsList] = useState<RentalContract[]>([])
  const [loadingContracts, setLoadingContracts] = useState(false)

  // Modal de geração de contrato a partir da proposta
  const [contractModalOpen, setContractModalOpen] = useState(false)
  const [machineForContract, setMachineForContract] = useState<RentalMachineCalculation | null>(
    null,
  )
  const [creatingContract, setCreatingContract] = useState(false)
  const [nextContractNumber, setNextContractNumber] = useState('')
  const [contractStartDate, setContractStartDate] = useState(new Date().toISOString().split('T')[0])
  const [clausulasAdicionais, setClausulasAdicionais] = useState('')

  // Modal de Configurações Padrão
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [paybackDefaultInput, setPaybackDefaultInput] = useState('18')
  const [marginDefaultInput, setMarginDefaultInput] = useState('50')
  const [savingSettings, setSavingSettings] = useState(false)

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
    loadQuotes()
    loadContracts()
  }, [loadQuotes, loadContracts])

  useEffect(() => {
    loadQuotes()
    loadContracts()
  }, [loadQuotes, loadContracts])

  // Inscrição Realtime para atualizar propostas e contratos automaticamente
  useRealtime('rental_quotes', () => {
    loadQuotes()
  })

  useRealtime('rental_contracts', () => {
    loadContracts()
  })

  // Carrega configurações
  const handleOpenSettings = async () => {
    try {
      const s = await getRentalSettings()
      setPaybackDefaultInput(String(s.defaultPaybackMonths))
      setMarginDefaultInput(String(s.defaultMarginPct))
      setSettingsModalOpen(true)
    } catch {
      setSettingsModalOpen(true)
    }
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingSettings(true)
    try {
      const pb = parseInt(paybackDefaultInput, 10) || 18
      const mg = parseFloat(marginDefaultInput) || 50
      await updateRentalSettings({
        defaultPaybackMonths: pb,
        defaultMarginPct: mg,
      })
      toast({ title: 'Configurações de locação salvas com sucesso!' })
      setSettingsModalOpen(false)
    } catch {
      toast({
        title: 'Erro ao salvar configurações',
        variant: 'destructive',
      })
    } finally {
      setSavingSettings(false)
    }
  }

  // Quando proposta é gerada pelo simulador
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

  // Ao selecionar uma proposta para reabrir/editar no simulador
  const handleEditQuote = (quote: RentalQuote) => {
    setQuoteForEdit(quote)
    setActiveTab('simulador')
    toast({
      title: 'Proposta carregada no simulador',
      description: `Parâmetros de ${quote.cliente_nome_livre || 'Cliente'} prontos para novo cálculo.`,
    })
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
    setContractStartDate(new Date().toISOString().split('T')[0])
    setClausulasAdicionais('')
    setContractModalOpen(true)
  }

  // Confirmar geração do contrato (congela dados)
  const handleConfirmContract = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentQuote || !machineForContract) return

    setCreatingContract(true)
    try {
      const frozenLocatario = {
        nome: currentQuote.cliente_nome_livre || currentQuote.expand?.cliente_id?.name || 'Cliente',
        cpf_cnpj: currentQuote.cliente_documento || currentQuote.expand?.cliente_id?.cpf_cnpj || '',
        rg_ie: currentQuote.expand?.cliente_id?.rg_ie || '',
        endereco: currentQuote.cliente_endereco || currentQuote.expand?.cliente_id?.endereco || '',
        bairro: currentQuote.expand?.cliente_id?.bairro || '',
        cidade: currentQuote.expand?.cliente_id?.city || 'Nova Andradina',
        estado: currentQuote.expand?.cliente_id?.state || 'MS',
        cep: currentQuote.expand?.cliente_id?.zip || '',
        telefone: currentQuote.cliente_telefone || currentQuote.expand?.cliente_id?.phone || '',
        email: currentQuote.expand?.cliente_id?.email || '',
      }

      const frozenEquipamento = {
        produto_id: machineForContract.machineId,
        nome: machineForContract.machineName,
        serial: machineForContract.serial,
        contador_inicial: machineForContract.contador_inicial || 0,
        scanner: machineForContract.scanner,
        scanner_dados: machineForContract.scannerDados,
        supplies: machineForContract.supplies,
      }

      const contractPayload: Partial<RentalContract> = {
        proposta: currentQuote.id,
        numero: nextContractNumber.trim(),
        locatario_dados: frozenLocatario,
        equipamento_dados: frozenEquipamento,
        franquia_paginas: currentQuote.franquia_paginas || 1000,
        valor_mensal: machineForContract.franquiaSugerida,
        excesso_pagina_valor: machineForContract.excedenteSugerido,
        contrato_meses: currentQuote.contrato_meses || 12,
        data_inicio: new Date(contractStartDate).toISOString(),
        status: 'ativo',
        clausulas_adicionais: clausulasAdicionais.trim() || undefined,
      }

      const created = await createRentalContract(contractPayload)

      toast({
        title: 'Contrato emitido com sucesso!',
        description: `Contrato nº ${created.numero} gerado e ativado.`,
      })

      setCurrentContract(created)
      setContractModalOpen(false)
      loadContracts()
      setActiveTab('contrato')
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao emitir contrato',
        description: 'Verifique se o número do contrato já existe.',
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
        toast({
          title: 'Proposta não encontrada',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Erro ao carregar proposta vinculada',
        variant: 'destructive',
      })
    }
  }

  const isRefreshing = loadingQuotes || loadingContracts

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
                Locação de Impressoras
              </h1>
              <span className="text-[10px] font-mono font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                v0.0.205
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Funil completo: Precificação com vínculo ao catálogo → Histórico de Propostas →
              Contrato com cláusulas fixas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenSettings}
            className="text-xs font-semibold text-slate-700 hover:text-indigo-600 gap-1.5"
          >
            <SettingsIcon className="h-3.5 w-3.5" /> Configurações de Locação
          </Button>
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

      {/* TABS PRINCIPAIS DO MÓDULO */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-100 p-1 rounded-xl grid grid-cols-2 sm:grid-cols-5 max-w-3xl print:hidden">
          <TabsTrigger
            value="simulador"
            className="text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm gap-1.5"
          >
            <Calculator className="h-3.5 w-3.5" />
            <span>1. Simulador</span>
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

        {/* 1. SIMULADOR */}
        <TabsContent value="simulador">
          <RentalSimulator onQuoteGenerated={handleQuoteGenerated} initialQuote={quoteForEdit} />
        </TabsContent>

        {/* 2. PROPOSTA COMERCIAL VISUALIZAÇÃO */}
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

        {/* 3. HISTÓRICO DE PROPOSTAS (COM BUSCA EM TEMPO REAL) */}
        <TabsContent value="propostas_lista">
          <RentalQuotesList
            quotes={quotesList}
            onOpenQuote={handleOpenQuote}
            onEditQuote={handleEditQuote}
            onReload={loadQuotes}
          />
        </TabsContent>

        {/* 4. CONTRATO IMPRESSÃO / VISUALIZAÇÃO */}
        <TabsContent value="contrato">
          {currentContract ? (
            <RentalContractPrintView
              contract={currentContract}
              onBack={() => setActiveTab('contratos_lista')}
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

        {/* 5. LISTA DE CONTRATOS */}
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

      {/* MODAL DE EMISSÃO DE CONTRATO (CONGELA OS DADOS) */}
      <Dialog open={contractModalOpen} onOpenChange={setContractModalOpen}>
        <DialogContent className="max-w-md p-5">
          <DialogHeader>
            <div className="flex items-center gap-2 text-indigo-600">
              <FileSignature className="h-5 w-5" />
              <DialogTitle className="text-base font-bold text-slate-900">
                Gerar Contrato de Locação
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500">
              Os dados do cliente e da máquina serão congelados permanentemente no contrato com as
              cláusulas fixas da JUCA.
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
                  <strong>Excedente:</strong> R$ {machineForContract.excedenteSugerido.toFixed(4)} /
                  pág
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Número do Contrato *</Label>
                <Input
                  value={nextContractNumber}
                  onChange={(e) => setNextContractNumber(e.target.value)}
                  placeholder="Ex: CT-2025-001"
                  required
                  className="h-9 text-xs font-mono font-bold text-indigo-900"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">
                  Data de Início da Vigência
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
                  placeholder="Ex: Entrega e treinamento no dia 15..."
                  className="h-9 text-xs"
                />
              </div>

              <DialogFooter className="pt-2 gap-2">
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
                  <span>{creatingContract ? 'Emitindo...' : 'Confirmar e Emitir Contrato'}</span>
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL DE CONFIGURAÇÕES PADRÃO DE LOCAÇÃO */}
      <Dialog open={settingsModalOpen} onOpenChange={setSettingsModalOpen}>
        <DialogContent className="max-w-md p-5">
          <DialogHeader>
            <div className="flex items-center gap-2 text-indigo-600">
              <SettingsIcon className="h-5 w-5" />
              <DialogTitle className="text-base font-bold text-slate-900">
                Configurações Padrão de Locação
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500">
              Defina os parâmetros padrão sugeridos nos novos cálculos de locação.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveSettings} className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">
                Prazo Padrão de Payback das Máquinas (Meses)
              </Label>
              <Input
                type="number"
                min="1"
                max="60"
                value={paybackDefaultInput}
                onChange={(e) => setPaybackDefaultInput(e.target.value)}
                required
                className="h-9 text-xs font-mono"
              />
              <p className="text-[10px] text-slate-400">Padrão do mercado: 18 a 24 meses</p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">
                Margem Padrão de Revenda (%)
              </Label>
              <Input
                type="number"
                min="0"
                max="500"
                value={marginDefaultInput}
                onChange={(e) => setMarginDefaultInput(e.target.value)}
                required
                className="h-9 text-xs font-mono"
              />
              <p className="text-[10px] text-slate-400">
                Margem aplicada sobre o custo dos insumos (CPP)
              </p>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSettingsModalOpen(false)}
                disabled={savingSettings}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={savingSettings}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
              >
                {savingSettings ? 'Salvando...' : 'Salvar Configurações'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
