import { useState, useEffect, useRef } from 'react'
import { Search, Plus, Loader2, X, Check, Package, Layers, Sparkles, Barcode } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { getProducts, createProduct } from '@/services/products'
import { useToast } from '@/hooks/use-toast'
import type { Product } from '@/types'

export interface ProductSearchInputProps {
  label?: string
  placeholder?: string
  categoryFilter?: string // ex: 'impressora' | 'toner' | 'cartucho'
  mode?: 'equipment' | 'supply' | 'all'
  selectedProductId?: string
  selectedProductName?: string
  onSelectProduct: (product: Product) => void
  onClear?: () => void
  required?: boolean
  disabled?: boolean
  className?: string
  helperText?: string
}

export function ProductSearchInput({
  label,
  placeholder = 'Buscar produto cadastrado...',
  categoryFilter,
  mode = 'all',
  selectedProductId,
  selectedProductName,
  onSelectProduct,
  onClear,
  required = false,
  disabled = false,
  className = '',
  helperText,
}: ProductSearchInputProps) {
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)

  // Estados para criação rápida de produto
  const [newProdName, setNewProdName] = useState('')
  const [newProdCategory, setNewProdCategory] = useState(
    categoryFilter
      ? categoryFilter.toUpperCase()
      : mode === 'equipment'
        ? 'IMPRESSORAS'
        : 'INSUMOS',
  )
  const [newProdCost, setNewProdCost] = useState('')
  const [newProdPrice, setNewProdPrice] = useState('')
  const [newProdSku, setNewProdSku] = useState('')
  const [creating, setCreating] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Dispara busca com debounce
  useEffect(() => {
    if (!isOpen) return

    if (debounceRef.current) clearTimeout(debounceRef.current)

    const term = query.trim()
    setLoading(true)

    debounceRef.current = setTimeout(async () => {
      try {
        const fetched = await getProducts(term, 1, 50)
        let filtered = fetched

        // Se for modo equipment, garante tipo produto e tenta priorizar impressoras se houver filtro
        if (mode === 'equipment') {
          filtered = fetched.filter((p) => p.type !== 'servico')
          if (categoryFilter) {
            const catLower = categoryFilter.toLowerCase()
            const matchingCat = filtered.filter(
              (p) =>
                (p.category && p.category.toLowerCase().includes(catLower)) ||
                (p.name && p.name.toLowerCase().includes(catLower)),
            )
            // Se encontrar itens na categoria desejada, mostra eles; senão mostra os produtos em geral
            if (matchingCat.length > 0) {
              filtered = matchingCat
            }
          }
        } else if (mode === 'supply' && categoryFilter) {
          filtered = fetched.filter((p) => p.type !== 'servico')
          const catLower = categoryFilter.toLowerCase()
          const matchingCat = filtered.filter(
            (p) =>
              (p.category && p.category.toLowerCase().includes(catLower)) ||
              (p.name && p.name.toLowerCase().includes(catLower)),
          )
          if (matchingCat.length > 0) {
            filtered = matchingCat
          }
        }

        setResults(filtered)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 200)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, isOpen, mode, categoryFilter])

  const handleSelect = (prod: Product) => {
    onSelectProduct(prod)
    setIsOpen(false)
    setQuery('')
  }

  const handleOpenQuickCreate = () => {
    setNewProdName(query.trim())
    setNewProdCategory(
      categoryFilter
        ? categoryFilter.toUpperCase()
        : mode === 'equipment'
          ? 'IMPRESSORAS'
          : 'INSUMOS',
    )
    setNewProdCost('')
    setNewProdPrice('')
    setNewProdSku('')
    setIsOpen(false)
    setQuickCreateOpen(true)
  }

  const handleSaveQuickProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProdName.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe o nome do produto a cadastrar.',
        variant: 'destructive',
      })
      return
    }

    setCreating(true)
    try {
      const costNum = parseFloat(newProdCost.replace(',', '.')) || 0
      const priceNum = parseFloat(newProdPrice.replace(',', '.')) || costNum * 1.5

      const created = await createProduct({
        name: newProdName.trim(),
        category: newProdCategory.trim() || (mode === 'equipment' ? 'Impressoras' : 'Insumos'),
        cost: costNum,
        price: priceNum,
        sku: newProdSku.trim() || undefined,
        type: 'produto',
        active: true,
        stock_quantity: 0,
      })

      toast({
        title: 'Produto cadastrado!',
        description: `${created.name} vinculado com sucesso.`,
      })

      onSelectProduct(created)
      setQuickCreateOpen(false)
    } catch (err) {
      toast({
        title: 'Erro ao cadastrar produto',
        description: 'Verifique se os dados estão corretos e tente novamente.',
        variant: 'destructive',
      })
      console.error(err)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div ref={containerRef} className={`relative space-y-1 ${className}`}>
      {label && (
        <Label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
          <span>
            {label} {required && <span className="text-rose-500">*</span>}
          </span>
          {selectedProductId && (
            <Badge
              variant="outline"
              className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
            >
              <Check className="h-3 w-3 mr-0.5 inline" /> Vinculado ao estoque
            </Badge>
          )}
        </Label>
      )}

      {/* Caixa de exibição do produto selecionado ou campo de busca */}
      {selectedProductId && selectedProductName ? (
        <div className="flex items-center justify-between gap-2 p-2 rounded-lg border border-indigo-200 bg-indigo-50/50 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Package className="h-4 w-4 text-indigo-600 shrink-0" />
            <div className="min-w-0">
              <p className="font-bold text-slate-900 truncate">{selectedProductName}</p>
              <p className="text-[10px] text-indigo-700 truncate">ID: {selectedProductId}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsOpen(true)
                setQuery('')
              }}
              disabled={disabled}
              className="h-7 px-2 text-[11px] text-indigo-700 hover:text-indigo-900 hover:bg-indigo-100"
            >
              Trocar
            </Button>
            {onClear && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClear}
                disabled={disabled}
                className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              if (!isOpen) setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            disabled={disabled}
            className="pl-8 pr-20 h-9 text-xs bg-white"
          />
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleOpenQuickCreate}
              title="Cadastrar novo produto rápido caso não exista"
              className="h-7 px-1.5 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 gap-0.5"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Criar</span>
            </Button>
          </div>
        </div>
      )}

      {helperText && <p className="text-[10px] text-slate-500">{helperText}</p>}

      {/* DROPDOWN FLUTUANTE DE RESULTADOS */}
      {isOpen && !selectedProductId && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-xl max-h-64 overflow-y-auto divide-y divide-slate-100">
          <div className="p-2 bg-slate-50 flex items-center justify-between text-[11px] text-slate-600 font-medium">
            <span>
              {loading ? 'Buscando produtos...' : `${results.length} produto(s) encontrado(s)`}
            </span>
            <button
              type="button"
              onClick={handleOpenQuickCreate}
              className="text-indigo-600 font-semibold hover:underline flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> Não encontrou? Cadastre aqui
            </button>
          </div>

          {loading ? (
            <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
              <span>Consultando catálogo...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center space-y-2">
              <p className="text-xs text-slate-500">Nenhum produto correspondente cadastrado.</p>
              <Button
                type="button"
                size="sm"
                onClick={handleOpenQuickCreate}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Criar "{query.trim() || 'Novo Produto'}" Agora</span>
              </Button>
            </div>
          ) : (
            results.map((prod) => (
              <button
                key={prod.id}
                type="button"
                onClick={() => handleSelect(prod)}
                className="w-full text-left p-2.5 hover:bg-indigo-50/60 transition-colors flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-slate-900">{prod.name}</span>
                    {prod.sku && (
                      <span className="font-mono text-[10px] text-indigo-600 bg-indigo-50 px-1 rounded">
                        SKU: {prod.sku}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                    {prod.category && <span>Cat: {prod.category}</span>}
                    {prod.fabricante && <span>• {prod.fabricante}</span>}
                    <span>• Custo: R$ {(prod.cost || 0).toFixed(2)}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono font-bold text-slate-900 block text-xs">
                    R$ {(prod.price || 0).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-medium">
                    Selecionar
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* MODAL DE CRIAÇÃO RÁPIDA DE PRODUTO */}
      <Dialog open={quickCreateOpen} onOpenChange={setQuickCreateOpen}>
        <DialogContent className="max-w-md p-5">
          <DialogHeader>
            <div className="flex items-center gap-2 text-indigo-600">
              <Sparkles className="h-5 w-5" />
              <DialogTitle className="text-base font-bold text-slate-900">
                Criar Produto e Vincular ao Catálogo
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500">
              Cadastra instantaneamente na coleção de produtos para garantir o vínculo no sistema.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveQuickProduct} className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">
                Nome do Produto / Modelo *
              </Label>
              <Input
                placeholder="Ex: Impressora Brother DCP-L5652DN ou Toner TN-3472"
                value={newProdName}
                onChange={(e) => setNewProdName(e.target.value)}
                required
                className="h-9 text-xs"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Categoria</Label>
                <Input
                  placeholder="Ex: Impressoras / Toner"
                  value={newProdCategory}
                  onChange={(e) => setNewProdCategory(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Código / SKU</Label>
                <Input
                  placeholder="Ex: BRO-L5652"
                  value={newProdSku}
                  onChange={(e) => setNewProdSku(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Custo de Compra (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={newProdCost}
                  onChange={(e) => setNewProdCost(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Preço de Venda (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={newProdPrice}
                  onChange={(e) => setNewProdPrice(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuickCreateOpen(false)}
                disabled={creating}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={creating}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5"
              >
                {creating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                <span>{creating ? 'Cadastrando...' : 'Cadastrar e Vincular'}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
