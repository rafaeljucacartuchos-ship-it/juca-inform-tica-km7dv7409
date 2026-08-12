import { useState, useEffect } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Customer, User, OrderPriority } from '@/types'
import { getCustomers } from '@/services/customers'
import { getTechnicians } from '@/services/users'
import { createServiceOrder, addStatusHistory } from '@/services/service_orders'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors } from '@/lib/pocketbase/errors'

interface NewOrderModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
}

export function NewOrderModal({ open, onOpenChange, onCreated }: NewOrderModalProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [technicians, setTechnicians] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { user } = useAuth()
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    customer: '',
    technician: '',
    title: '',
    equipment: '',
    description: '',
    priority: 'medium' as OrderPriority,
    estimated_cost: '',
  })

  useEffect(() => {
    if (open) {
      getCustomers()
        .then(setCustomers)
        .catch(() => {})
      getTechnicians()
        .then(setTechnicians)
        .catch(() => {})
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    if (!formData.customer) {
      setErrors((prev) => ({ ...prev, customer: 'Selecione um cliente' }))
      return
    }
    if (!formData.title) {
      setErrors((prev) => ({ ...prev, title: 'Informe o título da ordem' }))
      return
    }

    setLoading(true)
    try {
      const created = await createServiceOrder({
        customer: formData.customer,
        technician: formData.technician || undefined,
        title: formData.title,
        equipment: formData.equipment,
        description: formData.description,
        priority: formData.priority,
        status: 'open',
        estimated_cost: formData.estimated_cost ? Number(formData.estimated_cost) : 0,
        total: formData.estimated_cost ? Number(formData.estimated_cost) : 0,
      })

      await addStatusHistory({
        service_order: created.id,
        status: 'open',
        note: 'Ordem de serviço criada no sistema',
        changed_by: user?.id,
      })

      toast({
        title: 'Ordem criada com sucesso!',
        description: `Ordem ${created.number || ''} aberta no sistema.`,
      })

      setFormData({
        customer: '',
        technician: '',
        title: '',
        equipment: '',
        description: '',
        priority: 'medium',
        estimated_cost: '',
      })
      onOpenChange(false)
      if (onCreated) onCreated()
    } catch (err) {
      setErrors(extractFieldErrors(err))
      toast({
        title: 'Erro ao criar ordem de serviço',
        description: 'Verifique os campos e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">
            Nova Ordem de Serviço
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Cliente *</Label>
            <Select
              value={formData.customer}
              onValueChange={(val) => setFormData({ ...formData, customer: val })}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    {c.name} {c.phone ? `(${c.phone})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.customer && <p className="text-[11px] text-red-500">{errors.customer}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Técnico Responsável</Label>
              <Select
                value={formData.technician}
                onValueChange={(val) => setFormData({ ...formData, technician: val })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Sem técnico" />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Prioridade</Label>
              <Select
                value={formData.priority}
                onValueChange={(val: OrderPriority) => setFormData({ ...formData, priority: val })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low" className="text-xs">
                    Baixa
                  </SelectItem>
                  <SelectItem value="medium" className="text-xs">
                    Média
                  </SelectItem>
                  <SelectItem value="high" className="text-xs">
                    Alta
                  </SelectItem>
                  <SelectItem value="urgent" className="text-xs">
                    Urgente
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">
              Título / Serviço Principal *
            </Label>
            <Input
              placeholder="Ex: Formatação e Limpeza de Notebook"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="h-9 text-xs"
            />
            {errors.title && <p className="text-[11px] text-red-500">{errors.title}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Equipamento / Modelo</Label>
              <Input
                placeholder="Ex: Dell Inspiron 15"
                value={formData.equipment}
                onChange={(e) => setFormData({ ...formData, equipment: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Custo Estimado (R$)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={formData.estimated_cost}
                onChange={(e) => setFormData({ ...formData, estimated_cost: e.target.value })}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">
              Descrição do Problema / Relato do Cliente
            </Label>
            <Textarea
              placeholder="Descreva o problema relatado..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="text-xs"
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
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {loading ? 'Criando...' : 'Criar Ordem'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
