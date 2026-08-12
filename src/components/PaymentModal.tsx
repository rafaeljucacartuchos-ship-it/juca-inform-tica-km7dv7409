import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PaymentMethod } from '@/types'
import { createPayment } from '@/services/payments'
import { useToast } from '@/hooks/use-toast'

interface PaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  defaultAmount?: number
  onSaved?: () => void
}

export function PaymentModal({
  open,
  onOpenChange,
  orderId,
  defaultAmount = 0,
  onSaved,
}: PaymentModalProps) {
  const [amount, setAmount] = useState(defaultAmount ? String(defaultAmount) : '')
  const [method, setMethod] = useState<PaymentMethod>('pix')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'Informe um valor maior que zero.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      await createPayment({
        service_order: orderId,
        amount: Number(amount),
        method,
        status: 'paid',
        paid_at: new Date().toISOString().substring(0, 10) + ' 00:00:00.000Z',
        notes,
      })

      toast({
        title: 'Pagamento registrado!',
        description: `R$ ${Number(amount).toFixed(2)} recebido via ${method.toUpperCase()}.`,
      })

      onOpenChange(false)
      if (onSaved) onSaved()
    } catch (err) {
      toast({
        title: 'Erro ao registrar pagamento',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">
            Registrar Pagamento
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Valor Recebido (R$) *</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="h-9 text-xs font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Forma de Pagamento *</Label>
            <Select value={method} onValueChange={(val: PaymentMethod) => setMethod(val)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pix" className="text-xs">
                  Pix
                </SelectItem>
                <SelectItem value="credit_card" className="text-xs">
                  Cartão de Crédito
                </SelectItem>
                <SelectItem value="debit_card" className="text-xs">
                  Cartão de Débito
                </SelectItem>
                <SelectItem value="cash" className="text-xs">
                  Dinheiro em Espécie
                </SelectItem>
                <SelectItem value="transfer" className="text-xs">
                  Transferência BCN / TED
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Observação / Comprovante</Label>
            <Input
              placeholder="Ex: Transação ID #12345"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {loading ? 'Gravando...' : 'Confirmar Pagamento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
