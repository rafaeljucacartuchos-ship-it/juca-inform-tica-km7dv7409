import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Tag,
  Calculator,
  History,
  Settings,
  Search,
  Package,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Copy,
  Plus,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  Sparkles,
  DollarSign,
  Layers,
  ArrowUpDown,
  FileText,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import {
  Product,
  PricingHistory,
  PricingMode,
  CurrencyType,
  CompanyPricingParameters,
  PaymentMethodTax,
} from '@/types'
import { getProducts, getProduct, updateProduct, createProduct } from '@/services/products'
import { getCustomers, createCustomer } from '@/services/customers'
import { Customer } from '@/types'
import { useDraftState } from '@/hooks/use-draft-state'
import {
  getCompanyPricingParameters,
  updateCompanyPricingParameters,
  updatePaymentMethodsTax,
  createPricingHistory,
  getPricingHistory,
  calculateJucaPricing,
  decomposeExistingPrice,
  PricingCalculationResult,
  DEFAULT_COMPANY_PARAMS,
  DEFAULT_PAYMENT_METHODS_TAX,
} from '@/services/pricing'
import { formatCurrencyBRL } from '@/lib/dashboard-utils'
import { CompanyParamsCard } from '@/components/CompanyParamsCard'
import { PricingWaterfallCard } from '@/components/PricingWaterfallCard'
import { PaymentMethodsTableCard } from '@/components/PaymentMethodsTableCard'

export default function Precificacao() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const initialProductId = searchParams.get('productId') || ''
  const initialMode = (searchParams.get('tab') as string) || 'produto'

  const [activeTab, setActiveTab] = useState<string>(
    ['produto', 'avulsa', 'rapida', 'historico'].includes(initialMode) ? initialMode : 'produto',
  )

  // Cliente para envio ao orçamento (compartilhado ou específico)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerSearchQuery, setCustomerSearchQuery] = useState('')
  const [customerSearchResults, setCustomerSearchResults] = useState<Customer[]>([])
  const [searchingCustomers, setSearchingCustomers] = useState(false)
  const [customerSearchDropdownOpen, setCustomerSearchDropdownOpen] = useState(false)
  const [customerManualPhone, setCustomerManualPhone] = useState('')

  // Rascunho de Precificação (nos 3 modos)
  const {
    draft: draftPrecificacao,
    saveDraft: saveDraftPrecificacao,
    clearDraft: clearDraftPrecificacao,
  } = useDraftState<any>('juca:draft:precificacao', '/precificacao', 'Precificação')

  const { toast } = useToast()

  // Parâmetros corporativos de precificação (carregados de settings)
  const [companyParams, setCompanyParams] =
    useState<CompanyPricingParameters>(DEFAULT_COMPANY_PARAMS)
  const [savingCompanyParams, setSavingCompanyParams] = useState(false)
  const [savingPaymentMethods, setSavingPaymentMethods] = useState(false)
  const [dolarInputLive, setDolarInputLive] = useState(String(DEFAULT_COMPANY_PARAMS.cotacao_dolar))

  // Histórico
  const [historyList, setHistoryList] = useState<PricingHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Formas de Pagamento selecionadas por aba
  const [selectedMethod1, setSelectedMethod1] = useState<PaymentMethodTax | null>(null)
  const [selectedMethod2, setSelectedMethod2] = useState<PaymentMethodTax | null>(null)
  const [selectedMethod3, setSelectedMethod3] = useState<PaymentMethodTax | null>(null)

  // -------------------------------------------------------------
  // MODO 1: PRODUTO CADASTRADO
  // -------------------------------------------------------------
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [searchProductQuery, setSearchProductQuery] = useState('')
  const [productSearchResults, setProductSearchResults] = useState<Product[]>([])
  const [searchingProducts, setSearchingProducts] = useState(false)
  const [searchProductModalOpen, setSearchProductModalOpen] = useState(false)

  // Campos Modo 1
  const [currency1, setCurrency1] = useState<CurrencyType>('BRL')
  const [costInput1, setCostInput1] = useState('')
  const [freightInput1, setFreightInput1] = useState('0')
  const [extraCost1A, setExtraCost1A] = useState('0') // Ex: embalagem
  const [extraCost1B, setExtraCost1B] = useState('0') // Ex: outros
  const [fixedExpensesPct1, setFixedExpensesPct1] = useState('15')
  const [cardTaxPct1, setCardTaxPct1] = useState('3.5')
  const [icmsPct1, setIcmsPct1] = useState('4.0')
  const [impostoSaidaPct1, setImpostoSaidaPct1] = useState('4.0')
  const [commissionPct1, setCommissionPct1] = useState('2.5')
  const [ipiPct1, setIpiPct1] = useState('0')
  const [variableExpensesTotal1, setVariableExpensesTotal1] = useState('14.0')
  const [marginInput1, setMarginInput1] = useState('25')
  const [calcResult1, setCalcResult1] = useState<PricingCalculationResult | null>(null)
  const [confirmApplyModalOpen, setConfirmApplyModalOpen] = useState(false)
  const [applyingPrice, setApplyingPrice] = useState(false)

  // -------------------------------------------------------------
  // MODO 2: PRECIFICAÇÃO AVULSA
  // -------------------------------------------------------------
  const [currency2, setCurrency2] = useState<CurrencyType>('BRL')
  const [costInput2, setCostInput2] = useState('100')
  const [freightInput2, setFreightInput2] = useState('0')
  const [extraCost2A, setExtraCost2A] = useState('0')
  const [extraCost2B, setExtraCost2B] = useState('0')
  const [fixedExpensesPct2, setFixedExpensesPct2] = useState('15')
  const [cardTaxPct2, setCardTaxPct2] = useState('3.5')
  const [icmsPct2, setIcmsPct2] = useState('4.0')
  const [impostoSaidaPct2, setImpostoSaidaPct2] = useState('4.0')
  const [commissionPct2, setCommissionPct2] = useState('2.5')
  const [ipiPct2, setIpiPct2] = useState('0')
  const [variableExpensesTotal2, setVariableExpensesTotal2] = useState('14.0')
  const [marginInput2, setMarginInput2] = useState('25')
  const [calcResult2, setCalcResult2] = useState<PricingCalculationResult | null>(null)

  // -------------------------------------------------------------
  // MODO 3: PRECIFICAÇÃO RÁPIDA
  // -------------------------------------------------------------
  const [currency3, setCurrency3] = useState<CurrencyType>('BRL')
  const [costInput3, setCostInput3] = useState('80')
  const [freightInput3, setFreightInput3] = useState('0')
  const [extraCost3A, setExtraCost3A] = useState('0')
  const [extraCost3B, setExtraCost3B] = useState('0')
  const [fixedExpensesPct3, setFixedExpensesPct3] = useState('15')
  const [cardTaxPct3, setCardTaxPct3] = useState('3.5')
  const [icmsPct3, setIcmsPct3] = useState('4.0')
  const [impostoSaidaPct3, setImpostoSaidaPct3] = useState('4.0')
  const [commissionPct3, setCommissionPct3] = useState('2.5')
  const [ipiPct3, setIpiPct3] = useState('0')
  const [variableExpensesTotal3, setVariableExpensesTotal3] = useState('14.0')
  const [marginInput3, setMarginInput3] = useState('25')
  const [calcResult3, setCalcResult3] = useState<PricingCalculationResult | null>(null)
  const [linkedProduct3, setLinkedProduct3] = useState<Product | null>(null)
  const [newProductModalOpen, setNewProductModalOpen] = useState(false)
  const [newProductName, setNewProductName] = useState('')
  const [newProductCategory, setNewProductCategory] = useState('')
  const [newProductSku, setNewProductSku] = useState('')
  const [newProductCost, setNewProductCost] = useState('')
  const [savingNewProduct, setSavingNewProduct] = useState(false)

  // Carrega configurações iniciais e histórico
  useEffect(() => {
    loadCompanyParams()
    loadHistory()

    // Restaura rascunho de formulário da Precificação se houver
    if (draftPrecificacao && draftPrecificacao.formData) {
      const d = draftPrecificacao.formData
      if (d.activeTab && !searchParams.get('tab')) setActiveTab(d.activeTab)
      if (d.customerSearchQuery) setCustomerSearchQuery(d.customerSearchQuery)
      if (d.customerManualPhone) setCustomerManualPhone(d.customerManualPhone)
      if (d.selectedCustomer) setSelectedCustomer(d.selectedCustomer)

      // Modo 1
      if (d.costInput1 !== undefined) setCostInput1(d.costInput1)
      if (d.marginInput1 !== undefined) setMarginInput1(d.marginInput1)
      if (d.freightInput1 !== undefined) setFreightInput1(d.freightInput1)

      // Modo 2
      if (d.costInput2 !== undefined) setCostInput2(d.costInput2)
      if (d.marginInput2 !== undefined) setMarginInput2(d.marginInput2)
      if (d.freightInput2 !== undefined) setFreightInput2(d.freightInput2)
      if (d.extraCost2A !== undefined) setExtraCost2A(d.extraCost2A)
      if (d.extraCost2B !== undefined) setExtraCost2B(d.extraCost2B)

      // Modo 3
      if (d.costInput3 !== undefined) setCostInput3(d.costInput3)
      if (d.marginInput3 !== undefined) setMarginInput3(d.marginInput3)
      if (d.freightInput3 !== undefined) setFreightInput3(d.freightInput3)
      if (d.newProductName !== undefined) setNewProductName(d.newProductName)
    }
  }, [])

  // Salva rascunho com debounce ao alterar campos de precificação
  useEffect(() => {
    saveDraftPrecificacao({
      activeTab,
      selectedCustomer,
      customerSearchQuery,
      customerManualPhone,
      // Modo 1
      costInput1,
      marginInput1,
      freightInput1,
      // Modo 2
      costInput2,
      marginInput2,
      freightInput2,
      extraCost2A,
      extraCost2B,
      // Modo 3
      costInput3,
      marginInput3,
      freightInput3,
      newProductName,
    })
  }, [
    activeTab,
    selectedCustomer,
    customerSearchQuery,
    customerManualPhone,
    costInput1,
    marginInput1,
    freightInput1,
    costInput2,
    marginInput2,
    freightInput2,
    extraCost2A,
    extraCost2B,
    costInput3,
    marginInput3,
    freightInput3,
    newProductName,
    saveDraftPrecificacao,
  ])

  // Renderiza caixa unificada de cliente da precificação
  const renderCustomerSelector = () => (
    <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-indigo-600" />
          <span>Vincular Cliente ao Orçamento (Opcional)</span>
        </Label>
        {selectedCustomer && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedCustomer(null)
              setCustomerSearchQuery('')
              setCustomerManualPhone('')
            }}
            className="h-6 text-[10px] text-rose-600 hover:bg-rose-50 px-1.5"
          >
            Trocar
          </Button>
        )}
      </div>

      {selectedCustomer ? (
        <div className="p-2.5 bg-indigo-50/70 border border-indigo-100 rounded-md text-xs">
          <div className="font-bold text-indigo-950">
            {selectedCustomer.razao_social || selectedCustomer.name}
          </div>
          <div className="text-[11px] text-indigo-700 flex items-center gap-2 mt-0.5">
            <span>
              Tel:{' '}
              {selectedCustomer.celular ||
                selectedCustomer.phone ||
                customerManualPhone ||
                'Sem telefone'}
            </span>
            {selectedCustomer.cpf_cnpj && <span>• CPF/CNPJ: {selectedCustomer.cpf_cnpj}</span>}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              type="text"
              placeholder="Buscar cliente cadastrado ou digitar novo nome..."
              value={customerSearchQuery}
              onChange={(e) => {
                setCustomerSearchQuery(e.target.value)
                setCustomerSearchDropdownOpen(true)
              }}
              onFocus={() => {
                if (customerSearchResults.length > 0) setCustomerSearchDropdownOpen(true)
              }}
              className="pl-8 h-8 text-xs bg-slate-50"
            />
            {searchingCustomers && (
              <span className="absolute right-2.5 top-2.5 text-[10px] text-slate-400">
                buscando...
              </span>
            )}
          </div>

          {customerSearchDropdownOpen && customerSearchResults.length > 0 && (
            <div className="relative z-20 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-md shadow-md divide-y divide-slate-100 text-xs">
              <div className="p-1.5 bg-slate-50 text-[10px] font-semibold text-slate-500 uppercase">
                Clientes encontrados:
              </div>
              {customerSearchResults.map((cust) => (
                <button
                  key={cust.id}
                  type="button"
                  onClick={() => {
                    setSelectedCustomer(cust)
                    setCustomerSearchQuery(cust.razao_social || cust.name || '')
                    setCustomerManualPhone(cust.celular || cust.phone || '')
                    setCustomerSearchDropdownOpen(false)
                  }}
                  className="w-full text-left p-2 hover:bg-indigo-50 transition-colors flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-slate-900">
                      {cust.razao_social || cust.name}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {cust.celular || cust.phone || 'Sem telefone'} •{' '}
                      {cust.cpf_cnpj || 'Sem documento'}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[9px] border-indigo-200 text-indigo-700">
                    Selecionar
                  </Badge>
                </button>
              ))}
              <div className="p-1.5 bg-slate-50 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-5 text-[10px]"
                  onClick={() => setCustomerSearchDropdownOpen(false)}
                >
                  Fechar
                </Button>
              </div>
            </div>
          )}

          <div>
            <Label className="text-[10px] font-semibold text-slate-500 block mb-0.5">
              Telefone / WhatsApp (se for novo cliente):
            </Label>
            <Input
              type="text"
              placeholder="(00) 00000-0000"
              value={customerManualPhone}
              onChange={(e) => setCustomerManualPhone(e.target.value)}
              className="h-8 text-xs font-mono"
            />
          </div>
        </div>
      )}
    </div>
  )

  // Autocomplete de clientes para envio a orçamento
  useEffect(() => {
    if (!customerSearchQuery.trim() || customerSearchQuery.trim().length < 2) {
      setCustomerSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearchingCustomers(true)
      try {
        const res = await getCustomers(customerSearchQuery.trim())
        setCustomerSearchResults(res.slice(0, 8))
      } catch {
        setCustomerSearchResults([])
      } finally {
        setSearchingCustomers(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [customerSearchQuery])

  /**
   * Helper unificado para resolver o cliente antes de enviar para Orçamento:
   * - Cliente selecionado do cadastro -> { customer_id, customer_name, customer_phone }
   * - Cliente digitado novo -> tenta createCustomer({ razao_social, celular }),
   *   se sucesso envia o id, se falhar envia apenas customer_name sem travar.
   */
  const resolveCustomerForOrcamento = async (): Promise<{
    customer_id?: string | null
    customer_name?: string
    customer_phone?: string
  }> => {
    if (selectedCustomer) {
      return {
        customer_id: selectedCustomer.id,
        customer_name: selectedCustomer.name || selectedCustomer.razao_social || 'Cliente',
        customer_phone:
          selectedCustomer.phone || selectedCustomer.celular || customerManualPhone || '',
      }
    }

    const typedName = customerSearchQuery.trim()
    if (!typedName) {
      return {
        customer_id: null,
        customer_name: '',
        customer_phone: customerManualPhone.trim(),
      }
    }

    // Tenta cadastrar o cliente novo antes de navegar
    try {
      const created = await createCustomer({
        razao_social: typedName,
        celular: customerManualPhone.trim(),
      })
      if (created && created.id) {
        return {
          customer_id: created.id,
          customer_name: created.name || created.razao_social || typedName,
          customer_phone: created.phone || created.celular || customerManualPhone.trim(),
        }
      }
    } catch (err) {
      console.warn(
        'Não foi possível pré-cadastrar cliente na precificação, seguindo com nome avulso:',
        err,
      )
    }

    return {
      customer_id: null,
      customer_name: typedName,
      customer_phone: customerManualPhone.trim(),
    }
  }

  const loadCompanyParams = async () => {
    try {
      const params = await getCompanyPricingParameters()
      setCompanyParams(params)
      setDolarInputLive(String(params.cotacao_dolar))
      applyParamsToInputs(params)
    } catch (err) {
      console.error('Erro ao carregar parâmetros da empresa:', err)
    }
  }

  const applyParamsToInputs = (params: CompanyPricingParameters) => {
    const fPct = String(params.despesa_fixa_pct)
    const cTax = String(params.taxa_cartao_pct)
    const icms = String(params.icms_pct)
    const impSaida = String(params.imposto_saida_pct ?? 4.0)
    const com = String(params.comissao_pct)
    const ipi = String(params.ipi_pct)
    const marg = String(params.lucratividade_desejada_pct)
    const frete = String(params.frete_padrao)
    const varTotal = String(params.custos_variaveis_pct)

    // Modo 1
    setFixedExpensesPct1(fPct)
    setCardTaxPct1(cTax)
    setIcmsPct1(icms)
    setImpostoSaidaPct1(impSaida)
    setCommissionPct1(com)
    setIpiPct1(ipi)
    setVariableExpensesTotal1(varTotal)
    setMarginInput1(marg)
    setFreightInput1(frete)

    // Modo 2
    setFixedExpensesPct2(fPct)
    setCardTaxPct2(cTax)
    setIcmsPct2(icms)
    setImpostoSaidaPct2(impSaida)
    setCommissionPct2(com)
    setIpiPct2(ipi)
    setVariableExpensesTotal2(varTotal)
    setMarginInput2(marg)
    setFreightInput2(frete)

    // Modo 3
    setFixedExpensesPct3(fPct)
    setCardTaxPct3(cTax)
    setIcmsPct3(icms)
    setImpostoSaidaPct3(impSaida)
    setCommissionPct3(com)
    setIpiPct3(ipi)
    setVariableExpensesTotal3(varTotal)
    setMarginInput3(marg)
    setFreightInput3(frete)
  }

  // Handler para salvar formas de pagamento da tabela
  const handleSavePaymentMethods = async (methods: PaymentMethodTax[]) => {
    setSavingPaymentMethods(true)
    try {
      await updatePaymentMethodsTax(methods)
      setCompanyParams((prev) => ({ ...prev, payment_methods_tax: methods }))
      toast({
        title: 'Taxas salvas com sucesso!',
        description: 'Tabela de formas de pagamento atualizada.',
      })
    } catch {
      toast({
        title: 'Erro ao salvar formas de pagamento',
        variant: 'destructive',
      })
    } finally {
      setSavingPaymentMethods(false)
    }
  }

  // Cotação do dólar ativa em tempo real
  const cotacaoDolarAtiva =
    parseFloat(dolarInputLive.replace(',', '.')) || companyParams.cotacao_dolar || 5.65

  // Carrega produto inicial se passado por query param
  useEffect(() => {
    if (initialProductId) {
      getProduct(initialProductId)
        .then((prod) => {
          if (prod) {
            handleSelectProduct1(prod)
            setActiveTab('produto')
          }
        })
        .catch(() => {})
    }
  }, [initialProductId])

  const loadHistory = async () => {
    setLoadingHistory(true)
    try {
      const list = await getPricingHistory(50)
      setHistoryList(list)
    } catch {
      /* ignore */
    } finally {
      setLoadingHistory(false)
    }
  }

  // -------------------------------------------------------------
  // RECALCULO MODO 1 (Produto Cadastrado)
  // -------------------------------------------------------------
  useEffect(() => {
    const rawCost = parseFloat(costInput1.replace(',', '.')) || 0
    const frete = parseFloat(freightInput1.replace(',', '.')) || 0
    const add1 = parseFloat(extraCost1A.replace(',', '.')) || 0
    const add2 = parseFloat(extraCost1B.replace(',', '.')) || 0
    const fExp = parseFloat(fixedExpensesPct1.replace(',', '.')) || 0
    const cTax = parseFloat(cardTaxPct1.replace(',', '.')) || 0
    const icms = parseFloat(icmsPct1.replace(',', '.')) || 0
    const impSaida = parseFloat(impostoSaidaPct1.replace(',', '.')) || 0
    const com = parseFloat(commissionPct1.replace(',', '.')) || 0
    const ipi = parseFloat(ipiPct1.replace(',', '.')) || 0
    const marg = parseFloat(marginInput1.replace(',', '.')) || 0
    const overrideVar = parseFloat(variableExpensesTotal1.replace(',', '.'))

    const res = calculateJucaPricing({
      custoProduto: rawCost,
      moeda: currency1,
      cotacaoDolar: cotacaoDolarAtiva,
      frete,
      custoAdicional1: add1,
      custoAdicional2: add2,
      custoFixoRateado: companyParams.custo_fixo_rateado_unitario || 0,
      despesaFixaPct: fExp,
      taxaCartaoPct: cTax,
      icmsPct: icms,
      impostoSaidaPct: impSaida,
      comissaoPct: com,
      ipiPct: ipi,
      custosVariaveisPctOverride: isNaN(overrideVar) ? undefined : overrideVar,
      lucratividadePct: marg,
    })
    setCalcResult1(res)
  }, [
    costInput1,
    currency1,
    freightInput1,
    extraCost1A,
    extraCost1B,
    fixedExpensesPct1,
    cardTaxPct1,
    icmsPct1,
    impostoSaidaPct1,
    commissionPct1,
    ipiPct1,
    variableExpensesTotal1,
    marginInput1,
    cotacaoDolarAtiva,
    companyParams.custo_fixo_rateado_unitario,
  ])

  // -------------------------------------------------------------
  // RECALCULO MODO 2 (Avulsa)
  // -------------------------------------------------------------
  useEffect(() => {
    const rawCost = parseFloat(costInput2.replace(',', '.')) || 0
    const frete = parseFloat(freightInput2.replace(',', '.')) || 0
    const add1 = parseFloat(extraCost2A.replace(',', '.')) || 0
    const add2 = parseFloat(extraCost2B.replace(',', '.')) || 0
    const fExp = parseFloat(fixedExpensesPct2.replace(',', '.')) || 0
    const cTax = parseFloat(cardTaxPct2.replace(',', '.')) || 0
    const icms = parseFloat(icmsPct2.replace(',', '.')) || 0
    const impSaida = parseFloat(impostoSaidaPct2.replace(',', '.')) || 0
    const com = parseFloat(commissionPct2.replace(',', '.')) || 0
    const ipi = parseFloat(ipiPct2.replace(',', '.')) || 0
    const marg = parseFloat(marginInput2.replace(',', '.')) || 0
    const overrideVar = parseFloat(variableExpensesTotal2.replace(',', '.'))

    const res = calculateJucaPricing({
      custoProduto: rawCost,
      moeda: currency2,
      cotacaoDolar: cotacaoDolarAtiva,
      frete,
      custoAdicional1: add1,
      custoAdicional2: add2,
      custoFixoRateado: companyParams.custo_fixo_rateado_unitario || 0,
      despesaFixaPct: fExp,
      taxaCartaoPct: cTax,
      icmsPct: icms,
      impostoSaidaPct: impSaida,
      comissaoPct: com,
      ipiPct: ipi,
      custosVariaveisPctOverride: isNaN(overrideVar) ? undefined : overrideVar,
      lucratividadePct: marg,
    })
    setCalcResult2(res)
  }, [
    costInput2,
    currency2,
    freightInput2,
    extraCost2A,
    extraCost2B,
    fixedExpensesPct2,
    cardTaxPct2,
    icmsPct2,
    impostoSaidaPct2,
    commissionPct2,
    ipiPct2,
    variableExpensesTotal2,
    marginInput2,
    cotacaoDolarAtiva,
    companyParams.custo_fixo_rateado_unitario,
  ])

  // -------------------------------------------------------------
  // RECALCULO MODO 3 (Rápida)
  // -------------------------------------------------------------
  useEffect(() => {
    const rawCost = parseFloat(costInput3.replace(',', '.')) || 0
    const frete = parseFloat(freightInput3.replace(',', '.')) || 0
    const add1 = parseFloat(extraCost3A.replace(',', '.')) || 0
    const add2 = parseFloat(extraCost3B.replace(',', '.')) || 0
    const fExp = parseFloat(fixedExpensesPct3.replace(',', '.')) || 0
    const cTax = parseFloat(cardTaxPct3.replace(',', '.')) || 0
    const icms = parseFloat(icmsPct3.replace(',', '.')) || 0
    const impSaida = parseFloat(impostoSaidaPct3.replace(',', '.')) || 0
    const com = parseFloat(commissionPct3.replace(',', '.')) || 0
    const ipi = parseFloat(ipiPct3.replace(',', '.')) || 0
    const marg = parseFloat(marginInput3.replace(',', '.')) || 0
    const overrideVar = parseFloat(variableExpensesTotal3.replace(',', '.'))

    const res = calculateJucaPricing({
      custoProduto: rawCost,
      moeda: currency3,
      cotacaoDolar: cotacaoDolarAtiva,
      frete,
      custoAdicional1: add1,
      custoAdicional2: add2,
      custoFixoRateado: companyParams.custo_fixo_rateado_unitario || 0,
      despesaFixaPct: fExp,
      taxaCartaoPct: cTax,
      icmsPct: icms,
      impostoSaidaPct: impSaida,
      comissaoPct: com,
      ipiPct: ipi,
      custosVariaveisPctOverride: isNaN(overrideVar) ? undefined : overrideVar,
      lucratividadePct: marg,
    })
    setCalcResult3(res)
  }, [
    costInput3,
    currency3,
    freightInput3,
    extraCost3A,
    extraCost3B,
    fixedExpensesPct3,
    cardTaxPct3,
    icmsPct3,
    impostoSaidaPct3,
    commissionPct3,
    ipiPct3,
    variableExpensesTotal3,
    marginInput3,
    cotacaoDolarAtiva,
    companyParams.custo_fixo_rateado_unitario,
  ])

  // -------------------------------------------------------------
  // SELEÇÃO DE PRODUTO NO MODO 1
  // -------------------------------------------------------------
  const handleSelectProduct1 = (prod: Product) => {
    setSelectedProduct(prod)
    setCurrency1('BRL')
    setCostInput1(prod.cost != null ? String(prod.cost) : '0')
    setSearchProductModalOpen(false)
  }

  // Busca rápida de produtos para modal
  const handleSearchProducts = async (term: string) => {
    setSearchProductQuery(term)
    setSearchingProducts(true)
    try {
      const prods = await getProducts(term)
      setProductSearchResults(prods)
    } catch {
      setProductSearchResults([])
    } finally {
      setSearchingProducts(false)
    }
  }

  // Salvar novos parâmetros corporativos
  const handleSaveCompanyParams = async (params: Partial<CompanyPricingParameters>) => {
    setSavingCompanyParams(true)
    try {
      await updateCompanyPricingParameters(params)
      const updated = await getCompanyPricingParameters()
      setCompanyParams(updated)
      if (params.cotacao_dolar !== undefined) {
        setDolarInputLive(String(params.cotacao_dolar))
      }
      applyParamsToInputs(updated)
      toast({
        title: 'Parâmetros atualizados!',
        description: 'Os novos padrões foram salvos e aplicados aos cálculos.',
      })
    } catch {
      toast({
        title: 'Erro ao salvar parâmetros',
        description: 'Verifique a conexão e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSavingCompanyParams(false)
    }
  }

  // Aplicar preço ao produto (Modo 1 ou Modo 3)
  const handleApplyPriceToProduct = async (
    prod: Product,
    res: PricingCalculationResult,
    mode: PricingMode,
    paymentMethodNome?: string,
  ) => {
    if (!res.isPossible || res.salePrice <= 0) {
      toast({
        title: 'Cálculo inválido',
        description: res.errorMessage || 'Verifique os valores informados.',
        variant: 'destructive',
      })
      return
    }

    setApplyingPrice(true)
    try {
      // 1. Atualizar produto (preço de venda e custo em R$)
      await updateProduct(prod.id, {
        price: res.salePrice,
        cost: res.custoDiretoTotal,
      })

      // 2. Registrar no histórico com todos os novos campos
      await createPricingHistory({
        product: prod.id,
        cost: res.custoDiretoTotal,
        despesas_pct: res.despesasPct,
        markup_pct: res.markupSobreCustoPct,
        margem_pct: res.lucratividadePct,
        sale_price: res.salePrice,
        lucro_unitario: res.lucroUnitario,
        mode,
        frete: res.frete,
        custos_adicionais: res.custoAdicional1 + res.custoAdicional2,
        custos_variaveis_pct: res.custosVariaveisPct,
        despesa_fixa_pct: res.despesaFixaPct,
        custo_moeda: res.moeda,
        cost_usd: res.custoProdutoUSD,
        cotacao_dolar: res.cotacaoDolar,
        taxa_cartao_pct: res.taxaCartaoPct,
        icms_pct: res.icmsPct,
        imposto_saida_pct: res.impostoSaidaPct,
        payment_method_nome: paymentMethodNome,
        comissao_pct: res.comissaoPct,
        ipi_pct: res.ipiPct,
        custo_fixo_rateado_unitario: res.custoFixoRateado,
        custo_fixo_mensal: companyParams.custo_fixo_mensal,
        volume_estimado_servicos_mes: companyParams.volume_estimado_servicos_mes,
      })

      // Atualiza estado local
      setSelectedProduct((prev) =>
        prev ? { ...prev, price: res.salePrice, cost: res.custoDiretoTotal } : null,
      )
      if (linkedProduct3 && linkedProduct3.id === prod.id) {
        setLinkedProduct3((prev) =>
          prev ? { ...prev, price: res.salePrice, cost: res.custoDiretoTotal } : null,
        )
      }

      toast({
        title: 'Preço aplicado com sucesso!',
        description: `${prod.name}: novo preço ${formatCurrencyBRL(res.salePrice)} registrado no produto e no histórico.`,
      })

      setConfirmApplyModalOpen(false)
      loadHistory()
    } catch (err) {
      toast({
        title: 'Erro ao aplicar preço',
        description: 'Não foi possível atualizar o produto.',
        variant: 'destructive',
      })
    } finally {
      setApplyingPrice(false)
    }
  }

  // Copiar resumo para a área de transferência
  const handleCopySummary = (res: PricingCalculationResult, label = 'Precificação') => {
    if (!res || !res.isPossible) return
    const text =
      `*${label} - JUCA INFORMÁTICA*\n` +
      `Custo Base (${res.moeda}): ${res.moeda === 'USD' ? `US$ ${res.custoProdutoUSD?.toFixed(2)} (R$ ${res.custoProdutoBRL.toFixed(2)})` : formatCurrencyBRL(res.custoProdutoBRL)}\n` +
      `Frete + Extras: ${formatCurrencyBRL(res.frete + res.custoAdicional1 + res.custoAdicional2)}\n` +
      `Custo Direto: ${formatCurrencyBRL(res.custoDiretoTotal)} (${res.fatias.custoDireto.pct}%)\n` +
      (res.custoFixoRateado > 0 ? `Custo Fixo Rateado: ${formatCurrencyBRL(res.custoFixoRateado)} (${res.fatias.custoFixoRateado.pct}%)\n` : '') +
      `Despesa Fixa (${res.despesaFixaPct}%): ${formatCurrencyBRL(res.fatias.despesaFixa.valor)}\n` +
      `Custos Variáveis (${res.custosVariaveisPct}%): ${formatCurrencyBRL(res.fatias.custosVariaveis.valor)}\n` +
      `Lucratividade Alvo: ${res.lucratividadePct}%\n` +
      `Markup Multiplicador: ${res.markupMultiplicador}×\n` +
      `-------------------------\n` +
      `PREÇO DE VENDA: ${formatCurrencyBRL(res.salePrice)}\n` +
      `LUCRO LÍQUIDO: ${formatCurrencyBRL(res.lucroUnitario)} (${res.fatias.lucro.pct}%)`

    navigator.clipboard.writeText(text)
    toast({
      title: 'Resultado copiado!',
      description: 'Resumo completo formatado e copiado para a área de transferência.',
    })
  }

  // Criar novo produto no Modo 3 (Mini formulário)
  const handleCreateNewProductQuick = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProductName.trim()) {
      toast({ title: 'Nome do produto é obrigatório', variant: 'destructive' })
      return
    }
    const costVal =
      parseFloat(newProductCost.replace(',', '.')) || (calcResult3?.custoDiretoTotal ?? 0)
    const priceVal = calcResult3?.salePrice || 0

    setSavingNewProduct(true)
    try {
      const created = await createProduct({
        name: newProductName.trim(),
        category: newProductCategory.trim() || 'Geral',
        sku: newProductSku.trim() || undefined,
        cost: costVal,
        price: priceVal,
        type: 'produto',
        stock_quantity: 0,
        active: true,
      })

      // Registra no histórico
      if (calcResult3 && calcResult3.isPossible) {
        await createPricingHistory({
          product: created.id,
          cost: calcResult3.custoDiretoTotal,
          despesas_pct: calcResult3.despesasPct,
          markup_pct: calcResult3.markupSobreCustoPct,
          margem_pct: calcResult3.lucratividadePct,
          sale_price: calcResult3.salePrice,
          lucro_unitario: calcResult3.lucroUnitario,
          mode: 'rapida',
          frete: calcResult3.frete,
          custos_adicionais: calcResult3.custoAdicional1 + calcResult3.custoAdicional2,
          custos_variaveis_pct: calcResult3.custosVariaveisPct,
          despesa_fixa_pct: calcResult3.despesaFixaPct,
          custo_moeda: calcResult3.moeda,
          cost_usd: calcResult3.custoProdutoUSD,
          cotacao_dolar: calcResult3.cotacaoDolar,
          taxa_cartao_pct: calcResult3.taxaCartaoPct,
          icms_pct: calcResult3.icmsPct,
          imposto_saida_pct: calcResult3.impostoSaidaPct,
          payment_method_nome: selectedMethod3?.nome,
          comissao_pct: calcResult3.comissaoPct,
          ipi_pct: calcResult3.ipiPct,
          custo_fixo_rateado_unitario: calcResult3.custoFixoRateado,
          custo_fixo_mensal: companyParams.custo_fixo_mensal,
          volume_estimado_servicos_mes: companyParams.volume_estimado_servicos_mes,
        })
      }

      setLinkedProduct3(created)
      setNewProductModalOpen(false)
      toast({
        title: 'Produto criado e vinculado!',
        description: `"${created.name}" cadastrado com sucesso com o preço sugerido.`,
      })
      loadHistory()
    } catch {
      toast({ title: 'Erro ao criar produto', variant: 'destructive' })
    } finally {
      setSavingNewProduct(false)
    }
  }

  // Decomposição do preço atual do produto selecionado no Modo 1 (para comparação)
  const existingPriceDecomp =
    selectedProduct && selectedProduct.price && selectedProduct.price > 0 && calcResult1
      ? decomposeExistingPrice(
          selectedProduct.price,
          calcResult1.custoDiretoTotal,
          calcResult1.despesaFixaPct,
          calcResult1.taxaCartaoPct,
          calcResult1.icmsPct,
          calcResult1.comissaoPct,
          calcResult1.ipiPct,
          calcResult1.impostoSaidaPct || 0,
        )
      : null

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Tag className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                  Precificação Inteligente
                </h1>
                <Badge
                  variant="outline"
                  className="border-indigo-200 bg-indigo-50 text-indigo-700 text-[10px] font-bold"
                >
                  v0.0.197
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                Metodologia completa JUCA INFORMÁTICA: Markup divisor, conversão US$, despesas
                fixas, imposto de saída, taxas de cartão parceladas (1x a 12x) e cascata 100%.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadHistory}
            className="h-9 w-9 p-0 border-slate-200 hover:bg-slate-50 text-slate-600"
            title="Atualizar dados"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* REQUISITO 1: CARD PARÂMETROS DA EMPRESA NA PRÓPRIA TELA */}
      <CompanyParamsCard
        parameters={companyParams}
        onSave={handleSaveCompanyParams}
        saving={savingCompanyParams}
      />

      {/* Tabs Principais */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full sm:w-auto h-auto p-1 bg-slate-100/90 border border-slate-200 rounded-lg">
          <TabsTrigger
            value="produto"
            className="text-xs py-2 gap-1.5 font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-700"
          >
            <Package className="h-3.5 w-3.5" />
            <span>Produto Cadastrado</span>
          </TabsTrigger>
          <TabsTrigger
            value="avulsa"
            className="text-xs py-2 gap-1.5 font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-700"
          >
            <Calculator className="h-3.5 w-3.5" />
            <span>Precificação Avulsa</span>
          </TabsTrigger>
          <TabsTrigger
            value="rapida"
            className="text-xs py-2 gap-1.5 font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-700"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Precificação Rápida</span>
          </TabsTrigger>
          <TabsTrigger
            value="historico"
            className="text-xs py-2 gap-1.5 font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-700"
          >
            <History className="h-3.5 w-3.5" />
            <span>Histórico ({historyList.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* ==================================================================== */}
        {/* ABA 1: PRECIFICAR PRODUTO CADASTRADO                                */}
        {/* ==================================================================== */}
        <TabsContent value="produto" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Coluna Esquerda: Produto e Parâmetros */}
            <div className="lg:col-span-7 space-y-4">
              <Card className="border-slate-200 shadow-2xs">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold text-slate-900">
                        1. Selecionar Produto do Estoque
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        Busque pelo nome, código SKU ou código de barras
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchProductModalOpen(true)
                        handleSearchProducts('')
                      }}
                      className="h-8 text-xs gap-1.5 bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-semibold"
                    >
                      <Search className="h-3.5 w-3.5" />
                      <span>{selectedProduct ? 'Trocar Produto' : 'Buscar Produto'}</span>
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-4">
                  {selectedProduct ? (
                    <div className="p-3.5 rounded-lg border border-indigo-100 bg-indigo-50/40 space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900">
                              {selectedProduct.name}
                            </h3>
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-white border-slate-200 text-slate-700"
                            >
                              {selectedProduct.sku ? `SKU: ${selectedProduct.sku}` : 'Sem SKU'}
                            </Badge>
                          </div>
                          {selectedProduct.category && (
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Categoria: {selectedProduct.category}
                              {selectedProduct.fabricante &&
                                ` • Fabricante: ${selectedProduct.fabricante}`}
                            </p>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Preço Atual
                          </span>
                          <span className="font-mono text-sm font-bold text-slate-900">
                            {formatCurrencyBRL(selectedProduct.price || 0)}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-indigo-100 text-xs">
                        <div>
                          <span className="text-[11px] text-slate-500 block">
                            Custo Cadastrado:
                          </span>
                          <span className="font-mono font-bold text-slate-800">
                            {formatCurrencyBRL(selectedProduct.cost || 0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-500 block">Estoque Físico:</span>
                          <span className="font-mono font-bold text-slate-800">
                            {selectedProduct.stock_quantity ?? 0} un
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-500 block">
                            Código de Barras:
                          </span>
                          <span className="font-mono text-[11px] text-slate-600">
                            {selectedProduct.barcode || selectedProduct.codigo_barras || '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => {
                        setSearchProductModalOpen(true)
                        handleSearchProducts('')
                      }}
                      className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/20 transition-colors"
                    >
                      <Package className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                      <p className="text-xs font-bold text-slate-700">Nenhum produto selecionado</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Clique aqui para buscar uma peça ou produto do catálogo
                      </p>
                    </div>
                  )}

                  {/* PARÂMETROS DE FORMAÇÃO DE PREÇO (CUSTOS DIRETOS) */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        2. Custos Diretos do Produto
                      </h4>
                      {/* TOGGLE R$ / US$ e COTAÇÃO DO DÓLAR */}
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                          <button
                            type="button"
                            onClick={() => setCurrency1('BRL')}
                            className={`text-xs px-2.5 py-1 rounded-md font-bold transition-all ${
                              currency1 === 'BRL'
                                ? 'bg-white text-indigo-700 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            R$ (BRL)
                          </button>
                          <button
                            type="button"
                            onClick={() => setCurrency1('USD')}
                            className={`text-xs px-2.5 py-1 rounded-md font-bold transition-all ${
                              currency1 === 'USD'
                                ? 'bg-white text-emerald-700 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            US$ (Dólar)
                          </button>
                        </div>

                        {/* Campo Cotação do Dólar editável com conversão automática imediata */}
                        <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-0.5">
                          <span className="text-[11px] font-semibold text-emerald-800">
                            Cotação US$:
                          </span>
                          <span className="text-[11px] font-mono text-emerald-700 font-bold">
                            R$
                          </span>
                          <Input
                            type="number"
                            step="0.01"
                            value={dolarInputLive}
                            onChange={(e) => setDolarInputLive(e.target.value)}
                            className="h-6 w-16 text-xs font-mono font-bold text-emerald-900 bg-white border-emerald-300 px-1 py-0"
                            title="Cotação do Dólar do dia (converte automaticamente)"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                          <span>Custo do Produto ({currency1}) *</span>
                          {currency1 === 'USD' && (
                            <span className="text-[10px] text-emerald-700 font-bold font-mono">
                              = R${' '}
                              {(
                                (parseFloat(costInput1.replace(',', '.')) || 0) * cotacaoDolarAtiva
                              ).toFixed(2)}
                            </span>
                          )}
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={costInput1}
                          onChange={(e) => setCostInput1(e.target.value)}
                          className="h-9 font-mono text-xs font-bold"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-slate-700">
                          Frete Unitário (R$)
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={freightInput1}
                          onChange={(e) => setFreightInput1(e.target.value)}
                          className="h-9 font-mono text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-slate-700">
                          Custo Adicional 1 / Embalagem (R$)
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={extraCost1A}
                          onChange={(e) => setExtraCost1A(e.target.value)}
                          className="h-9 font-mono text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-slate-700">
                          Custo Adicional 2 / Outros (R$)
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={extraCost1B}
                          onChange={(e) => setExtraCost1B(e.target.value)}
                          className="h-9 font-mono text-xs"
                        />
                      </div>
                    </div>

                    {/* DEDUÇÕES: CUSTO FIXO % + CUSTO VARIÁVEL % + LUCRATIVIDADE % */}
                    <div className="pt-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          3. Parâmetros de Markup (% sobre Preço de Venda)
                        </h4>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Markup = 1 ÷ (1 − C.Fixo% − C.Variável% − Lucro%)
                        </span>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                        {/* Destaque dos 3 Componentes Principais da Fórmula */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-2.5 bg-white rounded-lg border border-indigo-100 shadow-2xs">
                          <div className="space-y-1">
                            <Label className="text-[11px] font-bold text-sky-900 flex items-center justify-between">
                              <span>CUSTO FIXO %</span>
                              <span className="text-[10px] text-sky-600 font-mono font-normal">
                                Empresa
                              </span>
                            </Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={fixedExpensesPct1}
                              onChange={(e) => setFixedExpensesPct1(e.target.value)}
                              className="h-8 font-mono text-xs font-bold text-sky-800 bg-sky-50/50 border-sky-200"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[11px] font-bold text-indigo-900 flex items-center justify-between">
                              <span>CUSTO VARIÁVEL %</span>
                              <span className="text-[10px] text-indigo-600 font-mono font-normal">
                                Soma variáveis
                              </span>
                            </Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={variableExpensesTotal1}
                              onChange={(e) => setVariableExpensesTotal1(e.target.value)}
                              className="h-8 font-mono text-xs font-bold text-indigo-800 bg-indigo-50/50 border-indigo-200"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[11px] font-bold text-emerald-900 flex items-center justify-between">
                              <span>LUCRATIVIDADE %</span>
                              <span className="text-[10px] text-emerald-600 font-mono font-normal">
                                Alvo
                              </span>
                            </Label>
                            <Input
                              type="number"
                              step="0.5"
                              value={marginInput1}
                              onChange={(e) => setMarginInput1(e.target.value)}
                              className="h-8 font-mono text-xs font-bold text-emerald-800 bg-emerald-50/60 border-emerald-300"
                            />
                          </div>
                        </div>

                        {/* Detalhamento das taxas componentes dos Custos Variáveis */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-[11px] text-slate-600 font-semibold">
                            <span>Composição dos Custos Variáveis:</span>
                            <button
                              type="button"
                              onClick={() => {
                                const cTax = parseFloat(cardTaxPct1.replace(',', '.')) || 0
                                const icms = parseFloat(icmsPct1.replace(',', '.')) || 0
                                const impSaida = parseFloat(impostoSaidaPct1.replace(',', '.')) || 0
                                const com = parseFloat(commissionPct1.replace(',', '.')) || 0
                                const ipi = parseFloat(ipiPct1.replace(',', '.')) || 0
                                const soma =
                                  Math.round((cTax + icms + impSaida + com + ipi) * 10) / 10
                                setVariableExpensesTotal1(String(soma))
                              }}
                              className="text-[10px] text-indigo-600 hover:underline font-normal"
                            >
                              Sincronizar soma com Custo Variável %
                            </button>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                            <div className="space-y-1">
                              <Label className="text-[10px] font-semibold text-slate-600 flex items-center justify-between">
                                <span>Taxa Cartão %</span>
                                {selectedMethod1 && (
                                  <span className="text-[9px] text-emerald-600 font-bold">tab</span>
                                )}
                              </Label>
                              <Input
                                type="number"
                                step="0.1"
                                value={cardTaxPct1}
                                onChange={(e) => {
                                  const val = e.target.value
                                  setCardTaxPct1(val)
                                  const cTax = parseFloat(val.replace(',', '.')) || 0
                                  const icms = parseFloat(icmsPct1.replace(',', '.')) || 0
                                  const impSaida =
                                    parseFloat(impostoSaidaPct1.replace(',', '.')) || 0
                                  const com = parseFloat(commissionPct1.replace(',', '.')) || 0
                                  const ipi = parseFloat(ipiPct1.replace(',', '.')) || 0
                                  setVariableExpensesTotal1(
                                    String(
                                      Math.round((cTax + icms + impSaida + com + ipi) * 10) / 10,
                                    ),
                                  )
                                }}
                                className="h-8 font-mono text-xs"
                              />
                            </div>

                            <div className="space-y-1">
                              <Label className="text-[10px] font-semibold text-slate-600">
                                ICMS/Simples %
                              </Label>
                              <Input
                                type="number"
                                step="0.1"
                                value={icmsPct1}
                                onChange={(e) => {
                                  const val = e.target.value
                                  setIcmsPct1(val)
                                  const cTax = parseFloat(cardTaxPct1.replace(',', '.')) || 0
                                  const icms = parseFloat(val.replace(',', '.')) || 0
                                  const impSaida =
                                    parseFloat(impostoSaidaPct1.replace(',', '.')) || 0
                                  const com = parseFloat(commissionPct1.replace(',', '.')) || 0
                                  const ipi = parseFloat(ipiPct1.replace(',', '.')) || 0
                                  setVariableExpensesTotal1(
                                    String(
                                      Math.round((cTax + icms + impSaida + com + ipi) * 10) / 10,
                                    ),
                                  )
                                }}
                                className="h-8 font-mono text-xs"
                              />
                            </div>

                            {/* REQUISITO 2: CAMPO IMPOSTO DE SAÍDA % SEPARADO */}
                            <div className="space-y-1">
                              <Label className="text-[10px] font-bold text-indigo-900">
                                Imposto Saída % *
                              </Label>
                              <Input
                                type="number"
                                step="0.1"
                                value={impostoSaidaPct1}
                                onChange={(e) => {
                                  const val = e.target.value
                                  setImpostoSaidaPct1(val)
                                  const cTax = parseFloat(cardTaxPct1.replace(',', '.')) || 0
                                  const icms = parseFloat(icmsPct1.replace(',', '.')) || 0
                                  const impSaida = parseFloat(val.replace(',', '.')) || 0
                                  const com = parseFloat(commissionPct1.replace(',', '.')) || 0
                                  const ipi = parseFloat(ipiPct1.replace(',', '.')) || 0
                                  setVariableExpensesTotal1(
                                    String(
                                      Math.round((cTax + icms + impSaida + com + ipi) * 10) / 10,
                                    ),
                                  )
                                }}
                                className="h-8 font-mono text-xs font-bold text-indigo-700 bg-indigo-50/50 border-indigo-200"
                              />
                            </div>

                            <div className="space-y-1">
                              <Label className="text-[10px] font-semibold text-slate-600">
                                Comissão %
                              </Label>
                              <Input
                                type="number"
                                step="0.1"
                                value={commissionPct1}
                                onChange={(e) => {
                                  const val = e.target.value
                                  setCommissionPct1(val)
                                  const cTax = parseFloat(cardTaxPct1.replace(',', '.')) || 0
                                  const icms = parseFloat(icmsPct1.replace(',', '.')) || 0
                                  const impSaida =
                                    parseFloat(impostoSaidaPct1.replace(',', '.')) || 0
                                  const com = parseFloat(val.replace(',', '.')) || 0
                                  const ipi = parseFloat(ipiPct1.replace(',', '.')) || 0
                                  setVariableExpensesTotal1(
                                    String(
                                      Math.round((cTax + icms + impSaida + com + ipi) * 10) / 10,
                                    ),
                                  )
                                }}
                                className="h-8 font-mono text-xs"
                              />
                            </div>

                            <div className="space-y-1">
                              <Label className="text-[10px] font-semibold text-slate-600">
                                IPI / Outros %
                              </Label>
                              <Input
                                type="number"
                                step="0.1"
                                value={ipiPct1}
                                onChange={(e) => {
                                  const val = e.target.value
                                  setIpiPct1(val)
                                  const cTax = parseFloat(cardTaxPct1.replace(',', '.')) || 0
                                  const icms = parseFloat(icmsPct1.replace(',', '.')) || 0
                                  const impSaida =
                                    parseFloat(impostoSaidaPct1.replace(',', '.')) || 0
                                  const com = parseFloat(commissionPct1.replace(',', '.')) || 0
                                  const ipi = parseFloat(val.replace(',', '.')) || 0
                                  setVariableExpensesTotal1(
                                    String(
                                      Math.round((cTax + icms + impSaida + com + ipi) * 10) / 10,
                                    ),
                                  )
                                }}
                                className="h-8 font-mono text-xs"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Resumo do Markup Divisor */}
                        <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                          <span className="text-slate-600 font-medium">
                            Markup Divisor / Multiplicador:
                          </span>
                          <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            {calcResult1?.isPossible
                              ? `${calcResult1.markupMultiplicador}×`
                              : 'Indefinido'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Coluna Direita: Preço Sugerido, Cascata 100%, Comparação e Ação */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-900 text-white pb-3 pt-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4 text-emerald-400" />
                      <span>Preço de Venda Sugerido</span>
                    </CardTitle>
                    {calcResult1?.isPossible && (
                      <Badge className="bg-emerald-500 text-white font-mono text-[10px]">
                        Markup: {calcResult1.markupMultiplicador}×
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-4">
                  {calcResult1?.isPossible ? (
                    <>
                      {/* Destaque Principal do Preço */}
                      <div className="text-center py-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
                          Preço Sugerido (Metodologia JUCA)
                        </span>
                        <div className="text-3xl font-extrabold text-emerald-700 font-mono tabular-nums">
                          {formatCurrencyBRL(calcResult1.salePrice)}
                        </div>
                        <p className="text-[11px] text-emerald-800 font-medium mt-1">
                          Lucro líquido estimado:{' '}
                          <strong className="font-mono">
                            {formatCurrencyBRL(calcResult1.lucroUnitario)}
                          </strong>{' '}
                          ({calcResult1.fatias.lucro.pct}%)
                        </p>
                      </div>

                      {/* REQUISITO 2: GRÁFICO CASCATA 100% */}
                      <PricingWaterfallCard
                        salePrice={calcResult1.salePrice}
                        custoDiretoTotal={calcResult1.custoDiretoTotal}
                        custoDiretoPct={calcResult1.fatias.custoDireto.pct}
                        custoFixoRateado={calcResult1.custoFixoRateado}
                        custoFixoRateadoPct={calcResult1.fatias.custoFixoRateado?.pct}
                        despesaFixaValor={calcResult1.fatias.despesaFixa.valor}
                        despesaFixaPct={calcResult1.fatias.despesaFixa.pct}
                        custosVariaveisValor={calcResult1.fatias.custosVariaveis.valor}
                        custosVariaveisPct={calcResult1.fatias.custosVariaveis.pct}
                        lucroUnitario={calcResult1.lucroUnitario}
                        lucroPct={calcResult1.fatias.lucro.pct}
                        totalPct={calcResult1.fatias.totalPct}
                        detalheVariaveis={calcResult1.fatias.custosVariaveis.detalhe}
                      />

                      {/* REQUISITO 4: COMPARAÇÃO COM O PREÇO ATUAL (SE HOUVER) */}
                      {existingPriceDecomp && (
                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                          <div className="flex items-center justify-between border-b border-slate-200/70 pb-1.5">
                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              <ArrowUpDown className="h-3.5 w-3.5 text-indigo-600" />
                              Comparativo: Preço Atual vs. Sugerido
                            </span>
                            <span className="font-mono text-xs font-bold text-slate-700">
                              {formatCurrencyBRL(existingPriceDecomp.price)}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-2 rounded bg-white border border-slate-200/60">
                              <span className="text-[10px] text-slate-500 block">
                                Lucro no Preço Atual:
                              </span>
                              <span
                                className={`font-mono font-bold ${
                                  existingPriceDecomp.isPrejuizo
                                    ? 'text-rose-600'
                                    : 'text-slate-800'
                                }`}
                              >
                                {formatCurrencyBRL(existingPriceDecomp.lucroUnitario)} (
                                {existingPriceDecomp.margemLiquidaPct}%)
                              </span>
                            </div>

                            <div className="p-2 rounded bg-emerald-50/70 border border-emerald-200">
                              <span className="text-[10px] text-emerald-800 block">
                                Lucro no Preço Sugerido:
                              </span>
                              <span className="font-mono font-bold text-emerald-700">
                                {formatCurrencyBRL(calcResult1.lucroUnitario)} (
                                {calcResult1.fatias.lucro.pct}%)
                              </span>
                            </div>
                          </div>

                          {existingPriceDecomp.isPrejuizo && (
                            <div className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-800 text-[11px] flex items-center gap-1.5">
                              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                              <span>
                                <strong>Atenção:</strong> O preço atual gera prejuízo líquido após
                                cobrir despesas fixas e variáveis!
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Lucro no Estoque Total */}
                      {selectedProduct && (
                        <div className="p-3 bg-indigo-50/70 rounded-lg border border-indigo-100 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block">
                              Lucro no Estoque Atual ({selectedProduct.stock_quantity ?? 0} un)
                            </span>
                            <span className="text-[11px] text-indigo-900">
                              Lucro unitário × quantidade física
                            </span>
                          </div>
                          <span className="text-lg font-extrabold text-indigo-800 font-mono tabular-nums">
                            {formatCurrencyBRL(
                              calcResult1.lucroUnitario * (selectedProduct.stock_quantity ?? 0),
                            )}
                          </span>
                        </div>
                      )}

                      {/* Seletor de Cliente integrado ao envio de Orçamento */}
                      {renderCustomerSelector()}

                      {/* Botões de Ação */}
                      <div className="space-y-2 pt-2">
                        <Button
                          type="button"
                          disabled={!calcResult1?.isPossible || !calcResult1?.salePrice}
                          onClick={async () => {
                            const resolvedCust = await resolveCustomerForOrcamento()
                            const item = {
                              tipo: 'produto',
                              id_produto: selectedProduct ? selectedProduct.id : null,
                              descricao: selectedProduct?.name || 'Item Precificado',
                              quantidade: 1,
                              valor_unitario: calcResult1?.salePrice || 0,
                              valor_total_item: calcResult1?.salePrice || 0,
                            }
                            navigate('/orcamentos/novo', {
                              state: {
                                fromPricing: true,
                                item,
                                pricingItem: item,
                                customer_id: resolvedCust.customer_id,
                                customer_name: resolvedCust.customer_name,
                                customer_phone: resolvedCust.customer_phone,
                                cliente: resolvedCust.customer_id
                                  ? {
                                      id: resolvedCust.customer_id,
                                      name: resolvedCust.customer_name,
                                      phone: resolvedCust.customer_phone,
                                    }
                                  : resolvedCust.customer_name
                                    ? {
                                        id: '',
                                        name: resolvedCust.customer_name,
                                        phone: resolvedCust.customer_phone,
                                      }
                                    : null,
                              },
                            })
                          }}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 gap-1.5"
                        >
                          <FileText className="h-4 w-4" />
                          <span>Enviar para Orçamento</span>
                        </Button>

                        {selectedProduct ? (
                          <Button
                            type="button"
                            onClick={() => setConfirmApplyModalOpen(true)}
                            className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold h-10 gap-1.5 shadow-xs"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Aplicar preço ao produto</span>
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setSearchProductModalOpen(true)
                              handleSearchProducts('')
                            }}
                            className="w-full h-10 border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold"
                          >
                            <Search className="h-4 w-4" />
                            <span>Vincular Produto para Aplicar</span>
                          </Button>
                        )}

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleCopySummary(calcResult1, selectedProduct?.name || 'Precificação')
                          }
                          className="w-full text-xs text-slate-600 hover:text-slate-900 gap-1.5"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copiar resumo da precificação</span>
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-10 text-rose-600 text-xs space-y-2">
                      <AlertCircle className="h-8 w-8 mx-auto text-rose-500" />
                      <p className="font-bold">Cálculo Impossível</p>
                      <p className="text-slate-500 max-w-xs mx-auto">
                        {calcResult1?.errorMessage ||
                          'Ajuste os valores para obter um preço sugerido.'}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* REQUISITO 1: TABELA EDITÁVEL DE FORMAS DE PAGAMENTO COM TAXAS E PARCELAS */}
              <PaymentMethodsTableCard
                methods={companyParams.payment_methods_tax || DEFAULT_PAYMENT_METHODS_TAX}
                onSaveMethods={handleSavePaymentMethods}
                saving={savingPaymentMethods}
                currentSalePrice={calcResult1?.salePrice || 0}
                selectedMethodId={selectedMethod1?.id}
                onSelectMethod={(method) => {
                  setSelectedMethod1(method)
                  if (method) {
                    setCardTaxPct1(String(method.taxa_pct))
                    const cTax = method.taxa_pct
                    const icms = parseFloat(icmsPct1.replace(',', '.')) || 0
                    const impSaida = parseFloat(impostoSaidaPct1.replace(',', '.')) || 0
                    const com = parseFloat(commissionPct1.replace(',', '.')) || 0
                    const ipi = parseFloat(ipiPct1.replace(',', '.')) || 0
                    setVariableExpensesTotal1(
                      String(Math.round((cTax + icms + impSaida + com + ipi) * 10) / 10),
                    )
                  }
                }}
              />
            </div>
          </div>
        </TabsContent>

        {/* ==================================================================== */}
        {/* ABA 2: PRECIFICAÇÃO AVULSA (Calculadora Livre)                       */}
        {/* ==================================================================== */}
        <TabsContent value="avulsa" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-4">
              <Card className="border-slate-200 shadow-2xs">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-indigo-600">
                      <Calculator className="h-5 w-5" />
                      <div>
                        <CardTitle className="text-sm font-bold text-slate-900">
                          Calculadora Livre de Precificação
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500">
                          Calcule preços e simule cotações sem vincular a nenhum produto
                        </CardDescription>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setCurrency2('BRL')}
                          className={`text-xs px-2.5 py-1 rounded-md font-bold transition-all ${
                            currency2 === 'BRL'
                              ? 'bg-white text-indigo-700 shadow-xs'
                              : 'text-slate-600'
                          }`}
                        >
                          R$
                        </button>
                        <button
                          type="button"
                          onClick={() => setCurrency2('USD')}
                          className={`text-xs px-2.5 py-1 rounded-md font-bold transition-all ${
                            currency2 === 'USD'
                              ? 'bg-white text-emerald-700 shadow-xs'
                              : 'text-slate-600'
                          }`}
                        >
                          US$
                        </button>
                      </div>

                      <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-0.5">
                        <span className="text-[11px] font-semibold text-emerald-800">
                          Cotação US$:
                        </span>
                        <span className="text-[11px] font-mono text-emerald-700 font-bold">R$</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={dolarInputLive}
                          onChange={(e) => setDolarInputLive(e.target.value)}
                          className="h-6 w-16 text-xs font-mono font-bold text-emerald-900 bg-white border-emerald-300 px-1 py-0"
                          title="Cotação do Dólar do dia (converte automaticamente)"
                        />
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                        <span>Custo Base ({currency2}) *</span>
                        {currency2 === 'USD' && (
                          <span className="text-[10px] text-emerald-700 font-mono font-bold">
                            = R${' '}
                            {(
                              (parseFloat(costInput2.replace(',', '.')) || 0) * cotacaoDolarAtiva
                            ).toFixed(2)}
                          </span>
                        )}
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={costInput2}
                        onChange={(e) => setCostInput2(e.target.value)}
                        className="h-9 font-mono text-xs font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-700">
                        Frete Estimado (R$)
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={freightInput2}
                        onChange={(e) => setFreightInput2(e.target.value)}
                        className="h-9 font-mono text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-700">
                        Custo Adicional 1 (R$)
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={extraCost2A}
                        onChange={(e) => setExtraCost2A(e.target.value)}
                        className="h-9 font-mono text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-700">
                        Custo Adicional 2 (R$)
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={extraCost2B}
                        onChange={(e) => setExtraCost2B(e.target.value)}
                        className="h-9 font-mono text-xs"
                      />
                    </div>
                  </div>

                  {/* Alíquotas e Margem com Custo Fixo % e Custo Variável % editáveis */}
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                    {/* Componentes Principais da Fórmula */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-2.5 bg-white rounded-lg border border-indigo-100 shadow-2xs">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-sky-900 flex items-center justify-between">
                          <span>CUSTO FIXO %</span>
                          <span className="text-[10px] text-sky-600 font-mono font-normal">
                            Empresa
                          </span>
                        </Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={fixedExpensesPct2}
                          onChange={(e) => setFixedExpensesPct2(e.target.value)}
                          className="h-8 font-mono text-xs font-bold text-sky-800 bg-sky-50/50 border-sky-200"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-indigo-900 flex items-center justify-between">
                          <span>CUSTO VARIÁVEL %</span>
                          <span className="text-[10px] text-indigo-600 font-mono font-normal">
                            Soma variáveis
                          </span>
                        </Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={variableExpensesTotal2}
                          onChange={(e) => setVariableExpensesTotal2(e.target.value)}
                          className="h-8 font-mono text-xs font-bold text-indigo-800 bg-indigo-50/50 border-indigo-200"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-emerald-900 flex items-center justify-between">
                          <span>LUCRATIVIDADE %</span>
                          <span className="text-[10px] text-emerald-600 font-mono font-normal">
                            Alvo
                          </span>
                        </Label>
                        <Input
                          type="number"
                          step="0.5"
                          value={marginInput2}
                          onChange={(e) => setMarginInput2(e.target.value)}
                          className="h-8 font-mono text-xs font-bold text-emerald-800 bg-emerald-50/60 border-emerald-300"
                        />
                      </div>
                    </div>

                    {/* Detalhamento das taxas componentes */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-600 font-semibold">
                        <span>Composição dos Custos Variáveis:</span>
                        <button
                          type="button"
                          onClick={() => {
                            const cTax = parseFloat(cardTaxPct2.replace(',', '.')) || 0
                            const icms = parseFloat(icmsPct2.replace(',', '.')) || 0
                            const impSaida = parseFloat(impostoSaidaPct2.replace(',', '.')) || 0
                            const com = parseFloat(commissionPct2.replace(',', '.')) || 0
                            const ipi = parseFloat(ipiPct2.replace(',', '.')) || 0
                            const soma = Math.round((cTax + icms + impSaida + com + ipi) * 10) / 10
                            setVariableExpensesTotal2(String(soma))
                          }}
                          className="text-[10px] text-indigo-600 hover:underline font-normal"
                        >
                          Sincronizar soma com Custo Variável %
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-semibold text-slate-600 flex items-center justify-between">
                            <span>Taxa Cartão %</span>
                            {selectedMethod2 && (
                              <span className="text-[9px] text-emerald-600 font-bold">tab</span>
                            )}
                          </Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={cardTaxPct2}
                            onChange={(e) => {
                              const val = e.target.value
                              setCardTaxPct2(val)
                              const cTax = parseFloat(val.replace(',', '.')) || 0
                              const icms = parseFloat(icmsPct2.replace(',', '.')) || 0
                              const impSaida = parseFloat(impostoSaidaPct2.replace(',', '.')) || 0
                              const com = parseFloat(commissionPct2.replace(',', '.')) || 0
                              const ipi = parseFloat(ipiPct2.replace(',', '.')) || 0
                              setVariableExpensesTotal2(
                                String(Math.round((cTax + icms + impSaida + com + ipi) * 10) / 10),
                              )
                            }}
                            className="h-8 font-mono text-xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] font-semibold text-slate-600">
                            ICMS/Simples %
                          </Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={icmsPct2}
                            onChange={(e) => {
                              const val = e.target.value
                              setIcmsPct2(val)
                              const cTax = parseFloat(cardTaxPct2.replace(',', '.')) || 0
                              const icms = parseFloat(val.replace(',', '.')) || 0
                              const impSaida = parseFloat(impostoSaidaPct2.replace(',', '.')) || 0
                              const com = parseFloat(commissionPct2.replace(',', '.')) || 0
                              const ipi = parseFloat(ipiPct2.replace(',', '.')) || 0
                              setVariableExpensesTotal2(
                                String(Math.round((cTax + icms + impSaida + com + ipi) * 10) / 10),
                              )
                            }}
                            className="h-8 font-mono text-xs"
                          />
                        </div>

                        {/* REQUISITO 2: CAMPO IMPOSTO DE SAÍDA % */}
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-indigo-900">
                            Imposto Saída % *
                          </Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={impostoSaidaPct2}
                            onChange={(e) => {
                              const val = e.target.value
                              setImpostoSaidaPct2(val)
                              const cTax = parseFloat(cardTaxPct2.replace(',', '.')) || 0
                              const icms = parseFloat(icmsPct2.replace(',', '.')) || 0
                              const impSaida = parseFloat(val.replace(',', '.')) || 0
                              const com = parseFloat(commissionPct2.replace(',', '.')) || 0
                              const ipi = parseFloat(ipiPct2.replace(',', '.')) || 0
                              setVariableExpensesTotal2(
                                String(Math.round((cTax + icms + impSaida + com + ipi) * 10) / 10),
                              )
                            }}
                            className="h-8 font-mono text-xs font-bold text-indigo-700 bg-indigo-50/50 border-indigo-200"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] font-semibold text-slate-600">
                            Comissão %
                          </Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={commissionPct2}
                            onChange={(e) => {
                              const val = e.target.value
                              setCommissionPct2(val)
                              const cTax = parseFloat(cardTaxPct2.replace(',', '.')) || 0
                              const icms = parseFloat(icmsPct2.replace(',', '.')) || 0
                              const impSaida = parseFloat(impostoSaidaPct2.replace(',', '.')) || 0
                              const com = parseFloat(val.replace(',', '.')) || 0
                              const ipi = parseFloat(ipiPct2.replace(',', '.')) || 0
                              setVariableExpensesTotal2(
                                String(Math.round((cTax + icms + impSaida + com + ipi) * 10) / 10),
                              )
                            }}
                            className="h-8 font-mono text-xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] font-semibold text-slate-600">
                            IPI / Outros %
                          </Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={ipiPct2}
                            onChange={(e) => {
                              const val = e.target.value
                              setIpiPct2(val)
                              const cTax = parseFloat(cardTaxPct2.replace(',', '.')) || 0
                              const icms = parseFloat(icmsPct2.replace(',', '.')) || 0
                              const impSaida = parseFloat(impostoSaidaPct2.replace(',', '.')) || 0
                              const com = parseFloat(commissionPct2.replace(',', '.')) || 0
                              const ipi = parseFloat(val.replace(',', '.')) || 0
                              setVariableExpensesTotal2(
                                String(Math.round((cTax + icms + impSaida + com + ipi) * 10) / 10),
                              )
                            }}
                            className="h-8 font-mono text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Resultado Modo 2 */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-900 text-white pb-3 pt-4">
                  <CardTitle className="text-sm font-bold flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4 text-emerald-400" />
                      Resultado da Calculadora
                    </span>
                    {calcResult2?.isPossible && (
                      <Badge className="bg-emerald-500 text-white font-mono text-[10px]">
                        Markup: {calcResult2.markupMultiplicador}×
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>

                <CardContent className="pt-4 space-y-4">
                  {calcResult2?.isPossible ? (
                    <>
                      <div className="text-center py-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
                          Preço Final Sugerido
                        </span>
                        <div className="text-3xl font-extrabold text-emerald-700 font-mono tabular-nums">
                          {formatCurrencyBRL(calcResult2.salePrice)}
                        </div>
                        <p className="text-[11px] text-emerald-800 font-medium mt-1">
                          Lucro líquido:{' '}
                          <strong className="font-mono">
                            {formatCurrencyBRL(calcResult2.lucroUnitario)}
                          </strong>
                        </p>
                      </div>

                      <PricingWaterfallCard
                        salePrice={calcResult2.salePrice}
                        custoDiretoTotal={calcResult2.custoDiretoTotal}
                        custoDiretoPct={calcResult2.fatias.custoDireto.pct}
                        custoFixoRateado={calcResult2.custoFixoRateado}
                        custoFixoRateadoPct={calcResult2.fatias.custoFixoRateado?.pct}
                        despesaFixaValor={calcResult2.fatias.despesaFixa.valor}
                        despesaFixaPct={calcResult2.fatias.despesaFixa.pct}
                        custosVariaveisValor={calcResult2.fatias.custosVariaveis.valor}
                        custosVariaveisPct={calcResult2.fatias.custosVariaveis.pct}
                        lucroUnitario={calcResult2.lucroUnitario}
                        lucroPct={calcResult2.fatias.lucro.pct}
                        totalPct={calcResult2.fatias.totalPct}
                        detalheVariaveis={calcResult2.fatias.custosVariaveis.detalhe}
                      />

                      {/* Seletor de Cliente no Modo 2 (Avulsa) */}
                      {renderCustomerSelector()}

                      <div className="pt-2 space-y-2">
                        <Button
                          type="button"
                          disabled={!calcResult2?.isPossible || !calcResult2?.salePrice}
                          onClick={async () => {
                            const resolvedCust = await resolveCustomerForOrcamento()
                            const item = {
                              tipo: 'produto',
                              id_produto: null,
                              descricao: 'Item Avulso Precificado',
                              quantidade: 1,
                              valor_unitario: calcResult2?.salePrice || 0,
                              valor_total_item: calcResult2?.salePrice || 0,
                            }
                            navigate('/orcamentos/novo', {
                              state: {
                                fromPricing: true,
                                item,
                                pricingItem: item,
                                customer_id: resolvedCust.customer_id,
                                customer_name: resolvedCust.customer_name,
                                customer_phone: resolvedCust.customer_phone,
                                cliente: resolvedCust.customer_id
                                  ? {
                                      id: resolvedCust.customer_id,
                                      name: resolvedCust.customer_name,
                                      phone: resolvedCust.customer_phone,
                                    }
                                  : resolvedCust.customer_name
                                    ? {
                                        id: '',
                                        name: resolvedCust.customer_name,
                                        phone: resolvedCust.customer_phone,
                                      }
                                    : null,
                              },
                            })
                          }}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 gap-1.5"
                        >
                          <FileText className="h-4 w-4" />
                          <span>Enviar para Orçamento</span>
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleCopySummary(calcResult2, 'Precificação Avulsa')}
                          className="w-full text-slate-700 font-bold h-9 gap-1.5 border-slate-200"
                        >
                          <Copy className="h-4 w-4" />
                          <span>Copiar Resultado</span>
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          onClick={async () => {
                            try {
                              await createPricingHistory({
                                cost: calcResult2.custoDiretoTotal,
                                despesas_pct: calcResult2.despesasPct,
                                markup_pct: calcResult2.markupSobreCustoPct,
                                margem_pct: calcResult2.lucratividadePct,
                                sale_price: calcResult2.salePrice,
                                lucro_unitario: calcResult2.lucroUnitario,
                                mode: 'avulsa',
                                frete: calcResult2.frete,
                                custos_adicionais:
                                  calcResult2.custoAdicional1 + calcResult2.custoAdicional2,
                                custos_variaveis_pct: calcResult2.custosVariaveisPct,
                                despesa_fixa_pct: calcResult2.despesaFixaPct,
                                custo_moeda: calcResult2.moeda,
                                cost_usd: calcResult2.custoProdutoUSD,
                                cotacao_dolar: calcResult2.cotacaoDolar,
                                taxa_cartao_pct: calcResult2.taxaCartaoPct,
                                icms_pct: calcResult2.icmsPct,
                                imposto_saida_pct: calcResult2.impostoSaidaPct,
                                payment_method_nome: selectedMethod2?.nome,
                                comissao_pct: calcResult2.comissaoPct,
                                ipi_pct: calcResult2.ipiPct,
                                custo_fixo_rateado_unitario: calcResult2.custoFixoRateado,
                                custo_fixo_mensal: companyParams.custo_fixo_mensal,
                                volume_estimado_servicos_mes: companyParams.volume_estimado_servicos_mes,
                              })                              toast({ title: 'Cálculo salvo no histórico!' })
                              loadHistory()
                            } catch {
                              toast({
                                title: 'Erro ao salvar no histórico',
                                variant: 'destructive',
                              })
                            }
                          }}
                          className="w-full text-xs font-semibold text-slate-700 hover:bg-slate-50 h-9"
                        >
                          <span>Salvar no Histórico de Precificações</span>
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 text-rose-600 text-xs space-y-1">
                      <AlertCircle className="h-6 w-6 mx-auto text-rose-500" />
                      <p className="font-bold">Valores fora dos parâmetros</p>
                      <p className="text-slate-500">{calcResult2?.errorMessage}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* TABELA DE FORMAS DE PAGAMENTO NO MODO AVULSA */}
              <PaymentMethodsTableCard
                methods={companyParams.payment_methods_tax || DEFAULT_PAYMENT_METHODS_TAX}
                onSaveMethods={handleSavePaymentMethods}
                saving={savingPaymentMethods}
                currentSalePrice={calcResult2?.salePrice || 0}
                selectedMethodId={selectedMethod2?.id}
                onSelectMethod={(method) => {
                  setSelectedMethod2(method)
                  if (method) {
                    setCardTaxPct2(String(method.taxa_pct))
                    const cTax = method.taxa_pct
                    const icms = parseFloat(icmsPct2.replace(',', '.')) || 0
                    const impSaida = parseFloat(impostoSaidaPct2.replace(',', '.')) || 0
                    const com = parseFloat(commissionPct2.replace(',', '.')) || 0
                    const ipi = parseFloat(ipiPct2.replace(',', '.')) || 0
                    setVariableExpensesTotal2(
                      String(Math.round((cTax + icms + impSaida + com + ipi) * 10) / 10),
                    )
                  }
                }}
              />
            </div>
          </div>
        </TabsContent>
        {/* ==================================================================== */}
        {/* ABA 3: PRECIFICAÇÃO RÁPIDA (Com Vínculo ou Novo Produto)            */}
        {/* ==================================================================== */}
        <TabsContent value="rapida" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-4">
              <Card className="border-slate-200 shadow-2xs">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold text-slate-900">
                        Precificação Rápida
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        Calcule primeiro e vincule a um produto existente ou cadastre um novo na
                        hora
                      </CardDescription>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {linkedProduct3 && (
                        <Badge className="bg-indigo-600 text-white text-[11px] font-bold">
                          {linkedProduct3.name}
                        </Badge>
                      )}
                      <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setCurrency3('BRL')}
                          className={`text-xs px-2 py-0.5 rounded-md font-bold ${
                            currency3 === 'BRL'
                              ? 'bg-white text-indigo-700 shadow-xs'
                              : 'text-slate-600'
                          }`}
                        >
                          R$
                        </button>
                        <button
                          type="button"
                          onClick={() => setCurrency3('USD')}
                          className={`text-xs px-2 py-0.5 rounded-md font-bold ${
                            currency3 === 'USD'
                              ? 'bg-white text-emerald-700 shadow-xs'
                              : 'text-slate-600'
                          }`}
                        >
                          US$
                        </button>
                      </div>

                      <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-0.5">
                        <span className="text-[11px] font-semibold text-emerald-800">
                          Cotação US$:
                        </span>
                        <span className="text-[11px] font-mono text-emerald-700 font-bold">R$</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={dolarInputLive}
                          onChange={(e) => setDolarInputLive(e.target.value)}
                          className="h-6 w-16 text-xs font-mono font-bold text-emerald-900 bg-white border-emerald-300 px-1 py-0"
                          title="Cotação do Dólar do dia (converte automaticamente)"
                        />
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                        <span>Custo Estimado ({currency3}) *</span>
                        {currency3 === 'USD' && (
                          <span className="text-[10px] text-emerald-700 font-mono font-bold">
                            = R${' '}
                            {(
                              (parseFloat(costInput3.replace(',', '.')) || 0) * cotacaoDolarAtiva
                            ).toFixed(2)}
                          </span>
                        )}
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={costInput3}
                        onChange={(e) => setCostInput3(e.target.value)}
                        className="h-9 font-mono text-xs font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-700">Frete (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={freightInput3}
                        onChange={(e) => setFreightInput3(e.target.value)}
                        className="h-9 font-mono text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-700">
                        Custos Extras (R$)
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={extraCost3A}
                        onChange={(e) => setExtraCost3A(e.target.value)}
                        className="h-9 font-mono text-xs"
                      />
                    </div>
                  </div>

                  {/* Parâmetros de Markup Modo 3: Custo Fixo %, Custo Variável %, Lucratividade % */}
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-2.5 bg-white rounded-lg border border-indigo-100 shadow-2xs">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-sky-900 flex items-center justify-between">
                          <span>CUSTO FIXO %</span>
                        </Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={fixedExpensesPct3}
                          onChange={(e) => setFixedExpensesPct3(e.target.value)}
                          className="h-8 font-mono text-xs font-bold text-sky-800 bg-sky-50/50 border-sky-200"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-indigo-900 flex items-center justify-between">
                          <span>CUSTO VARIÁVEL %</span>
                        </Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={variableExpensesTotal3}
                          onChange={(e) => setVariableExpensesTotal3(e.target.value)}
                          className="h-8 font-mono text-xs font-bold text-indigo-800 bg-indigo-50/50 border-indigo-200"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-emerald-900 flex items-center justify-between">
                          <span>LUCRATIVIDADE %</span>
                        </Label>
                        <Input
                          type="number"
                          step="0.5"
                          value={marginInput3}
                          onChange={(e) => setMarginInput3(e.target.value)}
                          className="h-8 font-mono text-xs font-bold text-emerald-800 bg-emerald-50/60 border-emerald-300"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 pt-1">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold text-slate-600">
                          Taxa Cartão %
                        </Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={cardTaxPct3}
                          onChange={(e) => {
                            const val = e.target.value
                            setCardTaxPct3(val)
                            const cTax = parseFloat(val.replace(',', '.')) || 0
                            const icms = parseFloat(icmsPct3.replace(',', '.')) || 0
                            const impSaida = parseFloat(impostoSaidaPct3.replace(',', '.')) || 0
                            const com = parseFloat(commissionPct3.replace(',', '.')) || 0
                            const ipi = parseFloat(ipiPct3.replace(',', '.')) || 0
                            setVariableExpensesTotal3(
                              String(Math.round((cTax + icms + impSaida + com + ipi) * 10) / 10),
                            )
                          }}
                          className="h-8 font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold text-slate-600">
                          ICMS/Simples %
                        </Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={icmsPct3}
                          onChange={(e) => {
                            const val = e.target.value
                            setIcmsPct3(val)
                            const cTax = parseFloat(cardTaxPct3.replace(',', '.')) || 0
                            const icms = parseFloat(val.replace(',', '.')) || 0
                            const impSaida = parseFloat(impostoSaidaPct3.replace(',', '.')) || 0
                            const com = parseFloat(commissionPct3.replace(',', '.')) || 0
                            const ipi = parseFloat(ipiPct3.replace(',', '.')) || 0
                            setVariableExpensesTotal3(
                              String(Math.round((cTax + icms + impSaida + com + ipi) * 10) / 10),
                            )
                          }}
                          className="h-8 font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-indigo-900">
                          Imp. Saída % *
                        </Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={impostoSaidaPct3}
                          onChange={(e) => {
                            const val = e.target.value
                            setImpostoSaidaPct3(val)
                            const cTax = parseFloat(cardTaxPct3.replace(',', '.')) || 0
                            const icms = parseFloat(icmsPct3.replace(',', '.')) || 0
                            const impSaida = parseFloat(val.replace(',', '.')) || 0
                            const com = parseFloat(commissionPct3.replace(',', '.')) || 0
                            const ipi = parseFloat(ipiPct3.replace(',', '.')) || 0
                            setVariableExpensesTotal3(
                              String(Math.round((cTax + icms + impSaida + com + ipi) * 10) / 10),
                            )
                          }}
                          className="h-8 font-mono text-xs font-bold text-indigo-700 bg-indigo-50/50 border-indigo-200"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold text-slate-600">
                          Comissão %
                        </Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={commissionPct3}
                          onChange={(e) => {
                            const val = e.target.value
                            setCommissionPct3(val)
                            const cTax = parseFloat(cardTaxPct3.replace(',', '.')) || 0
                            const icms = parseFloat(icmsPct3.replace(',', '.')) || 0
                            const impSaida = parseFloat(impostoSaidaPct3.replace(',', '.')) || 0
                            const com = parseFloat(val.replace(',', '.')) || 0
                            const ipi = parseFloat(ipiPct3.replace(',', '.')) || 0
                            setVariableExpensesTotal3(
                              String(Math.round((cTax + icms + impSaida + com + ipi) * 10) / 10),
                            )
                          }}
                          className="h-8 font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold text-slate-600">IPI %</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={ipiPct3}
                          onChange={(e) => {
                            const val = e.target.value
                            setIpiPct3(val)
                            const cTax = parseFloat(cardTaxPct3.replace(',', '.')) || 0
                            const icms = parseFloat(icmsPct3.replace(',', '.')) || 0
                            const impSaida = parseFloat(impostoSaidaPct3.replace(',', '.')) || 0
                            const com = parseFloat(commissionPct3.replace(',', '.')) || 0
                            const ipi = parseFloat(val.replace(',', '.')) || 0
                            setVariableExpensesTotal3(
                              String(Math.round((cTax + icms + impSaida + com + ipi) * 10) / 10),
                            )
                          }}
                          className="h-8 font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Botões de Ação do Modo Rápido */}
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <Label className="text-xs font-bold text-slate-700 block">
                      Ações de Vinculação:
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setSearchProductModalOpen(true)
                          handleSearchProducts('')
                        }}
                        className="h-9 text-xs font-semibold gap-1.5 border-slate-200 hover:bg-slate-50"
                      >
                        <Search className="h-3.5 w-3.5 text-indigo-600" />
                        <span>Vincular a produto existente</span>
                      </Button>

                      <Button
                        type="button"
                        onClick={() => {
                          setNewProductName('')
                          setNewProductCategory('Peças')
                          setNewProductSku('')
                          setNewProductCost(String(calcResult3?.custoDiretoTotal || costInput3))
                          setNewProductModalOpen(true)
                        }}
                        className="h-9 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Criar novo produto na hora</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Resultado Modo 3 */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-900 text-white pb-3 pt-4">
                  <CardTitle className="text-sm font-bold flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4 text-emerald-400" />
                      Resultado Rápido
                    </span>
                    {calcResult3?.isPossible && (
                      <Badge className="bg-emerald-500 text-white font-mono text-[10px]">
                        Markup: {calcResult3.markupMultiplicador}×
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>

                <CardContent className="pt-4 space-y-4">
                  {calcResult3?.isPossible ? (
                    <>
                      <div className="text-center py-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
                          Preço Sugerido
                        </span>
                        <div className="text-3xl font-extrabold text-emerald-700 font-mono tabular-nums">
                          {formatCurrencyBRL(calcResult3.salePrice)}
                        </div>
                        <p className="text-[11px] text-emerald-800 font-medium mt-1">
                          Lucro líquido:{' '}
                          <strong className="font-mono">
                            {formatCurrencyBRL(calcResult3.lucroUnitario)}
                          </strong>
                        </p>
                      </div>

                      <PricingWaterfallCard
                        salePrice={calcResult3.salePrice}
                        custoDiretoTotal={calcResult3.custoDiretoTotal}
                        custoDiretoPct={calcResult3.fatias.custoDireto.pct}
                        custoFixoRateado={calcResult3.custoFixoRateado}
                        custoFixoRateadoPct={calcResult3.fatias.custoFixoRateado?.pct}
                        despesaFixaValor={calcResult3.fatias.despesaFixa.valor}
                        despesaFixaPct={calcResult3.fatias.despesaFixa.pct}
                        custosVariaveisValor={calcResult3.fatias.custosVariaveis.valor}
                        custosVariaveisPct={calcResult3.fatias.custosVariaveis.pct}
                        lucroUnitario={calcResult3.lucroUnitario}
                        lucroPct={calcResult3.fatias.lucro.pct}
                        totalPct={calcResult3.fatias.totalPct}
                        detalheVariaveis={calcResult3.fatias.custosVariaveis.detalhe}
                      />

                      {/* Seletor de Cliente no Modo 3 (Rápida) */}
                      {renderCustomerSelector()}

                      <div className="space-y-2 pt-2">
                        <Button
                          type="button"
                          disabled={!calcResult3?.isPossible || !calcResult3?.salePrice}
                          onClick={async () => {
                            const resolvedCust = await resolveCustomerForOrcamento()
                            const item = {
                              tipo: 'produto',
                              id_produto: linkedProduct3?.id || null,
                              descricao:
                                linkedProduct3?.name ||
                                newProductName ||
                                'Item Precificado (Rápida)',
                              quantidade: 1,
                              valor_unitario: calcResult3?.salePrice || 0,
                              valor_total_item: calcResult3?.salePrice || 0,
                            }
                            navigate('/orcamentos/novo', {
                              state: {
                                fromPricing: true,
                                item,
                                pricingItem: item,
                                customer_id: resolvedCust.customer_id,
                                customer_name: resolvedCust.customer_name,
                                customer_phone: resolvedCust.customer_phone,
                                cliente: resolvedCust.customer_id
                                  ? {
                                      id: resolvedCust.customer_id,
                                      name: resolvedCust.customer_name,
                                      phone: resolvedCust.customer_phone,
                                    }
                                  : resolvedCust.customer_name
                                    ? {
                                        id: '',
                                        name: resolvedCust.customer_name,
                                        phone: resolvedCust.customer_phone,
                                      }
                                    : null,
                              },
                            })
                          }}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 gap-1.5"
                        >
                          <FileText className="h-4 w-4" />
                          <span>Enviar para Orçamento</span>
                        </Button>

                        {linkedProduct3 && (
                          <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200 space-y-2">
                            <div className="text-xs">
                              <span className="text-slate-600 block">Produto Vinculado:</span>
                              <span className="font-bold text-indigo-950">
                                {linkedProduct3.name}
                              </span>
                            </div>
                            <Button
                              type="button"
                              onClick={() =>
                                handleApplyPriceToProduct(linkedProduct3, calcResult3, 'rapida')
                              }
                              disabled={applyingPrice}
                              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs h-9"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                              <span>
                                {applyingPrice
                                  ? 'Aplicando...'
                                  : 'Aplicar Preço ao Produto Vinculado'}
                              </span>
                            </Button>
                          </div>
                        )}

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopySummary(calcResult3, 'Precificação Rápida')}
                          className="w-full text-xs text-slate-600 hover:text-slate-900 gap-1.5"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copiar Resumo</span>
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 text-rose-600 text-xs">
                      <p className="font-bold">Cálculo impossível</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* TABELA DE FORMAS DE PAGAMENTO NO MODO RÁPIDO */}
              <PaymentMethodsTableCard
                methods={companyParams.payment_methods_tax || DEFAULT_PAYMENT_METHODS_TAX}
                onSaveMethods={handleSavePaymentMethods}
                saving={savingPaymentMethods}
                currentSalePrice={calcResult3?.salePrice || 0}
                selectedMethodId={selectedMethod3?.id}
                onSelectMethod={(method) => {
                  setSelectedMethod3(method)
                  if (method) {
                    setCardTaxPct3(String(method.taxa_pct))
                    const cTax = method.taxa_pct
                    const icms = parseFloat(icmsPct3.replace(',', '.')) || 0
                    const impSaida = parseFloat(impostoSaidaPct3.replace(',', '.')) || 0
                    const com = parseFloat(commissionPct3.replace(',', '.')) || 0
                    const ipi = parseFloat(ipiPct3.replace(',', '.')) || 0
                    setVariableExpensesTotal3(
                      String(Math.round((cTax + icms + impSaida + com + ipi) * 10) / 10),
                    )
                  }
                }}
              />
            </div>
          </div>
        </TabsContent>

        {/* ==================================================================== */}
        {/* ABA 4: HISTÓRICO DE PRECIFICAÇÕES AMPLIADO                          */}
        {/* ==================================================================== */}
        <TabsContent value="historico" className="space-y-4">
          <Card className="border-slate-200 shadow-2xs">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-slate-900">
                  Histórico Completo de Precificações
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Registros com frete, moeda, despesa fixa, custos variáveis e cotação do dólar
                </CardDescription>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={loadHistory}
                disabled={loadingHistory}
                className="h-8 text-xs gap-1"
              >
                <RefreshCw className={`h-3 w-3 ${loadingHistory ? 'animate-spin' : ''}`} />
                <span>Atualizar</span>
              </Button>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Data/Hora</th>
                      <th className="py-2.5 px-3">Modo</th>
                      <th className="py-2.5 px-3">Produto</th>
                      <th className="py-2.5 px-3 text-center">Forma Pagto</th>
                      <th className="py-2.5 px-3 text-center">Moeda / US$</th>
                      <th className="py-2.5 px-3 text-right">Custo Direto</th>
                      <th className="py-2.5 px-3 text-right">Frete</th>
                      <th className="py-2.5 px-3 text-center">Fixa %</th>
                      <th className="py-2.5 px-3 text-center">Var. %</th>
                      <th className="py-2.5 px-3 text-center">Margem %</th>
                      <th className="py-2.5 px-3 text-right">Preço Venda</th>
                      <th className="py-2.5 px-3 text-right">Lucro Líq.</th>
                      <th className="py-2.5 px-3">Por</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {historyList.map((item) => {
                      const prodName =
                        item.expand?.product?.name ||
                        (item.mode === 'avulsa' ? 'Cálculo Avulso' : '—')
                      const userName = item.expand?.created_by?.name || 'Sistema'
                      const dateFormatted = item.created
                        ? new Date(item.created).toLocaleString('pt-BR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : '—'

                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {dateFormatted}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                item.mode === 'produto'
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : item.mode === 'rapida'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {item.mode === 'produto'
                                ? 'Produto'
                                : item.mode === 'rapida'
                                  ? 'Rápida'
                                  : 'Avulsa'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-900 max-w-xs truncate">
                            {prodName}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            {item.payment_method_nome ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-slate-50 text-slate-700 border-slate-200"
                              >
                                {item.payment_method_nome}
                              </Badge>
                            ) : (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            {item.custo_moeda === 'USD' ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-200"
                              >
                                US$ {item.cost_usd ? item.cost_usd.toFixed(2) : '—'}
                              </Badge>
                            ) : (
                              <span className="text-[11px] font-mono text-slate-500">R$</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700 tabular-nums whitespace-nowrap">
                            {formatCurrencyBRL(item.cost ?? 0)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600 tabular-nums whitespace-nowrap">
                            {item.frete ? formatCurrencyBRL(item.frete) : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-600 tabular-nums whitespace-nowrap">
                            {item.despesa_fixa_pct ? `${item.despesa_fixa_pct}%` : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-600 tabular-nums whitespace-nowrap">
                            {item.custos_variaveis_pct
                              ? `${item.custos_variaveis_pct}%`
                              : `${item.despesas_pct ?? 0}%`}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-indigo-700 tabular-nums whitespace-nowrap">
                            {item.margem_pct ?? 0}%
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 tabular-nums whitespace-nowrap">
                            {formatCurrencyBRL(item.sale_price)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 tabular-nums whitespace-nowrap">
                            {formatCurrencyBRL(item.lucro_unitario ?? 0)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px] truncate max-w-[100px]">
                            {userName}
                          </td>
                        </tr>
                      )
                    })}

                    {historyList.length === 0 && (
                      <tr>
                        <td colSpan={13} className="py-12 text-center text-slate-400">
                          {loadingHistory
                            ? 'Carregando histórico...'
                            : 'Nenhum histórico de precificação registrado ainda.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ==================================================================== */}
      {/* MODAL DE BUSCA DE PRODUTO                                            */}
      {/* ==================================================================== */}
      <Dialog open={searchProductModalOpen} onOpenChange={setSearchProductModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-4 sm:p-6">
          <DialogHeader className="pb-2">
            <div className="flex items-center gap-2 text-indigo-600">
              <Package className="h-5 w-5" />
              <DialogTitle className="text-base sm:text-lg font-bold text-slate-900">
                Buscar Produto para Precificar
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500">
              Selecione o item do catálogo para puxar o custo atual e recalcular o preço sugerido.
            </DialogDescription>
          </DialogHeader>

          <div className="relative my-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Digite o nome, código (SKU) ou código de barras..."
              value={searchProductQuery}
              onChange={(e) => handleSearchProducts(e.target.value)}
              className="pl-9 h-10 text-xs sm:text-sm bg-slate-50 border-slate-200"
              autoFocus
            />
          </div>

          <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg max-h-[50vh]">
            {searchingProducts ? (
              <div className="py-12 text-center text-slate-400 text-xs">Buscando produtos...</div>
            ) : productSearchResults.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Nenhum produto encontrado.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {productSearchResults.map((prod) => (
                  <div
                    key={prod.id}
                    onClick={() => {
                      if (activeTab === 'rapida') {
                        setLinkedProduct3(prod)
                        setCostInput3(prod.cost != null ? String(prod.cost) : '0')
                        setSearchProductModalOpen(false)
                        toast({ title: 'Produto vinculado com sucesso!' })
                      } else {
                        handleSelectProduct1(prod)
                      }
                    }}
                    className="p-3 hover:bg-indigo-50/50 cursor-pointer flex items-center justify-between transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">{prod.name}</span>
                        {prod.sku && (
                          <span className="text-[10px] font-mono font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                            {prod.sku}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-3">
                        <span>
                          Custo:{' '}
                          <strong className="font-mono text-slate-700">
                            {formatCurrencyBRL(prod.cost || 0)}
                          </strong>
                        </span>
                        <span>
                          Preço Atual:{' '}
                          <strong className="font-mono text-indigo-700">
                            {formatCurrencyBRL(prod.price || 0)}
                          </strong>
                        </span>
                        <span>
                          Estoque:{' '}
                          <strong className="font-mono">{prod.stock_quantity ?? 0} un</strong>
                        </span>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs font-semibold text-indigo-600"
                    >
                      <span>Selecionar</span>
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchProductModalOpen(false)}
              className="text-xs"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================================================================== */}
      {/* MODAL DE CONFIRMAÇÃO: APLICAR PREÇO AO PRODUTO                      */}
      {/* ==================================================================== */}
      <Dialog open={confirmApplyModalOpen} onOpenChange={setConfirmApplyModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Confirmar Atualização de Preço
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Esta ação atualizará o preço de venda no cadastro do produto e registrará a operação
              no histórico.
            </DialogDescription>
          </DialogHeader>

          {selectedProduct && calcResult1 && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <span className="text-slate-500 block">Produto:</span>
                <span className="font-bold text-slate-900 text-sm">{selectedProduct.name}</span>
                {selectedProduct.sku && (
                  <span className="text-[11px] text-slate-500 font-mono block">
                    SKU: {selectedProduct.sku}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-3 bg-slate-100 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Preço Antigo
                  </span>
                  <span className="font-mono text-base font-bold text-slate-700 line-through tabular-nums">
                    {formatCurrencyBRL(selectedProduct.price || 0)}
                  </span>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block">
                    Novo Preço
                  </span>
                  <span className="font-mono text-base font-bold text-emerald-700 tabular-nums">
                    {formatCurrencyBRL(calcResult1.salePrice)}
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-[11px] text-slate-600">
                <div className="flex justify-between">
                  <span>Custo Direto Total:</span>
                  <strong className="font-mono">
                    {formatCurrencyBRL(calcResult1.custoDiretoTotal)}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Markup Multiplicador:</span>
                  <strong className="font-mono text-indigo-700">
                    {calcResult1.markupMultiplicador}×
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Lucro Líquido Unitário:</span>
                  <strong className="font-mono text-emerald-700">
                    {formatCurrencyBRL(calcResult1.lucroUnitario)} ({calcResult1.fatias.lucro.pct}%)
                  </strong>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmApplyModalOpen(false)}
              disabled={applyingPrice}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() =>
                selectedProduct &&
                calcResult1 &&
                handleApplyPriceToProduct(
                  selectedProduct,
                  calcResult1,
                  'produto',
                  selectedMethod1?.nome,
                )
              }
              disabled={applyingPrice}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{applyingPrice ? 'Atualizando...' : 'Confirmar e Aplicar'}</span>
            </Button>{' '}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================================================================== */}
      {/* MODAL DE CRIAÇÃO RÁPIDA DE NOVO PRODUTO (MODO 3)                     */}
      {/* ==================================================================== */}
      <Dialog open={newProductModalOpen} onOpenChange={setNewProductModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Criar Novo Produto e Vincular
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Preencha os dados básicos para salvar no estoque já com o preço sugerido calculado.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateNewProductQuick} className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Nome do Produto *</Label>
              <Input
                placeholder="Ex: SSD Kingston 480GB"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                className="h-9 text-xs"
                required
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Categoria</Label>
                <Input
                  placeholder="Ex: Peças"
                  value={newProductCategory}
                  onChange={(e) => setNewProductCategory(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Código / SKU</Label>
                <Input
                  placeholder="Ex: SSD-480"
                  value={newProductSku}
                  onChange={(e) => setNewProductSku(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Custo (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newProductCost}
                  onChange={(e) => setNewProductCost(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Preço de Venda (R$)</Label>
                <Input
                  type="text"
                  value={calcResult3 ? formatCurrencyBRL(calcResult3.salePrice) : 'R$ 0,00'}
                  disabled
                  className="h-9 text-xs font-mono font-bold bg-emerald-50 text-emerald-800 border-emerald-200"
                />
              </div>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setNewProductModalOpen(false)}
                disabled={savingNewProduct}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={savingNewProduct}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{savingNewProduct ? 'Cadastrando...' : 'Cadastrar e Vincular'}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
