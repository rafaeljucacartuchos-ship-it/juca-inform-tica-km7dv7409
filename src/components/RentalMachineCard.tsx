import { useState } from 'react'
import { Plus, Trash2, Layers, Cpu, Check, Package, Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { ProductSearchInput } from '@/components/ProductSearchInput'
import { calculateSupplyCpp } from '@/services/rental'
import type { RentalSupplyItem, Product } from '@/types'

export interface MachineFormData {
  machineId?: string
  productId?: string
  machineName: string
  serial: string
  contadorInicial: number
  valorCompra: number
  paybackMeses: number
  scanner: boolean
  scannerTipo: string
  scannerVelocidade: string
  supplies: RentalSupplyItem[]
}

interface RentalMachineCardProps {
  index: number
  data: MachineFormData
  onChange: (data: MachineFormData) => void
  onRemove?: () => void
  canRemove?: boolean
  disabled?: boolean
}

const COMMON_SUPPLY_LABELS = [
  'Toner / Cartucho',
  'Fotocondutor (Cilindro)',
  'Fusor',
  'Rolete de Tração',
  'Outro Insumo',
]

export function RentalMachineCard({
  index,
  data,
  onChange,
  onRemove,
  canRemove = false,
  disabled = false,
}: RentalMachineCardProps) {
  const [selectedSupplyCategory, setSelectedSupplyCategory] = useState<string>('toner')

  // Regra do usuário: usar products.cost; se cost vazio/zero, usar products.price como fallback.
  // O valor cadastrado do produto é o default do campo de valor — nunca abrir vazio quando o produto tem preço.
  const getProductDefaultValue = (prod: Product): number => {
    if (typeof prod.cost === 'number' && prod.cost > 0) {
      return prod.cost
    }
    if (typeof prod.price === 'number' && prod.price > 0) {
      return prod.price
    }
    return 0
  }

  const handleSelectProduct = (prod: Product) => {
    const defaultVal = getProductDefaultValue(prod)
    onChange({
      ...data,
      productId: prod.id,
      machineName: prod.name,
      valorCompra: defaultVal > 0 ? defaultVal : data.valorCompra,
    })
  }

  const handleClearProduct = () => {
    onChange({
      ...data,
      productId: undefined,
      machineName: '',
    })
  }

  const handleAddSupply = (supplyProd: Product) => {
    const defaultVal = getProductDefaultValue(supplyProd)
    const defaultPages = 3000
    const cpp = calculateSupplyCpp(defaultVal, defaultPages)

    const newItem: RentalSupplyItem = {
      product: supplyProd.id,
      nome: supplyProd.name,
      categoria: supplyProd.category || 'Insumo',
      valor: defaultVal,
      durabilidade_paginas: defaultPages,
      cpp,
    }

    onChange({
      ...data,
      supplies: [...data.supplies, newItem],
    })
  }

  const handleUpdateSupply = (
    sIdx: number,
    field: 'valor' | 'durabilidade_paginas',
    rawVal: number,
  ) => {
    const updated = [...data.supplies]
    const item = { ...updated[sIdx], [field]: rawVal }
    item.cpp = calculateSupplyCpp(item.valor, item.durabilidade_paginas)
    updated[sIdx] = item
    onChange({ ...data, supplies: updated })
  }

  const handleRemoveSupply = (sIdx: number) => {
    onChange({
      ...data,
      supplies: data.supplies.filter((_, i) => i !== sIdx),
    })
  }

  const totalCppInsumos = data.supplies.reduce((acc, s) => acc + (s.cpp || 0), 0)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
      {/* CABEÇALHO DO CARD DA MÁQUINA */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold">
            {index + 1}
          </span>
          <h3 className="font-bold text-slate-900 text-sm">
            {data.machineName ? data.machineName : `Equipamento ${index + 1}`}
          </h3>
        </div>
        {canRemove && onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            disabled={disabled}
            className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-1"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remover Máquina {index + 1}
          </Button>
        )}
      </div>

      {/* 1. SELEÇÃO DO PRODUTO (OBRIGATÓRIO VINCULAR OU CRIAR NO CADASTRO) */}
      <ProductSearchInput
        label="Impressora / Multifuncional (Catálogo)"
        placeholder="Buscar impressora por nome, modelo, SKU..."
        mode="equipment"
        categoryFilter="impressora"
        selectedProductId={data.productId}
        selectedProductName={data.machineName}
        onSelectProduct={handleSelectProduct}
        onClear={handleClearProduct}
        required
        disabled={disabled}
        helperText="Filtra produtos do tipo 'produto' e categoria/nome de impressoras. Se não existir, use o botão 'Criar' para cadastrar no estoque."
      />

      {/* 2. DADOS FÍSICOS (SERIAL, CONTADOR, VALOR COMPRA, PAYBACK) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        <div className="space-y-1">
          <Label className="text-xs font-semibold text-slate-700">Nº de Série (Serial)</Label>
          <Input
            placeholder="Ex: BR123456"
            value={data.serial}
            onChange={(e) => onChange({ ...data, serial: e.target.value })}
            disabled={disabled}
            className="h-8 text-xs font-mono"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold text-slate-700">Contador Inicial</Label>
          <Input
            type="number"
            min="0"
            placeholder="0"
            value={data.contadorInicial || ''}
            onChange={(e) =>
              onChange({ ...data, contadorInicial: parseInt(e.target.value, 10) || 0 })
            }
            disabled={disabled}
            className="h-8 text-xs font-mono"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold text-slate-700">Valor Compra (R$)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="0,00"
            value={data.valorCompra || ''}
            onChange={(e) => onChange({ ...data, valorCompra: parseFloat(e.target.value) || 0 })}
            disabled={disabled}
            className="h-8 text-xs font-mono font-semibold"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold text-slate-700">Payback (Meses)</Label>
          <Input
            type="number"
            min="1"
            max="60"
            placeholder="18"
            value={data.paybackMeses || ''}
            onChange={(e) =>
              onChange({ ...data, paybackMeses: parseInt(e.target.value, 10) || 18 })
            }
            disabled={disabled}
            className="h-8 text-xs font-mono"
          />
        </div>
      </div>

      {/* SCANNER CONFIGURAÇÃO */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 text-xs">
        <div className="flex items-center gap-2">
          <Switch
            id={`scanner-${index}`}
            checked={data.scanner}
            onCheckedChange={(c) => onChange({ ...data, scanner: c })}
            disabled={disabled}
          />
          <Label
            htmlFor={`scanner-${index}`}
            className="text-xs font-semibold text-slate-700 cursor-pointer"
          >
            Possui Scanner / Digitalização?
          </Label>
        </div>
        {data.scanner && (
          <div className="flex items-center gap-2 flex-1 sm:justify-end">
            <Input
              placeholder="Especificações (ex: ADF Duplex 35 ppm, Rede/USB)"
              value={data.scannerTipo}
              onChange={(e) => onChange({ ...data, scannerTipo: e.target.value })}
              disabled={disabled}
              className="h-7 text-xs flex-1 max-w-xs"
            />
          </div>
        )}
      </div>

      {/* 3. INSUMOS VINCULADOS AO CADASTRO (SUPPLIES JSON COM CPP) */}
      <div className="space-y-2 border-t border-slate-100 pt-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-indigo-600" />
              <span>Insumos & Consumíveis Vinculados (Cálculo de CPP)</span>
            </Label>
            <p className="text-[10px] text-slate-500">
              Vincule cartucho, toner, fotocondutor/cilindro, fusor ou rolete do catálogo.
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-500 block">CPP Total Insumos:</span>
            <span className="text-xs font-mono font-bold text-indigo-700 tabular-nums">
              R$ {totalCppInsumos.toFixed(4)} / pág.
            </span>
          </div>
        </div>

        {/* BUSCA DE INSUMO PARA ADICIONAR */}
        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-semibold text-slate-600">
              Adicionar insumo do catálogo:
            </span>
            {['toner', 'cartucho', 'fotocondutor', 'fusor', 'rolete'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedSupplyCategory(cat)}
                className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${
                  selectedSupplyCategory === cat
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>

          <ProductSearchInput
            placeholder={`Buscar ${selectedSupplyCategory} no catálogo...`}
            mode="supply"
            categoryFilter={selectedSupplyCategory}
            onSelectProduct={handleAddSupply}
            disabled={disabled}
            helperText="Ao selecionar, insere automaticamente na lista com custo do produto e calcula o CPP."
          />
        </div>

        {/* TABELA DE INSUMOS ADICIONADOS */}
        {data.supplies.length === 0 ? (
          <div className="p-3 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
            Nenhum insumo vinculado ainda. Busque e adicione os suprimentos para calcular o custo
            por página (CPP).
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-1.5 px-2.5">Insumo / Suprimento</th>
                  <th className="py-1.5 px-2.5 text-right w-24">Valor (R$)</th>
                  <th className="py-1.5 px-2.5 text-right w-28">Durabilidade (págs)</th>
                  <th className="py-1.5 px-2.5 text-right w-28">CPP (R$)</th>
                  <th className="py-1.5 px-1.5 text-center w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {data.supplies.map((sup, sIdx) => (
                  <tr key={sIdx} className="hover:bg-slate-50">
                    <td className="py-1.5 px-2.5">
                      <span className="font-bold text-slate-900 block">{sup.nome}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {sup.categoria || 'Insumo'} • ID: {sup.product}
                      </span>
                    </td>
                    <td className="py-1.5 px-2.5 text-right">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={sup.valor}
                        onChange={(e) =>
                          handleUpdateSupply(sIdx, 'valor', parseFloat(e.target.value) || 0)
                        }
                        disabled={disabled}
                        className="h-7 text-xs font-mono text-right w-24 inline-block"
                      />
                    </td>
                    <td className="py-1.5 px-2.5 text-right">
                      <Input
                        type="number"
                        min="1"
                        step="100"
                        value={sup.durabilidade_paginas}
                        onChange={(e) =>
                          handleUpdateSupply(
                            sIdx,
                            'durabilidade_paginas',
                            parseInt(e.target.value, 10) || 1,
                          )
                        }
                        disabled={disabled}
                        className="h-7 text-xs font-mono text-right w-24 inline-block"
                      />
                    </td>
                    <td className="py-1.5 px-2.5 text-right font-mono font-bold text-indigo-700 tabular-nums">
                      R$ {(sup.cpp || 0).toFixed(4)}
                    </td>
                    <td className="py-1.5 px-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveSupply(sIdx)}
                        disabled={disabled}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                        title="Remover insumo"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
