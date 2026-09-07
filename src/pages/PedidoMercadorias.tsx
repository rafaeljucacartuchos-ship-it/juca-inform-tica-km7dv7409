import { useState, useEffect, useMemo, useRef } from 'react'
import {
  ShoppingCart,
  Search,
  ScanLine,
  Building2,
  AlertTriangle,
  RefreshCw,
  Printer,
  Download,
  CheckCircle2,
  TrendingUp,
  Package,
  Layers,
  FileSpreadsheet,
  ArrowUpDown,
  Filter,
  Check,
  ChevronRight,
  SlidersHorizontal,
  Volume2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Product } from '@/types'
import { getProducts } from '@/services/products'
import {
  calculateReplenishmentData,
  groupByManufacturer,
  ProductReplenishmentSuggestion,
  ManufacturerOrderGroup,
  getLast3MonthsLabels,
} from '@/services/replenishment'
import { BarcodeScanner } from '@/components/BarcodeScanner'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { playLowStockAlertSound } from '@/lib/notification-sound'
import { exportToExcel } from '@/lib/export-utils'

export default function PedidoMercadorias() {
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [suggestions, setSuggestions] = useState<ProductReplenishmentSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'reposicao' | 'fabricantes' | 'criticos' | 'todos'>(
    'reposicao',
  )
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('all')
  const [scannerOpen, setScannerOpen] = useState(false)

  // Modal de Detalhe / Relatório de Compra por Fabricante
  const [manufacturerModalOpen, setManufacturerModalOpen] = useState(false)
  const [activeManufacturerGroup, setActiveManufacturerGroup] =
    useState<ManufacturerOrderGroup | null>(null)

  const monthLabels = useMemo(() => getLast3MonthsLabels(), [])

  const loadData = async () => {
    try {
      setLoading(true)
      const prods = await getProducts('')
      setProducts(prods)
      const repData = await calculateReplenishmentData(prods)
      setSuggestions(repData)
    } catch {
      toast({
        title: 'Erro ao carregar dados de estoque',
        description: 'Não foi possível calcular o comparativo de vendas e reposição.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime('products', loadData)
  useRealtime('service_order_items', loadData)

  // Fabricantes únicos para o filtro
  const manufacturersList = useMemo(() => {
    const set = new Set<string>()
    suggestions.forEach((s) => {
      if (s.fabricante) set.add(s.fabricante)
    })
    return Array.from(set).sort()
  }, [suggestions])

  // Grupos por Fabricante
  const manufacturerGroups = useMemo(() => {
    return groupByManufacturer(suggestions, true)
  }, [suggestions])

  // Produtos que atendem ao filtro de busca e fabricante
  const filteredSuggestions = useMemo(() => {
    return suggestions.filter((s) => {
      // Filtro de fabricante
      if (selectedManufacturer !== 'all' && s.fabricante !== selectedManufacturer) {
        return false
      }

      // Filtro por aba
      if (activeTab === 'reposicao' && s.suggestedQty <= 0) {
        return false
      }
      if (activeTab === 'criticos' && !s.isZeroStock && !s.isCriticalLow) {
        return false
      }

      // Busca inteligente (nome, SKU, barcode, fabricante)
      if (search.trim()) {
        const q = search.toLowerCase().trim()
        const p = s.product
        const matchName = (p.name || '').toLowerCase().includes(q)
        const matchSku = (p.sku || '').toLowerCase().includes(q)
        const matchBarcode = (p.barcode || p.codigo_barras || '').toLowerCase().includes(q)
        const matchFab = (s.fabricante || '').toLowerCase().includes(q)
        return matchName || matchSku || matchBarcode || matchFab
      }

      return true
    })
  }, [suggestions, selectedManufacturer, activeTab, search])

  // Indicadores de topo
  const kpis = useMemo(() => {
    let totalItemsNeeded = 0
    let totalUnitsNeeded = 0
    let zeroStockCount = 0
    let criticalLowCount = 0
    let estimatedBudget = 0

    suggestions.forEach((s) => {
      if (s.isZeroStock) zeroStockCount++
      if (s.isCriticalLow) criticalLowCount++
      if (s.suggestedQty > 0) {
        totalItemsNeeded++
        totalUnitsNeeded += s.suggestedQty
        estimatedBudget += (s.product.cost || 0) * s.suggestedQty
      }
    })

    return {
      totalItemsNeeded,
      totalUnitsNeeded,
      zeroStockCount,
      criticalLowCount,
      estimatedBudget,
      totalFabricantes: manufacturerGroups.length,
    }
  }, [suggestions, manufacturerGroups])

  // Ação de escaneamento de código de barras
  const handleBarcodeDetected = (code: string) => {
    setSearch(code)
    toast({
      title: 'Código escaneado!',
      description: `Buscando pelo código: ${code}`,
    })
  }

  // Exportar pedido de compra completo para Excel
  const handleExportPurchaseOrder = () => {
    const validItems = filteredSuggestions.filter((s) => s.suggestedQty > 0)

    if (validItems.length === 0) {
      toast({
        title: 'Nenhum item para exportar',
        description: 'Não há itens com sugestão de compra neste filtro.',
      })
      return
    }

    const headers = [
      'Fabricante',
      'Código SKU',
      'Código de Barras',
      'Produto',
      'Estoque Atual',
      `Vendas ${monthLabels[0]}`,
      `Vendas ${monthLabels[1]}`,
      `Vendas ${monthLabels[2]}`,
      'Média Mensal',
      'Reposição Sugerida',
      'Custo Unitário',
      'Total Estimado',
    ]

    const rows = validItems.map((s) => [
      s.fabricante,
      s.product.sku || '',
      s.product.barcode || s.product.codigo_barras || '',
      s.product.name,
      s.currentStock,
      s.sales.month1,
      s.sales.month2,
      s.sales.month3,
      s.sales.averageMonthly,
      s.suggestedQty,
      s.product.cost ? `R$ ${s.product.cost.toFixed(2)}` : 'R$ 0,00',
      s.product.cost ? `R$ ${(s.product.cost * s.suggestedQty).toFixed(2)}` : 'R$ 0,00',
    ])

    exportToExcel('pedido_mercadorias_juca', [
      {
        title: 'Pedido de Mercadorias e Reposição - JUCA Informática',
        headers,
        rows,
      },
    ])
    toast({ title: 'Planilha exportada com sucesso!' })
  }

  // Visualizar / Imprimir relatório de um fabricante específico
  const handleOpenManufacturerReport = (group: ManufacturerOrderGroup) => {
    setActiveManufacturerGroup(group)
    setManufacturerModalOpen(true)
  }

  const handleTestLowStockSound = () => {
    playLowStockAlertSound()
    toast({
      title: 'Som de alerta reproduzido',
      description: 'Sinal sonoro de estoque baixo (Web Audio API).',
    })
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Top Banner do Módulo de Mercadorias e Estoque */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-4 sm:p-6 text-white shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-indigo-500/20 backdrop-blur-md flex items-center justify-center border border-indigo-400/30 text-2xl shadow-inner text-indigo-300">
              <ShoppingCart className="h-6 w-6 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                  Pedido de Mercadoria e Reposição
                </h1>
                <Badge className="bg-indigo-500 text-white font-bold text-[10px] uppercase tracking-wider">
                  Estoque Inteligente
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                Cálculo automático de compras por consumo trimestral (mês a mês) agrupado por
                fabricante.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestLowStockSound}
              className="h-9 text-xs gap-1.5 bg-white/10 border-white/20 text-white hover:bg-white/20"
              title="Testar alerta sonoro de estoque baixo"
            >
              <Volume2 className="h-3.5 w-3.5 text-amber-300" />
              <span className="hidden sm:inline">Testar Alerta Sonoro</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
              className="h-9 text-xs gap-1.5 bg-white/10 border-white/20 text-white hover:bg-white/20 flex-1 sm:flex-initial"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Recalcular</span>
            </Button>
            <Button
              size="sm"
              onClick={handleExportPurchaseOrder}
              className="h-9 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md flex-1 sm:flex-initial"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Exportar Pedido (.xlsx)</span>
            </Button>
          </div>
        </div>

        {/* Indicadores Principais de Reposição */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5 pt-4 border-t border-white/10 text-xs">
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-slate-400 text-[11px] block">Produtos p/ Comprar</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-amber-300">
                {kpis.totalItemsNeeded}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">itens</span>
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-slate-400 text-[11px] block">Unidades Sugeridas</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-indigo-300">
                {kpis.totalUnitsNeeded}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">peças</span>
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-rose-400 text-[11px] font-bold block flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Faltas (Estoque 0)
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-rose-400">
                {kpis.zeroStockCount}
              </span>
              <span className="text-[11px] text-rose-300/80 font-medium">zerados</span>
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-slate-400 text-[11px] block">Investimento Estimado</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-bold font-mono text-emerald-300 truncate">
                R$ {kpis.estimatedBudget.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros, Busca Inteligente e Câmera */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Seletor de Abas Principais */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as any)}
            className="w-full sm:w-auto"
          >
            <TabsList className="grid grid-cols-4 w-full sm:w-auto h-9 bg-slate-100 p-1">
              <TabsTrigger value="reposicao" className="text-xs font-bold px-3 gap-1">
                <ShoppingCart className="h-3.5 w-3.5 text-indigo-600" />
                <span>Reposição ({kpis.totalItemsNeeded})</span>
              </TabsTrigger>
              <TabsTrigger value="fabricantes" className="text-xs font-bold px-3 gap-1">
                <Building2 className="h-3.5 w-3.5 text-blue-600" />
                <span>Por Fabricante ({kpis.totalFabricantes})</span>
              </TabsTrigger>
              <TabsTrigger value="criticos" className="text-xs font-bold px-3 gap-1">
                <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                <span>Faltas e Críticos ({kpis.criticalLowCount})</span>
              </TabsTrigger>
              <TabsTrigger value="todos" className="text-xs font-bold px-3">
                Todos ({suggestions.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Campo de Busca Inteligente + Botão do Scanner */}
          <div className="flex items-center gap-2 flex-1 sm:max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por nome, SKU, código de barras ou fabricante..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs bg-slate-50 border-slate-200"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setScannerOpen(true)}
              className="h-9 px-3 gap-1.5 border-indigo-200 bg-indigo-50/60 text-indigo-700 hover:bg-indigo-100 font-bold shrink-0 text-xs"
              title="Escanear código de barras com a câmera"
            >
              <ScanLine className="h-4 w-4 text-indigo-600" />
              <span className="hidden sm:inline">Escanear</span>
            </Button>
          </div>
        </div>

        {/* Filtro secundário por Fabricante */}
        {manufacturersList.length > 0 && activeTab !== 'fabricantes' && (
          <div className="flex items-center gap-2 pt-1 border-t border-slate-100 overflow-x-auto text-xs">
            <span className="text-slate-500 font-bold shrink-0 text-[11px]">
              Filtrar Fabricante:
            </span>
            <Button
              type="button"
              size="sm"
              variant={selectedManufacturer === 'all' ? 'default' : 'outline'}
              onClick={() => setSelectedManufacturer('all')}
              className={`h-7 px-2.5 text-[11px] font-bold ${
                selectedManufacturer === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-700'
              }`}
            >
              Todos ({manufacturersList.length})
            </Button>
            {manufacturersList.map((fab) => {
              const isSelected = selectedManufacturer === fab
              return (
                <Button
                  key={fab}
                  type="button"
                  size="sm"
                  variant={isSelected ? 'default' : 'outline'}
                  onClick={() => setSelectedManufacturer(isSelected ? 'all' : fab)}
                  className={`h-7 px-2.5 text-[11px] font-bold shrink-0 ${
                    isSelected
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {fab}
                </Button>
              )
            })}
          </div>
        )}
      </div>

      {/* Conteúdo da Aba 2: Agrupamento por Fabricante */}
      {activeTab === 'fabricantes' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-600" />
                Pedidos de Compra Agrupados por Fabricante
              </h2>
              <p className="text-xs text-slate-500">
                Relatório consolidado para emissão direta de pedidos a cada fornecedor/fabricante.
              </p>
            </div>
          </div>

          {manufacturerGroups.length === 0 ? (
            <Card className="p-8 text-center text-slate-500">
              <p className="text-sm font-semibold">
                Nenhum pedido de compra necessário no momento.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Todos os produtos estão com níveis de estoque acima do consumo trimestral.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {manufacturerGroups.map((group) => {
                return (
                  <Card
                    key={group.fabricante}
                    className="border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden"
                  >
                    <CardHeader className="bg-slate-50/80 border-b border-slate-100 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-indigo-600" />
                          <CardTitle className="text-sm font-bold text-slate-900 truncate">
                            {group.fabricante}
                          </CardTitle>
                        </div>
                        <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 font-bold text-[11px]">
                          {group.totalItems} {group.totalItems === 1 ? 'produto' : 'produtos'}
                        </Badge>
                      </div>
                      <CardDescription className="text-[11px] text-slate-500 mt-1">
                        Total de <strong>{group.totalSuggestedUnits}</strong> peças a repor
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="p-4 flex-1 space-y-2.5">
                      <div className="space-y-1.5 max-h-48 overflow-y-auto divide-y divide-slate-100 text-xs">
                        {group.items.slice(0, 5).map((item) => (
                          <div
                            key={item.product.id}
                            className="pt-1.5 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-slate-900 truncate text-[11px]">
                                {item.product.name}
                              </p>
                              <p className="text-[10px] text-slate-500">
                                Estoque atual: <strong>{item.currentStock}</strong>
                              </p>
                            </div>
                            <span className="font-mono font-bold text-xs bg-amber-50 text-amber-900 px-2 py-0.5 rounded border border-amber-200 shrink-0">
                              + {item.suggestedQty} un
                            </span>
                          </div>
                        ))}
                        {group.items.length > 5 && (
                          <p className="text-[11px] text-slate-400 italic pt-1">
                            + {group.items.length - 5} outro(s) produto(s)...
                          </p>
                        )}
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase font-bold">
                            Total Estimado
                          </span>
                          <span className="font-mono font-bold text-sm text-emerald-700">
                            R$ {group.totalEstimatedCost.toFixed(2)}
                          </span>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleOpenManufacturerReport(group)}
                          className="h-8 text-xs font-bold gap-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                          <span>Ver Relatório</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        /* Tabela Principal Comparativa de Vendas dos Últimos 3 Meses e Reposição */
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50/70 border-b border-slate-200 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-indigo-600" />
                  Comparativo de Vendas (3 Meses) e Reposição Sugerida
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Cálculo: <strong>Consumo Médio Mensal</strong> menos{' '}
                  <strong>Estoque Atual</strong> (arredondado para cima).
                </CardDescription>
              </div>

              <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <span className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-200 text-rose-800 px-2 py-0.5 rounded text-[11px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-rose-600" /> Estoque 0 (Falta)
                </span>
                <span className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded text-[11px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-amber-500" /> Estoque Crítico (≤ 2)
                </span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3 w-10 text-center">#</th>
                    <th className="py-3 px-3">Código / Barras</th>
                    <th className="py-3 px-3">Produto e Fabricante</th>
                    <th className="py-3 px-3 text-center bg-indigo-50/50">Estoque Atual</th>
                    {/* Colunas do Comparativo Mensal dos últimos 3 meses */}
                    <th className="py-3 px-2 text-center font-mono">
                      {monthLabels[0]}
                      <span className="text-[10px] block text-slate-500 font-normal">Mês 1</span>
                    </th>
                    <th className="py-3 px-2 text-center font-mono">
                      {monthLabels[1]}
                      <span className="text-[10px] block text-slate-500 font-normal">Mês 2</span>
                    </th>
                    <th className="py-3 px-2 text-center font-mono">
                      {monthLabels[2]}
                      <span className="text-[10px] block text-slate-500 font-normal">Mês 3</span>
                    </th>
                    <th className="py-3 px-2 text-center bg-slate-50 font-mono">Média Mensal</th>
                    <th className="py-3 px-3 text-center bg-amber-50 text-amber-900 font-black">
                      Reposição Sugerida
                    </th>
                    <th className="py-3 px-3 text-right">Custo Unit.</th>
                    <th className="py-3 px-3 text-right">Total Est.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSuggestions.map((item, idx) => {
                    const p = item.product
                    const isZero = item.isZeroStock
                    const isLow = item.isCriticalLow
                    const isNeeded = item.suggestedQty > 0
                    const unitCost = p.cost || 0
                    const totalCost = unitCost * item.suggestedQty

                    return (
                      <tr
                        key={p.id}
                        className={`hover:bg-slate-50 transition-colors ${
                          isZero
                            ? 'bg-rose-50/40'
                            : isLow
                              ? 'bg-amber-50/30'
                              : idx % 2 === 0
                                ? 'bg-white'
                                : 'bg-slate-50/20'
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono font-bold">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          <span className="font-bold text-slate-800 block">{p.sku || '-'}</span>
                          <span className="text-[10px] text-slate-500">
                            {p.barcode || p.codigo_barras || '-'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-900 block text-xs">{p.name}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="inline-flex items-center gap-1 text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded font-semibold border border-indigo-100">
                              <Building2 className="h-2.5 w-2.5" />
                              {item.fabricante}
                            </span>
                            {p.category && (
                              <span className="text-[10px] text-slate-500 font-medium">
                                • {p.category}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Estoque Atual com destaque de cor de alerta */}
                        <td className="py-2.5 px-3 text-center font-mono">
                          <span
                            className={`inline-block px-2 py-0.5 rounded font-black text-xs ${
                              isZero
                                ? 'bg-rose-600 text-white shadow-xs'
                                : isLow
                                  ? 'bg-amber-500 text-white shadow-xs'
                                  : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {item.currentStock}
                          </span>
                        </td>

                        {/* Comparativo de vendas dos 3 meses */}
                        <td className="py-2.5 px-2 text-center font-mono text-xs text-slate-700 font-semibold">
                          {item.sales.month1}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono text-xs text-slate-700 font-semibold">
                          {item.sales.month2}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono text-xs text-slate-700 font-semibold">
                          {item.sales.month3}
                        </td>

                        {/* Média Mensal */}
                        <td className="py-2.5 px-2 text-center font-mono text-xs font-bold text-slate-900 bg-slate-50/80">
                          {item.sales.averageMonthly.toFixed(1)}
                        </td>

                        {/* Quantidade de Reposição Sugerida */}
                        <td className="py-2.5 px-3 text-center bg-amber-50/60 font-mono">
                          {isNeeded ? (
                            <span className="inline-flex items-center gap-1 font-black text-xs text-amber-900 bg-amber-200/90 px-2 py-0.5 rounded shadow-2xs border border-amber-300">
                              + {item.suggestedQty} un
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-medium">—</span>
                          )}
                        </td>

                        {/* Custos */}
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700 font-medium">
                          R$ {unitCost.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                          R$ {totalCost.toFixed(2)}
                        </td>
                      </tr>
                    )
                  })}

                  {filteredSuggestions.length === 0 && (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400 font-medium">
                        Nenhum produto encontrado com os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de Relatório do Fabricante com Opção de Impressão */}
      <Dialog open={manufacturerModalOpen} onOpenChange={setManufacturerModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-6">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-600" />
                <div>
                  <DialogTitle className="text-lg font-bold text-slate-900">
                    Pedido de Compra — {activeManufacturerGroup?.fabricante}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500">
                    Relatório agrupado por fabricante com nome do produto e quantidade necessária.
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-2 space-y-3">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs flex items-center justify-between">
              <div>
                <span className="text-slate-500 block">Total de Itens a Comprar</span>
                <span className="text-base font-bold text-slate-900">
                  {activeManufacturerGroup?.totalItems} produto(s) (
                  {activeManufacturerGroup?.totalSuggestedUnits} unidades)
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 block">Investimento Estimado</span>
                <span className="text-base font-bold font-mono text-emerald-700">
                  R$ {activeManufacturerGroup?.totalEstimatedCost.toFixed(2)}
                </span>
              </div>
            </div>

            <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase">
                <tr>
                  <th className="py-2 px-3">Código</th>
                  <th className="py-2 px-3">Nome do Produto</th>
                  <th className="py-2 px-3 text-center">Estoque Atual</th>
                  <th className="py-2 px-3 text-center bg-amber-50 text-amber-900">
                    Qtd Necessária
                  </th>
                  <th className="py-2 px-3 text-right">Custo Unit.</th>
                  <th className="py-2 px-3 text-right">Total Est.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {activeManufacturerGroup?.items.map((item) => (
                  <tr key={item.product.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono font-bold text-slate-700">
                      {item.product.sku || '-'}
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-900">{item.product.name}</td>
                    <td className="py-2 px-3 text-center font-mono">{item.currentStock}</td>
                    <td className="py-2 px-3 text-center font-mono font-black text-amber-900 bg-amber-50">
                      + {item.suggestedQty}
                    </td>
                    <td className="py-2 px-3 text-right font-mono">
                      R$ {item.unitCost.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                      R$ {item.totalCost.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <DialogFooter className="border-t border-slate-100 pt-3 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="text-xs gap-1.5"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Imprimir Pedido</span>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setManufacturerModalOpen(false)}
              className="bg-slate-900 text-white text-xs"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leitor de Código de Barras (Câmera + Fallback Digitação) */}
      <BarcodeScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={handleBarcodeDetected}
      />
    </div>
  )
}
