import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
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
  Percent,
  DollarSign,
  AlertCircle,
  HelpCircle,
  Layers,
  Sparkles,
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
import { Product, PricingHistory, PricingMode } from '@/types'
import { getProducts, getProduct, updateProduct, createProduct } from '@/services/products'
import {
  getDefaultExpensesPct,
  updateDefaultExpensesPct,
  getDefaultMinMarginPct,
  updateDefaultMinMarginPct,
  createPricingHistory,
  getPricingHistory,
  calculateFromMargem,
  calculateFromMarkup,
  calculateFromPrice,
  PricingCalculationResult,
} from '@/services/pricing'
import { formatCurrencyBRL } from '@/lib/dashboard-utils'

export default function Precificacao() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialProductId = searchParams.get('productId') || ''
  const initialMode = (searchParams.get('tab') as string) || 'produto'

  const [activeTab, setActiveTab] = useState<string>(
    ['produto', 'avulsa', 'rapida', 'historico'].includes(initialMode) ? initialMode : 'produto',
  )

  const { toast } = useToast()

  // Configurações globais de precificação
  const [defaultExpenses, setDefaultExpenses] = useState<number>(12)
  const [minMargin, setMinMargin] = useState<number>(20)
  const [configModalOpen, setConfigModalOpen] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [editExpensesInput, setEditExpensesInput] = useState('12')
  const [editMinMarginInput, setEditMinMarginInput] = useState('20')

  // Histórico
  const [historyList, setHistoryList] = useState<PricingHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // -------------------------------------------------------------
  // MODO 1: PRODUTO CADASTRADO
  // -------------------------------------------------------------
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [searchProductQuery, setSearchProductQuery] = useState('')
  const [productSearchResults, setProductSearchResults] = useState<Product[]>([])
  const [searchingProducts, setSearchingProducts] = useState(false)
  const [searchProductModalOpen, setSearchProductModalOpen] = useState(false)

  // Campos Modo 1
  const [costInput1, setCostInput1] = useState('')
  const [expensesInput1, setExpensesInput1] = useState('')
  const [marginInput1, setMarginInput1] = useState('30')
  const [markupInput1, setMarkupInput1] = useState('51.72')
  const [lastEditedField1, setLastEditedField1] = useState<'margem' | 'markup'>('margem')
  const [calcResult1, setCalcResult1] = useState<PricingCalculationResult | null>(null)
  const [confirmApplyModalOpen, setConfirmApplyModalOpen] = useState(false)
  const [applyingPrice, setApplyingPrice] = useState(false)

  // -------------------------------------------------------------
  // MODO 2: PRECIFICAÇÃO AVULSA (Calculadora Livre)
  // -------------------------------------------------------------
  const [costInput2, setCostInput2] = useState('100')
  const [expensesInput2, setExpensesInput2] = useState('')
  const [marginInput2, setMarginInput2] = useState('30')
  const [markupInput2, setMarkupInput2] = useState('')
  const [lastEditedField2, setLastEditedField2] = useState<'margem' | 'markup'>('margem')
  const [calcResult2, setCalcResult2] = useState<PricingCalculationResult | null>(null)

  // -------------------------------------------------------------
  // MODO 3: PRECIFICAÇÃO RÁPIDA
  // -------------------------------------------------------------
  const [costInput3, setCostInput3] = useState('80')
  const [expensesInput3, setExpensesInput3] = useState('')
  const [marginInput3, setMarginInput3] = useState('35')
  const [markupInput3, setMarkupInput3] = useState('')
  const [lastEditedField3, setLastEditedField3] = useState<'margem' | 'markup'>('margem')
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
    async function initSettings() {
      try {
        const [exp, minM] = await Promise.all([getDefaultExpensesPct(), getDefaultMinMarginPct()])
        setDefaultExpenses(exp)
        setMinMargin(minM)
        setExpensesInput1(String(exp))
        setExpensesInput2(String(exp))
        setExpensesInput3(String(exp))
        setEditExpensesInput(String(exp))
        setEditMinMarginInput(String(minM))
      } catch {
        /* fallback */
      }
    }
    initSettings()
    loadHistory()
  }, [])

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
  // RECALCULO MODO 1
  // -------------------------------------------------------------
  useEffect(() => {
    const cost = parseFloat(costInput1.replace(',', '.')) || 0
    const expenses = parseFloat(expensesInput1.replace(',', '.')) || 0

    if (lastEditedField1 === 'margem') {
      const margem = parseFloat(marginInput1.replace(',', '.')) || 0
      const res = calculateFromMargem(cost, expenses, margem)
      setCalcResult1(res)
      if (res.isPossible) {
        setMarkupInput1(String(res.markupPct))
      }
    } else {
      const markup = parseFloat(markupInput1.replace(',', '.')) || 0
      const res = calculateFromMarkup(cost, expenses, markup)
      setCalcResult1(res)
      if (res.isPossible) {
        setMarginInput1(String(res.margemPct))
      }
    }
  }, [costInput1, expensesInput1, marginInput1, markupInput1, lastEditedField1])

  // -------------------------------------------------------------
  // RECALCULO MODO 2 (Avulsa)
  // -------------------------------------------------------------
  useEffect(() => {
    const cost = parseFloat(costInput2.replace(',', '.')) || 0
    const expenses = parseFloat(expensesInput2.replace(',', '.')) || 0

    if (lastEditedField2 === 'margem') {
      const margem = parseFloat(marginInput2.replace(',', '.')) || 0
      const res = calculateFromMargem(cost, expenses, margem)
      setCalcResult2(res)
      if (res.isPossible) {
        setMarkupInput2(String(res.markupPct))
      }
    } else {
      const markup = parseFloat(markupInput2.replace(',', '.')) || 0
      const res = calculateFromMarkup(cost, expenses, markup)
      setCalcResult2(res)
      if (res.isPossible) {
        setMarginInput2(String(res.margemPct))
      }
    }
  }, [costInput2, expensesInput2, marginInput2, markupInput2, lastEditedField2])

  // -------------------------------------------------------------
  // RECALCULO MODO 3 (Rápida)
  // -------------------------------------------------------------
  useEffect(() => {
    const cost = parseFloat(costInput3.replace(',', '.')) || 0
    const expenses = parseFloat(expensesInput3.replace(',', '.')) || 0

    if (lastEditedField3 === 'margem') {
      const margem = parseFloat(marginInput3.replace(',', '.')) || 0
      const res = calculateFromMargem(cost, expenses, margem)
      setCalcResult3(res)
      if (res.isPossible) {
        setMarkupInput3(String(res.markupPct))
      }
    } else {
      const markup = parseFloat(markupInput3.replace(',', '.')) || 0
      const res = calculateFromMarkup(cost, expenses, markup)
      setCalcResult3(res)
      if (res.isPossible) {
        setMarginInput3(String(res.margemPct))
      }
    }
  }, [costInput3, expensesInput3, marginInput3, markupInput3, lastEditedField3])

  // -------------------------------------------------------------
  // SELEÇÃO DE PRODUTO NO MODO 1
  // -------------------------------------------------------------
  const handleSelectProduct1 = (prod: Product) => {
    setSelectedProduct(prod)
    setCostInput1(prod.cost != null ? String(prod.cost) : '0')
    setExpensesInput1(String(defaultExpenses))

    // Se o produto já possui preço e custo, calcula a margem atual como inicial
    if (prod.price && prod.cost && prod.price > 0) {
      const cur = calculateFromPrice(prod.cost, defaultExpenses, prod.price)
      if (cur.margemPct > 0) {
        setMarginInput1(String(cur.margemPct))
        setMarkupInput1(String(cur.markupPct))
        setLastEditedField1('margem')
      } else {
        setMarginInput1('30')
        setLastEditedField1('margem')
      }
    } else {
      setMarginInput1('30')
      setLastEditedField1('margem')
    }

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

  // Aplicar preço ao produto (Modo 1 ou Modo 3)
  const handleApplyPriceToProduct = async (
    prod: Product,
    res: PricingCalculationResult,
    mode: PricingMode,
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
      // 1. Atualizar produto (preço e se custo tiver sido alterado na tela)
      await updateProduct(prod.id, {
        price: res.salePrice,
        cost: res.cost,
      })

      // 2. Registrar no histórico
      await createPricingHistory({
        product: prod.id,
        cost: res.cost,
        despesas_pct: res.despesasPct,
        markup_pct: res.markupPct,
        margem_pct: res.margemPct,
        sale_price: res.salePrice,
        lucro_unitario: res.lucroUnitario,
        mode,
      })

      // Atualiza estado local
      setSelectedProduct((prev) =>
        prev ? { ...prev, price: res.salePrice, cost: res.cost } : null,
      )
      if (linkedProduct3 && linkedProduct3.id === prod.id) {
        setLinkedProduct3((prev) =>
          prev ? { ...prev, price: res.salePrice, cost: res.cost } : null,
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
      `Custo Unitário: ${formatCurrencyBRL(res.cost)}\n` +
      `Despesas Variáveis: ${res.despesasPct}%\n` +
      `Margem de Lucro: ${res.margemPct}%\n` +
      `Markup: ${res.markupPct}%\n` +
      `-------------------------\n` +
      `Preço Final Sugerido: ${formatCurrencyBRL(res.salePrice)}\n` +
      `Lucro Líquido Unitário: ${formatCurrencyBRL(res.lucroUnitario)}`

    navigator.clipboard.writeText(text)
    toast({
      title: 'Resultado copiado!',
      description: 'Valores formatados e copiados para sua área de transferência.',
    })
  }

  // Salvar configurações
  const handleSaveConfig = async () => {
    const exp = parseFloat(editExpensesInput.replace(',', '.'))
    const minM = parseFloat(editMinMarginInput.replace(',', '.'))
    if (isNaN(exp) || exp < 0 || exp >= 100) {
      toast({ title: 'Despesas variáveis inválidas (0 a 99%)', variant: 'destructive' })
      return
    }
    if (isNaN(minM) || minM < 0 || minM >= 100) {
      toast({ title: 'Margem mínima inválida (0 a 99%)', variant: 'destructive' })
      return
    }

    setSavingConfig(true)
    try {
      await updateDefaultExpensesPct(exp)
      await updateDefaultMinMarginPct(minM)
      setDefaultExpenses(exp)
      setMinMargin(minM)
      toast({
        title: 'Configurações salvas!',
        description: 'Padrões de precificação atualizados com sucesso.',
      })
      setConfigModalOpen(false)
    } catch {
      toast({ title: 'Erro ao salvar configurações', variant: 'destructive' })
    } finally {
      setSavingConfig(false)
    }
  }

  // Criar novo produto no Modo 3 (Mini formulário)
  const handleCreateNewProductQuick = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProductName.trim()) {
      toast({ title: 'Nome do produto é obrigatório', variant: 'destructive' })
      return
    }
    const costVal = parseFloat(newProductCost.replace(',', '.')) || (calcResult3?.cost ?? 0)
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
          cost: calcResult3.cost,
          despesas_pct: calcResult3.despesasPct,
          markup_pct: calcResult3.markupPct,
          margem_pct: calcResult3.margemPct,
          sale_price: calcResult3.salePrice,
          lucro_unitario: calcResult3.lucroUnitario,
          mode: 'rapida',
        })
      }

      setLinkedProduct3(created)
      setNewProductModalOpen(false)
      toast({
        title: 'Produto criado e vinculado!',
        description: `"${created.name}" cadastrado com sucesso com o preço sugerido.`,
      })
      loadHistory()
    } catch (err) {
      toast({ title: 'Erro ao criar produto', variant: 'destructive' })
    } finally {
      setSavingNewProduct(false)
    }
  }

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
                  v0.0.187
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                Formação de preço de venda com base em custo, despesas variáveis e margem líquida /
                markup.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfigModalOpen(true)}
            className="h-9 text-xs gap-1.5 border-slate-200 hover:bg-slate-50 font-medium"
          >
            <Settings className="h-3.5 w-3.5 text-slate-500" />
            <span>Configurações ({defaultExpenses}% desp.)</span>
          </Button>
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
            {/* Coluna Esquerda: Seleção do Produto e Parâmetros */}
            <div className="lg:col-span-7 space-y-4">
              <Card className="border-slate-200 shadow-2xs">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold text-slate-900">
                        1. Selecionar Produto do Estoque
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        Busque pelo nome, código SKU ou código de barras cadastrado
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
                          <span className="text-[11px] text-slate-500 block">Custo Atual:</span>
                          <span className="font-mono font-bold text-slate-800">
                            {formatCurrencyBRL(selectedProduct.cost || 0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-500 block">Estoque Físico:</span>
                          <span className="font-mono font-bold text-slate-800">
                            {selectedProduct.stock_quantity ?? 0} unidades
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
                      className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/20 transition-colors"
                    >
                      <Package className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                      <p className="text-xs font-bold text-slate-700">Nenhum produto selecionado</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Clique aqui para buscar uma peça ou produto do seu catálogo
                      </p>
                    </div>
                  )}

                  {/* Parâmetros de Formação de Preço */}
                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      2. Parâmetros de Cálculo
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                          <span>Custo da Mercadoria (R$) *</span>
                          <span className="text-[10px] text-slate-400">Preço de compra</span>
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
                        <Label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                          <span>Despesas Variáveis (%)</span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-3 w-3 text-slate-400 cursor-pointer" />
                              </TooltipTrigger>
                              <TooltipContent className="text-xs max-w-xs">
                                Soma estimada de impostos (ex: Simples), taxas de cartão de crédito
                                e fretes incidentes na venda.
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </Label>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="12.0"
                          value={expensesInput1}
                          onChange={(e) => setExpensesInput1(e.target.value)}
                          className="h-9 font-mono text-xs"
                        />
                      </div>
                    </div>

                    {/* Bloco Unificado: Margem % vs Markup % */}
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold text-slate-800">
                          Margem de Lucro desejada OU Markup multiplicador
                        </Label>
                        <span className="text-[11px] text-slate-500">
                          Digitar um recalcula o outro automaticamente
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-slate-600 font-semibold">
                            <span>Margem Líquida (%)</span>
                            <span className="text-[10px] text-indigo-600 font-mono font-bold">
                              Lucro ÷ Preço
                            </span>
                          </div>
                          <Input
                            type="number"
                            step="0.1"
                            value={marginInput1}
                            onChange={(e) => {
                              setMarginInput1(e.target.value)
                              setLastEditedField1('margem')
                            }}
                            className={`h-9 font-mono text-xs font-bold ${
                              lastEditedField1 === 'margem'
                                ? 'border-indigo-500 bg-white ring-1 ring-indigo-500'
                                : 'bg-slate-100'
                            }`}
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-slate-600 font-semibold">
                            <span>Markup Multiplicador (%)</span>
                            <span className="text-[10px] text-slate-500 font-mono font-bold">
                              Lucro ÷ Custo
                            </span>
                          </div>
                          <Input
                            type="number"
                            step="0.1"
                            value={markupInput1}
                            onChange={(e) => {
                              setMarkupInput1(e.target.value)
                              setLastEditedField1('markup')
                            }}
                            className={`h-9 font-mono text-xs font-bold ${
                              lastEditedField1 === 'markup'
                                ? 'border-indigo-500 bg-white ring-1 ring-indigo-500'
                                : 'bg-slate-100'
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Coluna Direita: Resultado, Análise Comparativa e Ação de Aplicar */}
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
                        Margem: {calcResult1.margemPct}%
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-4">
                  {calcResult1?.isPossible ? (
                    <>
                      {/* Valor Grande Destaque */}
                      <div className="text-center py-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
                          Preço Sugerido para o Produto
                        </span>
                        <div className="text-3xl font-extrabold text-emerald-700 font-mono tabular-nums">
                          {formatCurrencyBRL(calcResult1.salePrice)}
                        </div>
                        <p className="text-[11px] text-emerald-800 font-medium mt-1">
                          Lucro unitário:{' '}
                          <strong className="font-mono">
                            {formatCurrencyBRL(calcResult1.lucroUnitario)}
                          </strong>{' '}
                          ({calcResult1.margemPct}% líquido)
                        </p>
                      </div>

                      {/* Decomposição do Preço */}
                      <div className="space-y-2 text-xs border border-slate-100 rounded-lg p-3 bg-slate-50/50">
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-600">Custo da Mercadoria:</span>
                          <span className="font-mono font-bold text-slate-800 tabular-nums">
                            {formatCurrencyBRL(calcResult1.cost)}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-600">
                            Despesas Variáveis ({calcResult1.despesasPct}%):
                          </span>
                          <span className="font-mono font-bold text-slate-800 tabular-nums">
                            {formatCurrencyBRL(
                              calcResult1.salePrice * (calcResult1.despesasPct / 100),
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-600 font-medium">
                            Lucro Líquido Unitário:
                          </span>
                          <span className="font-mono font-bold text-emerald-700 tabular-nums">
                            {formatCurrencyBRL(calcResult1.lucroUnitario)}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 font-bold text-slate-900">
                          <span>Markup Efetivo:</span>
                          <span className="font-mono text-indigo-700 tabular-nums">
                            {calcResult1.markupPct}%
                          </span>
                        </div>
                      </div>

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

                      {/* Alertas e Comparativo com Preço Atual */}
                      {selectedProduct && selectedProduct.price != null && (
                        <div className="space-y-2">
                          {selectedProduct.price < calcResult1.cost ? (
                            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                              <div>
                                <strong className="font-bold block">
                                  Preço Atual Abaixo do Custo!
                                </strong>
                                O preço atual cadastrado ({formatCurrencyBRL(selectedProduct.price)}
                                ) gera prejuízo direto de{' '}
                                {formatCurrencyBRL(calcResult1.cost - selectedProduct.price)} por
                                unidade vendida.
                              </div>
                            </div>
                          ) : calcResult1.margemPct < minMargin ? (
                            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                              <div>
                                <strong className="font-bold block">
                                  Margem Abaixo da Mínima Recomendada ({minMargin}%)
                                </strong>
                                A margem calculada ({calcResult1.margemPct}%) pode não cobrir
                                variações de custos fixos e operacionais.
                              </div>
                            </div>
                          ) : null}

                          <div className="text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                            <span className="text-slate-600">Variação Preço Atual → Sugerido:</span>
                            <span
                              className={`font-mono font-bold ${
                                calcResult1.salePrice >= (selectedProduct.price || 0)
                                  ? 'text-emerald-700'
                                  : 'text-amber-700'
                              }`}
                            >
                              {formatCurrencyBRL(selectedProduct.price || 0)} →{' '}
                              {formatCurrencyBRL(calcResult1.salePrice)}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Ações */}
                      <div className="space-y-2 pt-2">
                        {selectedProduct ? (
                          <Button
                            type="button"
                            onClick={() => setConfirmApplyModalOpen(true)}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 gap-1.5 shadow-xs"
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
            </div>
          </div>
        </TabsContent>

        {/* ==================================================================== */}
        {/* ABA 2: PRECIFICAÇÃO AVULSA (FORA DO PRODUTO)                         */}
        {/* ==================================================================== */}
        <TabsContent value="avulsa" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-4">
              <Card className="border-slate-200 shadow-2xs">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-indigo-600">
                    <Calculator className="h-5 w-5" />
                    <div>
                      <CardTitle className="text-sm font-bold text-slate-900">
                        Calculadora Livre de Precificação
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        Calcule preços de venda rápidos e margens sem alterar nenhum cadastro ou
                        produto
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-700">
                        Custo Base (R$) *
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
                        Despesas Variáveis (%)
                      </Label>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="12.0"
                        value={expensesInput2}
                        onChange={(e) => setExpensesInput2(e.target.value)}
                        className="h-9 font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-slate-800">
                        Margem de Lucro desejada OU Markup
                      </Label>
                      <span className="text-[11px] text-slate-500">
                        Recálculo bidirecional automático
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-slate-600 font-semibold">
                          Margem Líquida (%)
                        </Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={marginInput2}
                          onChange={(e) => {
                            setMarginInput2(e.target.value)
                            setLastEditedField2('margem')
                          }}
                          className={`h-9 font-mono text-xs font-bold ${
                            lastEditedField2 === 'margem'
                              ? 'border-indigo-500 bg-white ring-1 ring-indigo-500'
                              : 'bg-slate-100'
                          }`}
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] text-slate-600 font-semibold">
                          Markup (%)
                        </Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={markupInput2}
                          onChange={(e) => {
                            setMarkupInput2(e.target.value)
                            setLastEditedField2('markup')
                          }}
                          className={`h-9 font-mono text-xs font-bold ${
                            lastEditedField2 === 'markup'
                              ? 'border-indigo-500 bg-white ring-1 ring-indigo-500'
                              : 'bg-slate-100'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

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
                        Margem: {calcResult2.margemPct}%
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

                      <div className="space-y-2 text-xs border border-slate-100 rounded-lg p-3 bg-slate-50/50">
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-600">Custo Informado:</span>
                          <span className="font-mono font-bold text-slate-800 tabular-nums">
                            {formatCurrencyBRL(calcResult2.cost)}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-600">
                            Despesas ({calcResult2.despesasPct}%):
                          </span>
                          <span className="font-mono font-bold text-slate-800 tabular-nums">
                            {formatCurrencyBRL(
                              calcResult2.salePrice * (calcResult2.despesasPct / 100),
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-600">Lucro Líquido:</span>
                          <span className="font-mono font-bold text-emerald-700 tabular-nums">
                            {formatCurrencyBRL(calcResult2.lucroUnitario)}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 font-bold text-slate-900">
                          <span>Markup Multiplicador:</span>
                          <span className="font-mono text-indigo-700 tabular-nums">
                            {calcResult2.markupPct}%
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 space-y-2">
                        <Button
                          type="button"
                          onClick={() => handleCopySummary(calcResult2, 'Precificação Avulsa')}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 gap-1.5 shadow-xs"
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
                                cost: calcResult2.cost,
                                despesas_pct: calcResult2.despesasPct,
                                markup_pct: calcResult2.markupPct,
                                margem_pct: calcResult2.margemPct,
                                sale_price: calcResult2.salePrice,
                                lucro_unitario: calcResult2.lucroUnitario,
                                mode: 'avulsa',
                              })
                              toast({ title: 'Cálculo salvo no histórico!' })
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
            </div>
          </div>
        </TabsContent>

        {/* ==================================================================== */}
        {/* ABA 3: PRECIFICAÇÃO RÁPIDA (Com Vínculo ou Criação Rápida)           */}
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
                        Calcule primeiro e vincule a um produto existente ou crie um novo na hora
                      </CardDescription>
                    </div>

                    {linkedProduct3 && (
                      <Badge className="bg-indigo-600 text-white text-[11px] font-bold">
                        Vinculado: {linkedProduct3.name}
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-700">
                        Custo Estimado (R$) *
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
                      <Label className="text-xs font-semibold text-slate-700">Despesas (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={expensesInput3}
                        onChange={(e) => setExpensesInput3(e.target.value)}
                        className="h-9 font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-slate-600 font-semibold">
                          Margem Líquida (%)
                        </Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={marginInput3}
                          onChange={(e) => {
                            setMarginInput3(e.target.value)
                            setLastEditedField3('margem')
                          }}
                          className={`h-9 font-mono text-xs font-bold ${
                            lastEditedField3 === 'margem'
                              ? 'border-indigo-500 bg-white ring-1 ring-indigo-500'
                              : 'bg-slate-100'
                          }`}
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] text-slate-600 font-semibold">
                          Markup (%)
                        </Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={markupInput3}
                          onChange={(e) => {
                            setMarkupInput3(e.target.value)
                            setLastEditedField3('markup')
                          }}
                          className={`h-9 font-mono text-xs font-bold ${
                            lastEditedField3 === 'markup'
                              ? 'border-indigo-500 bg-white ring-1 ring-indigo-500'
                              : 'bg-slate-100'
                          }`}
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
                          setNewProductCost(costInput3)
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
                        Margem: {calcResult3.margemPct}%
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
                          Lucro por unidade:{' '}
                          <strong className="font-mono">
                            {formatCurrencyBRL(calcResult3.lucroUnitario)}
                          </strong>
                        </p>
                      </div>

                      <div className="space-y-2 text-xs border border-slate-100 rounded-lg p-3 bg-slate-50/50">
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-600">Custo:</span>
                          <span className="font-mono font-bold text-slate-800 tabular-nums">
                            {formatCurrencyBRL(calcResult3.cost)}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-600">
                            Despesas ({calcResult3.despesasPct}%):
                          </span>
                          <span className="font-mono font-bold text-slate-800 tabular-nums">
                            {formatCurrencyBRL(
                              calcResult3.salePrice * (calcResult3.despesasPct / 100),
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-600 font-medium">Lucro Líquido:</span>
                          <span className="font-mono font-bold text-emerald-700 tabular-nums">
                            {formatCurrencyBRL(calcResult3.lucroUnitario)}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 font-bold text-slate-900">
                          <span>Markup:</span>
                          <span className="font-mono text-indigo-700 tabular-nums">
                            {calcResult3.markupPct}%
                          </span>
                        </div>
                      </div>

                      {linkedProduct3 && (
                        <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200 space-y-2">
                          <div className="text-xs">
                            <span className="text-slate-600 block">Produto Vinculado:</span>
                            <span className="font-bold text-indigo-950">{linkedProduct3.name}</span>
                          </div>
                          <Button
                            type="button"
                            onClick={() =>
                              handleApplyPriceToProduct(linkedProduct3, calcResult3, 'rapida')
                            }
                            disabled={applyingPrice}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9"
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
                    </>
                  ) : (
                    <div className="text-center py-8 text-rose-600 text-xs">
                      <p className="font-bold">Cálculo impossível</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ==================================================================== */}
        {/* ABA 4: HISTÓRICO DE PRECIFICAÇÕES                                    */}
        {/* ==================================================================== */}
        <TabsContent value="historico" className="space-y-4">
          <Card className="border-slate-200 shadow-2xs">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-slate-900">
                  Histórico Recente de Precificações
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Registro de preços sugeridos, aplicados e calculados no sistema
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
                      <th className="py-2.5 px-3 text-right">Custo</th>
                      <th className="py-2.5 px-3 text-center">Desp. %</th>
                      <th className="py-2.5 px-3 text-center">Margem %</th>
                      <th className="py-2.5 px-3 text-center">Markup %</th>
                      <th className="py-2.5 px-3 text-right">Preço Venda</th>
                      <th className="py-2.5 px-3 text-right">Lucro Unit.</th>
                      <th className="py-2.5 px-3">Registrado por</th>
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
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700 tabular-nums whitespace-nowrap">
                            {formatCurrencyBRL(item.cost ?? 0)}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-600 tabular-nums whitespace-nowrap">
                            {item.despesas_pct ?? 0}%
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-indigo-700 tabular-nums whitespace-nowrap">
                            {item.margem_pct ?? 0}%
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-600 tabular-nums whitespace-nowrap">
                            {item.markup_pct ?? 0}%
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 tabular-nums whitespace-nowrap">
                            {formatCurrencyBRL(item.sale_price)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 tabular-nums whitespace-nowrap">
                            {formatCurrencyBRL(item.lucro_unitario ?? 0)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px] truncate max-w-[120px]">
                            {userName}
                          </td>
                        </tr>
                      )
                    })}

                    {historyList.length === 0 && (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-slate-400">
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
                  <span>Custo Atualizado:</span>
                  <strong className="font-mono">{formatCurrencyBRL(calcResult1.cost)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Margem Líquida Resultante:</span>
                  <strong className="font-mono text-indigo-700">{calcResult1.margemPct}%</strong>
                </div>
                <div className="flex justify-between">
                  <span>Lucro por unidade:</span>
                  <strong className="font-mono text-emerald-700">
                    {formatCurrencyBRL(calcResult1.lucroUnitario)}
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
                handleApplyPriceToProduct(selectedProduct, calcResult1, 'produto')
              }
              disabled={applyingPrice}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{applyingPrice ? 'Atualizando...' : 'Confirmar e Aplicar'}</span>
            </Button>
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

      {/* ==================================================================== */}
      {/* MODAL DE CONFIGURAÇÕES GLOBAIS DE PRECIFICAÇÃO                      */}
      {/* ==================================================================== */}
      <Dialog open={configModalOpen} onOpenChange={setConfigModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Settings className="h-4 w-4 text-slate-600" />
              <span>Configurações Padrão de Precificação</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Valores padrão salvos no sistema para novas precificações e alertas de margem mínima.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">
                Despesas Variáveis Padrão (%)
              </Label>
              <Input
                type="number"
                step="0.1"
                value={editExpensesInput}
                onChange={(e) => setEditExpensesInput(e.target.value)}
                className="h-9 text-xs font-mono"
              />
              <p className="text-[11px] text-slate-500">
                Alíquota estimada de impostos (ex: Simples Nacional) + taxas de maquininha de cartão
                + comissões/embalagem.
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">
                Margem Líquida Mínima Alvo (%)
              </Label>
              <Input
                type="number"
                step="0.1"
                value={editMinMarginInput}
                onChange={(e) => setEditMinMarginInput(e.target.value)}
                className="h-9 text-xs font-mono"
              />
              <p className="text-[11px] text-slate-500">
                Dispara aviso em destaque quando o produto estiver com margem menor que a mínima
                desejada.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfigModalOpen(false)}
              disabled={savingConfig}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSaveConfig}
              disabled={savingConfig}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
            >
              <span>{savingConfig ? 'Salvando...' : 'Salvar Padrões'}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
