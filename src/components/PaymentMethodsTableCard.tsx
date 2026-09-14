import { useState } from 'react'
import {
  CreditCard,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  CheckCircle,
  Percent,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { PaymentMethodTax } from '@/types'
import { DEFAULT_PAYMENT_METHODS_TAX } from '@/services/pricing'
import { formatCurrencyBRL } from '@/lib/dashboard-utils'

interface PaymentMethodsTableCardProps {
  methods: PaymentMethodTax[]
  onSaveMethods: (methods: PaymentMethodTax[]) => Promise<void>
  saving: boolean
  currentSalePrice?: number
  selectedMethodId?: string
  onSelectMethod?: (method: PaymentMethodTax | null) => void
}

export function PaymentMethodsTableCard({
  methods,
  onSaveMethods,
  saving,
  currentSalePrice = 0,
  selectedMethodId,
  onSelectMethod,
}: PaymentMethodsTableCardProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [editingRows, setEditingRows] = useState<PaymentMethodTax[]>(methods)
  const [newNome, setNewNome] = useState('')
  const [newTaxa, setNewTaxa] = useState('')
  const [newParcelas, setNewParcelas] = useState('1')
  const [hasChanges, setHasChanges] = useState(false)

  // Sincroniza quando os methods externos mudarem e não houver alterações pendentes
  const syncWithExternal = () => {
    setEditingRows(methods && methods.length > 0 ? methods : DEFAULT_PAYMENT_METHODS_TAX)
    setHasChanges(false)
  }

  const handleTaxaChange = (id: string, val: string) => {
    const numVal = parseFloat(val.replace(',', '.'))
    setEditingRows((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, taxa_pct: isNaN(numVal) ? 0 : Math.max(0, numVal) } : row,
      ),
    )
    setHasChanges(true)
  }

  const handleNomeChange = (id: string, val: string) => {
    setEditingRows((prev) => prev.map((row) => (row.id === id ? { ...row, nome: val } : row)))
    setHasChanges(true)
  }

  const handleParcelasChange = (id: string, val: string) => {
    const p = Math.max(1, parseInt(val, 10) || 1)
    setEditingRows((prev) => prev.map((row) => (row.id === id ? { ...row, parcelas: p } : row)))
    setHasChanges(true)
  }

  const handleRemoveRow = (id: string) => {
    if (editingRows.length <= 1) return
    setEditingRows((prev) => prev.filter((row) => row.id !== id))
    setHasChanges(true)
    if (selectedMethodId === id && onSelectMethod) {
      onSelectMethod(null)
    }
  }

  const handleAddRow = () => {
    if (!newNome.trim()) return
    const taxaNum = parseFloat(newTaxa.replace(',', '.')) || 0
    const parcelasNum = Math.max(1, parseInt(newParcelas, 10) || 1)
    const newId = `custom_${Date.now()}`

    const newRow: PaymentMethodTax = {
      id: newId,
      nome: newNome.trim(),
      taxa_pct: taxaNum,
      parcelas: parcelasNum,
    }

    setEditingRows((prev) => [...prev, newRow])
    setNewNome('')
    setNewTaxa('')
    setNewParcelas('1')
    setHasChanges(true)
  }

  const handleRestoreDefaults = () => {
    setEditingRows(DEFAULT_PAYMENT_METHODS_TAX)
    setHasChanges(true)
  }

  const handleSave = async () => {
    await onSaveMethods(editingRows)
    setHasChanges(false)
  }

  // Encontra o método selecionado
  const activeMethod = editingRows.find((m) => m.id === selectedMethodId)

  // Cálculos do simulador com base no preço de venda atual
  const price = Math.max(0, currentSalePrice)
  const calcInstallment = (row: PaymentMethodTax) => {
    const parcelas = Math.max(1, row.parcelas || 1)
    const taxaValor = Math.round(price * (row.taxa_pct / 100) * 100) / 100
    const valorParcela = price > 0 ? Math.round((price / parcelas) * 100) / 100 : 0
    const liquidoRecebido = Math.max(0, Math.round((price - taxaValor) * 100) / 100)
    return { valorParcela, taxaValor, liquidoRecebido }
  }

  return (
    <Card className="border-indigo-200/80 bg-white shadow-2xs">
      <CardHeader className="pb-3 pt-4 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <CreditCard className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Formas de Pagamento & Taxas de Cartão</span>
                {activeMethod && (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold">
                    Selecionado: {activeMethod.nome} ({activeMethod.taxa_pct}%)
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Tabela de taxas configurável com simulação em tempo real de parcelas (1x a 12x) e
                líquido recebido
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {hasChanges && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={syncWithExternal}
                className="h-8 text-xs text-slate-600 hover:text-slate-900"
                title="Descartar alterações locais"
              >
                Descartar
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{saving ? 'Salvando...' : 'Salvar Taxas'}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed(!collapsed)}
              className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800"
              title={collapsed ? 'Expandir' : 'Recolher'}
            >
              {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {!collapsed && (
        <CardContent className="pt-4 space-y-4">
          {/* Alerta de Simulação com o Preço Atual */}
          {price > 0 && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Percent className="h-4 w-4 text-indigo-600 shrink-0" />
                <div>
                  <span className="text-slate-600 font-medium">Preço base da simulação: </span>
                  <strong className="font-mono text-slate-900 text-sm font-bold tabular-nums">
                    {formatCurrencyBRL(price)}
                  </strong>
                </div>
              </div>

              {activeMethod ? (
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[11px] text-slate-500 block">Líquido na sua conta:</span>
                    <strong className="font-mono text-emerald-700 text-sm font-bold tabular-nums">
                      {formatCurrencyBRL(calcInstallment(activeMethod).liquidoRecebido)}
                    </strong>
                  </div>
                  {activeMethod.parcelas > 1 && (
                    <div className="text-right pl-3 border-l border-slate-200">
                      <span className="text-[11px] text-slate-500 block">
                        {activeMethod.parcelas}x de:
                      </span>
                      <strong className="font-mono text-indigo-700 text-sm font-bold tabular-nums">
                        {formatCurrencyBRL(calcInstallment(activeMethod).valorParcela)}
                      </strong>
                    </div>
                  )}
                  {onSelectMethod && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onSelectMethod(null)}
                      className="h-7 text-[11px] text-slate-500 hover:text-slate-800 underline p-0 ml-1"
                    >
                      Limpar seleção
                    </Button>
                  )}
                </div>
              ) : (
                <span className="text-[11px] text-slate-500 italic">
                  Clique em uma linha para aplicar a taxa à precificação
                </span>
              )}
            </div>
          )}

          {/* Tabela Editável */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-2 px-3 text-center w-12">Usar</th>
                  <th className="py-2 px-3 min-w-[160px]">Forma de Pagamento</th>
                  <th className="py-2 px-3 text-center w-24">Parcelas</th>
                  <th className="py-2 px-3 text-right w-28">Taxa (%)</th>
                  {price > 0 && (
                    <>
                      <th className="py-2 px-3 text-right min-w-[110px]">Valor Parcela</th>
                      <th className="py-2 px-3 text-right min-w-[100px]">Taxa R$</th>
                      <th className="py-2 px-3 text-right min-w-[110px]">Total Líquido</th>
                    </>
                  )}
                  <th className="py-2 px-2 text-center w-10">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {editingRows.map((row) => {
                  const isSelected = selectedMethodId === row.id
                  const sim = calcInstallment(row)

                  return (
                    <tr
                      key={row.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-emerald-50/70 border-l-4 border-l-emerald-600'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Check/Selecionar */}
                      <td className="py-2 px-3 text-center">
                        {onSelectMethod && (
                          <button
                            type="button"
                            onClick={() => onSelectMethod(isSelected ? null : row)}
                            className={`h-5 w-5 rounded flex items-center justify-center transition-all ${
                              isSelected
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'border border-slate-300 hover:border-emerald-500 text-transparent'
                            }`}
                            title={isSelected ? 'Desmarcar taxa' : 'Aplicar esta taxa ao cálculo'}
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>

                      {/* Nome Editável */}
                      <td className="py-1.5 px-3">
                        <Input
                          type="text"
                          value={row.nome}
                          onChange={(e) => handleNomeChange(row.id, e.target.value)}
                          className="h-7 text-xs font-medium border-transparent hover:border-slate-200 focus:border-indigo-400 bg-transparent px-1.5"
                        />
                      </td>

                      {/* Parcelas Editáveis */}
                      <td className="py-1.5 px-3 text-center">
                        <Input
                          type="number"
                          min="1"
                          max="24"
                          value={row.parcelas}
                          onChange={(e) => handleParcelasChange(row.id, e.target.value)}
                          className="h-7 text-xs font-mono text-center w-16 mx-auto border-slate-200"
                        />
                      </td>

                      {/* Taxa % Editável */}
                      <td className="py-1.5 px-3 text-right">
                        <div className="inline-flex items-center gap-1 justify-end">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={row.taxa_pct}
                            onChange={(e) => handleTaxaChange(row.id, e.target.value)}
                            className="h-7 text-xs font-mono font-bold text-right w-20 border-slate-200 text-indigo-700"
                          />
                          <span className="text-slate-400 font-mono text-xs">%</span>
                        </div>
                      </td>

                      {/* Colunas calculadas de parcela e líquido (se preço > 0) */}
                      {price > 0 && (
                        <>
                          <td className="py-2 px-3 text-right font-mono text-xs text-slate-800 font-semibold tabular-nums">
                            {row.parcelas > 1 ? (
                              <span>
                                {row.parcelas}x de {formatCurrencyBRL(sim.valorParcela)}
                              </span>
                            ) : (
                              <span>{formatCurrencyBRL(sim.valorParcela)}</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-xs text-rose-600 tabular-nums">
                            -{formatCurrencyBRL(sim.taxaValor)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-xs font-bold text-emerald-700 tabular-nums">
                            {formatCurrencyBRL(sim.liquidoRecebido)}
                          </td>
                        </>
                      )}

                      {/* Remover Linha */}
                      <td className="py-1.5 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.id)}
                          disabled={editingRows.length <= 1}
                          className="text-slate-400 hover:text-rose-600 disabled:opacity-30 p-1"
                          title="Remover linha"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Adicionar nova forma de pagamento e restaurar padrões */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Input
                type="text"
                placeholder="Nova forma (ex: Link 3x)"
                value={newNome}
                onChange={(e) => setNewNome(e.target.value)}
                className="h-8 text-xs w-44"
              />
              <Input
                type="number"
                min="1"
                max="24"
                placeholder="Parcelas"
                value={newParcelas}
                onChange={(e) => setNewParcelas(e.target.value)}
                className="h-8 text-xs w-20 font-mono text-center"
              />
              <Input
                type="number"
                step="0.01"
                placeholder="Taxa %"
                value={newTaxa}
                onChange={(e) => setNewTaxa(e.target.value)}
                className="h-8 text-xs w-24 font-mono text-right"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddRow}
                disabled={!newNome.trim()}
                className="h-8 text-xs gap-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-semibold"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Adicionar Linha</span>
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRestoreDefaults}
                className="h-8 text-xs text-slate-500 hover:text-slate-800 gap-1"
                title="Restaura a tabela de Débito, Crédito à vista e 2x a 12x padrão"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Restaurar Padrão (Débito + 12x)</span>
              </Button>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-slate-400 cursor-pointer" />
                  </TooltipTrigger>
                  <TooltipContent className="text-xs max-w-xs">
                    Ao clicar no ícone de checagem ao lado da forma de pagamento, a taxa daquela
                    parcela é aplicada automaticamente no campo "Taxa Cartão %" do formulário de
                    cálculo acima.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
