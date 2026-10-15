import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Search,
  Barcode,
  Package,
  Layers,
  DollarSign,
  AlertCircle,
  Loader2,
  X,
  Keyboard,
  Info,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Product } from '@/types'
import { searchProductsLookup } from '@/services/products'
import { usePermissions } from '@/hooks/use-permissions'

export type ProductLookupMode = 'description' | 'barcode'

export interface ProductLookupModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Título ou contexto de origem para acessibilidade (opcional).
   * Ex: "Ordem de Serviço #1234" ou "Orçamento #5678"
   */
  originContext?: string
}

export function ProductLookupModal({ open, onOpenChange, originContext }: ProductLookupModalProps) {
  const { hasPermission } = usePermissions()

  // Permissões existentes de visualização
  const canViewStock = hasPermission('produtos')
  const canViewPrice =
    hasPermission('produtos') || hasPermission('orcamentos') || hasPermission('ordens')

  // Modos de busca: descrição (parcial) ou código de barras (exato com zeros)
  const [mode, setMode] = useState<ProductLookupMode>('description')
  const [searchTerm, setSearchTerm] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Guard contra race condition / respostas fora de ordem
  const latestRequestIdRef = useRef<number>(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Executa busca com controle de versão de requisição
  const executeSearch = useCallback(async (termToSearch: string, searchMode: ProductLookupMode) => {
    const trimmed = termToSearch.trim()
    if (!trimmed) {
      setProducts([])
      setHasSearched(false)
      setErrorMsg(null)
      setLoading(false)
      return
    }

    const requestId = ++latestRequestIdRef.current
    setLoading(true)
    setErrorMsg(null)

    try {
      const result = await searchProductsLookup({
        mode: searchMode,
        term: trimmed,
        perPage: 100,
      })

      // Descarta respostas se uma pesquisa mais recente já tiver sido disparada
      if (requestId !== latestRequestIdRef.current) {
        return
      }

      setProducts(result.items)
      setHasSearched(true)
    } catch (err: any) {
      if (requestId !== latestRequestIdRef.current) {
        return
      }
      console.error('Erro na consulta de produtos:', err)
      setErrorMsg(
        err?.message ||
          'Não foi possível consultar os produtos no estoque. Verifique sua conexão e tente novamente.',
      )
      setProducts([])
      setHasSearched(true)
    } finally {
      if (requestId === latestRequestIdRef.current) {
        setLoading(false)
      }
    }
  }, [])

  // Reset e foco ao abrir a modal
  useEffect(() => {
    if (open) {
      setSearchTerm('')
      setProducts([])
      setHasSearched(false)
      setErrorMsg(null)
      latestRequestIdRef.current++
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    } else {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [open])

  // Debounce automático para busca por descrição (a partir de 2 caracteres)
  useEffect(() => {
    if (!open) return

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    if (mode === 'description') {
      const clean = searchTerm.trim()
      if (!clean) {
        setProducts([])
        setHasSearched(false)
        setErrorMsg(null)
        setLoading(false)
        return
      }

      debounceTimerRef.current = setTimeout(() => {
        executeSearch(clean, 'description')
      }, 300)
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [searchTerm, mode, open, executeSearch])

  // Troca de modo de busca (limpa resultados e foca)
  const handleSelectMode = (newMode: ProductLookupMode) => {
    if (newMode === mode) return
    setMode(newMode)
    setSearchTerm('')
    setProducts([])
    setHasSearched(false)
    setErrorMsg(null)
    latestRequestIdRef.current++
    setTimeout(() => {
      inputRef.current?.focus()
    }, 60)
  }

  // Submissão do formulário (tecla Enter ou clique no botão Buscar)
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    executeSearch(searchTerm, mode)
  }

  // Limpa o termo atual
  const handleClear = () => {
    setSearchTerm('')
    setProducts([])
    setHasSearched(false)
    setErrorMsg(null)
    latestRequestIdRef.current++
    inputRef.current?.focus()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Mantém viewport no mobile e largura ampla no desktop
        className="w-full sm:max-w-2xl lg:max-w-4xl max-h-[92dvh] flex flex-col p-4 sm:p-6 overflow-hidden gap-3"
      >
        <DialogHeader className="pb-1">
          <div className="flex items-center gap-2 text-indigo-700">
            <Package className="h-5 w-5" />
            <DialogTitle className="text-base sm:text-lg font-bold text-slate-900">
              Consultar Produto
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            Janela exclusiva de consulta de estoque e preços. Nenhuma alteração é salva e sua OS ou
            orçamento permanece intacto.
            {originContext ? ` Origem: ${originContext}` : ''}
          </DialogDescription>
        </DialogHeader>

        {/* Abas / Opções de busca: Por Descrição vs Por Código de Barras */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            type="button"
            onClick={() => handleSelectMode('description')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              mode === 'description'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <Search className="h-3.5 w-3.5" />
            <span>Por Descrição</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelectMode('barcode')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              mode === 'barcode'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <Barcode className="h-3.5 w-3.5" />
            <span>Por Código de Barras (Leitor / Enter)</span>
          </button>
        </div>

        {/* Barra de Busca */}
        <form onSubmit={handleFormSubmit} className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              {mode === 'barcode' ? (
                <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-600" />
              ) : (
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              )}
              <Input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={
                  mode === 'barcode'
                    ? 'Bipe com o leitor ou digite o código de barras exato e tecle Enter...'
                    : 'Digite parte do nome, marca ou descrição do produto...'
                }
                className={`pl-9 pr-8 h-10 text-xs sm:text-sm bg-slate-50 border-slate-300 focus-visible:bg-white ${
                  mode === 'barcode' ? 'font-mono' : ''
                }`}
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={handleClear}
                  aria-label="Limpar campo de pesquisa"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading || !searchTerm.trim()}
              className="h-10 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shrink-0"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Buscar</span>
            </Button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
            {mode === 'barcode' ? (
              <span className="flex items-center gap-1 text-indigo-700 font-medium">
                <Keyboard className="h-3 w-3" />
                Compatível com leitor USB/Bluetooth (emulador de teclado). Zeros à esquerda são
                preservados.
              </span>
            ) : (
              <span>Pesquisa por palavras-chave em qualquer ordem.</span>
            )}
            {hasSearched && !loading && (
              <span className="font-mono">
                {products.length} {products.length === 1 ? 'resultado' : 'resultados'}
              </span>
            )}
          </div>
        </form>

        {/* Mensagem de Erro / Falha */}
        {errorMsg && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">Falha ao consultar produto</p>
              <p className="text-[11px] text-rose-700 mt-0.5">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Área de Resultados (com Scroll) */}
        <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg max-h-[50vh] sm:max-h-[54vh] bg-white">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-500 text-xs">
              <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
              <span className="font-medium text-slate-700">Consultando estoque...</span>
              <span className="text-[11px] text-slate-400">
                Aguarde o retorno dos produtos cadastrados
              </span>
            </div>
          ) : !hasSearched ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400 text-xs px-4 text-center">
              <Package className="h-9 w-9 text-slate-300" />
              <p className="font-semibold text-slate-700 text-sm">Pronto para consultar</p>
              <p className="max-w-md text-slate-500">
                {mode === 'barcode'
                  ? 'Bipe o código de barras com o leitor ou digite o código completo e pressione Enter.'
                  : 'Digite o nome, marca ou parte da descrição para localizar o produto no estoque.'}
              </p>
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400 text-xs px-4 text-center">
              <AlertCircle className="h-8 w-8 text-amber-500" />
              <p className="font-bold text-slate-800 text-sm">Nenhum produto encontrado</p>
              <p className="max-w-md text-slate-500">
                {mode === 'barcode'
                  ? `Nenhum produto com o código de barras exato "${searchTerm.trim()}" foi localizado. Verifique se o código possui zeros à esquerda ou se está cadastrado.`
                  : `Nenhum produto corresponde aos termos informados: "${searchTerm.trim()}". Tente buscar por termos mais genéricos.`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 whitespace-nowrap">Cód. Interno</th>
                    <th className="py-2.5 px-3 min-w-[200px]">Descrição do Produto</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Cód. de Barras</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">
                      Estoque Disponível
                    </th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">Unidade</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Preço de Venda</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {products.map((p) => {
                    const stock = p.stock_quantity ?? 0
                    const isZeroStock = stock <= 0
                    const barcode = p.barcode || p.codigo_barras || ''
                    const unitPrice = p.price ?? 0

                    return (
                      <tr key={p.id} className="hover:bg-indigo-50/40 transition-colors">
                        {/* Código Interno (SKU / id interno) */}
                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-700 whitespace-nowrap align-top">
                          {p.sku || p.id}
                        </td>

                        {/* Descrição do Produto */}
                        <td className="py-2.5 px-3 align-top">
                          <span className="font-bold text-slate-900 block leading-snug">
                            {p.name}
                          </span>
                          {p.description && p.description.trim() !== p.name.trim() && (
                            <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed break-words line-clamp-2">
                              {p.description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {p.category && (
                              <Badge
                                variant="outline"
                                className="text-[10px] py-0 px-1.5 font-normal bg-slate-50 text-slate-600 border-slate-200"
                              >
                                {p.category}
                              </Badge>
                            )}
                            {p.fabricante && (
                              <Badge
                                variant="outline"
                                className="text-[10px] py-0 px-1.5 font-normal bg-slate-50 text-slate-600 border-slate-200"
                              >
                                {p.fabricante}
                              </Badge>
                            )}
                            {p.type && (
                              <Badge
                                variant="outline"
                                className="text-[10px] py-0 px-1.5 font-normal bg-slate-50 text-slate-500 border-slate-200 capitalize"
                              >
                                {p.type}
                              </Badge>
                            )}
                          </div>
                        </td>

                        {/* Código de Barras (preserva zeros exatamente) */}
                        <td className="py-2.5 px-3 font-mono text-slate-700 text-xs whitespace-nowrap align-top">
                          {barcode ? (
                            <span className="inline-flex items-center gap-1 font-semibold">
                              <Barcode className="h-3.5 w-3.5 text-slate-400" />
                              <span>{barcode}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">—</span>
                          )}
                        </td>

                        {/* Saldo disponível em estoque */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap align-top">
                          {canViewStock ? (
                            <span
                              className={`inline-block font-mono font-bold px-2.5 py-0.5 rounded text-xs ${
                                isZeroStock
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : stock < 5
                                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              {stock}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Restrito</span>
                          )}
                        </td>

                        {/* Unidade de Medida */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap align-top font-mono text-xs text-slate-700">
                          UN
                        </td>

                        {/* Preço de Venda (nunca expõe custo ou margem) */}
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap align-top">
                          {canViewPrice ? (
                            <span className="text-slate-900">
                              R${' '}
                              {unitPrice.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Restrito</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Rodapé da Consulta */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-200 text-xs text-slate-600">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Info className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span>
              Somente leitura: nenhum item é inserido automaticamente na ordem ou no orçamento.
            </span>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs font-semibold"
            >
              Fechar Consulta
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
