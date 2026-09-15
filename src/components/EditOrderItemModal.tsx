import { useState, useEffect, useRef } from 'react'
import { Package, Wrench, Edit3 } from 'lucide-react'
import { ServiceOrderItem } from '@/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { offlinePb } from '@/lib/offline-pb'
import pb from '@/lib/pocketbase/client'
import { syncServiceOrderTotal } from '@/services/service_orders'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: ServiceOrderItem | null
  orderId: string
  onSaved: () => void
}

export function EditOrderItemModal({ open, onOpenChange, item, orderId, onSaved }: Props) {
  const { toast } = useToast()
  const [quantity, setQuantity] = useState<number>(1)
  const [unitPrice, setUnitPrice] = useState<number>(0)
  const [unitPriceInput, setUnitPriceInput] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const unitPriceInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open && item) {
      setQuantity(item.quantity || 1)
      const up = item.unit_price ?? 0
      setUnitPrice(up)
      setUnitPriceInput(
        up > 0
          ? up.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : '',
      )
      setDescription(item.description || '')
      const timer = setTimeout(() => {
        unitPriceInputRef.current?.focus()
        unitPriceInputRef.current?.select()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [open, item])

  if (!item) return null

  const isService = !!item.service || item.expand?.product?.type === 'servico'
  const validQty = Math.max(1, Number(quantity) || 1)
  const validUnitPrice = Math.max(0, Number(unitPrice) || 0)
  const calculatedSubtotal = validUnitPrice * validQty

  const handleSave = async () => {
    if (!item) return
    setSaving(true)
    try {
      const res = await offlinePb.update('service_order_items', item.id, {
        description: description.trim() || item.description,
        quantity: validQty,
        unit_price: validUnitPrice,
        total: calculatedSubtotal,
      })

      // Recalcula o subtotal e o total da OS imediatamente via hierarquia central
      try {
        await syncServiceOrderTotal(orderId)
      } catch {
        /* best effort */
      }

      if (res.queued) {
        toast({ title: 'Item atualizado localmente. Será sincronizado quando houver conexão.' })
      } else {
        toast({
          title: 'Item atualizado com sucesso!',
          description: `${validQty}x ${description || item.description} — R$ ${calculatedSubtotal.toFixed(2)} (R$ ${validUnitPrice.toFixed(2)} un.)`,
        })
      }

      onSaved()
      onOpenChange(false)
    } catch {
      toast({
        title: 'Erro ao atualizar item',
        description: 'Não foi possível salvar as alterações.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                isService ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'
              }`}
            >
              {isService ? <Wrench className="h-4 w-4" /> : <Package className="h-4 w-4" />}
            </span>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Editar Item da O.S.</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-semibold px-1.5 py-0.5 ${
                    isService
                      ? 'border-emerald-200 text-emerald-700 bg-emerald-50'
                      : 'border-indigo-200 text-indigo-700 bg-indigo-50'
                  }`}
                >
                  {isService ? 'Serviço' : 'Produto'}
                </Badge>
              </DialogTitle>
              <p className="text-xs text-slate-500 truncate mt-0.5">{item.description}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              Descrição / Nome do Item
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição do item"
              className="text-xs h-9"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/80 p-3.5 rounded-lg border border-slate-200/80">
            {/* Valor Unitário */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Valor Unitário (R$) *
              </label>
              <Input
                ref={unitPriceInputRef}
                type="text"
                inputMode="decimal"
                value={unitPriceInput}
                onChange={(e) => {
                  const raw = e.target.value
                  const filtered = raw.replace(/[^\d.,]/g, '')
                  setUnitPriceInput(filtered)

                  let clean = filtered.trim()
                  if (clean.includes('.') && clean.includes(',')) {
                    clean = clean.replace(/\./g, '').replace(',', '.')
                  } else if (clean.includes(',')) {
                    clean = clean.replace(',', '.')
                  }
                  const num = parseFloat(clean)
                  setUnitPrice(isNaN(num) || num < 0 ? 0 : num)
                }}
                onBlur={() => {
                  if (unitPrice > 0) {
                    setUnitPriceInput(
                      unitPrice.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }),
                    )
                  } else if (!unitPriceInput.trim()) {
                    setUnitPrice(0)
                    setUnitPriceInput('')
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSave()
                  }
                }}
                placeholder="0,00"
                className="h-9 text-sm font-mono font-bold text-slate-900 bg-white"
              />
              <span className="text-[10px] text-slate-400 block">
                Valor anterior: R$ {(item.unit_price || 0).toFixed(2)}
              </span>
            </div>

            {/* Quantidade */}
            <div className="space-y-1.5">
              <label
                htmlFor="edit-order-item-qty"
                className="text-xs font-semibold text-slate-700 block"
              >
                Quantidade *
              </label>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 p-0 text-slate-600 bg-white"
                  disabled={quantity <= 1 || saving}
                  onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                >
                  -
                </Button>
                <Input
                  id="edit-order-item-qty"
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10)
                    setQuantity(isNaN(val) || val < 1 ? 1 : val)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleSave()
                    }
                  }}
                  className="h-9 flex-1 text-center font-bold font-mono text-sm px-1 bg-white"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 p-0 text-slate-600 bg-white"
                  disabled={saving}
                  onClick={() => setQuantity((prev) => prev + 1)}
                >
                  +
                </Button>
              </div>
              <span className="text-[10px] text-slate-400 block text-right">
                Qtd anterior: {item.quantity || 1}
              </span>
            </div>
          </div>

          {/* Subtotal Calculado */}
          <div className="flex items-center justify-between p-3 bg-indigo-50/60 rounded-lg border border-indigo-100">
            <div>
              <span className="text-[10px] uppercase font-bold text-indigo-900/70 block">
                Novo Subtotal do Item
              </span>
              <span className="text-[11px] text-indigo-700">
                {validQty} × R$ {validUnitPrice.toFixed(2)}
              </span>
            </div>
            <div className="text-right">
              <span className="font-mono font-bold text-lg text-indigo-700">
                R$ {calculatedSubtotal.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="text-xs h-9"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 px-4 font-semibold gap-1.5 shadow-xs"
          >
            <Edit3 className="h-3.5 w-3.5" />
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
