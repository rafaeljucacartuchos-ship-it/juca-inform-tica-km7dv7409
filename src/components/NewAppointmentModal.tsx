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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Customer, User } from '@/types'
import { getCustomers } from '@/services/customers'
import { getTechnicians } from '@/services/users'
import { formatPhone } from '@/lib/phones'
import { createAppointment } from '@/services/appointments'
import { createServiceOrder, addStatusHistory } from '@/services/service_orders'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'

interface NewAppointmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultDate?: string
  onCreated?: () => void
}

export function NewAppointmentModal({
  open,
  onOpenChange,
  defaultDate,
  onCreated,
}: NewAppointmentModalProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [technicians, setTechnicians] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()
  const { toast } = useToast()

  const todayStr = defaultDate || new Date().toISOString().substring(0, 10)

  const [formData, setFormData] = useState({
    customer: '',
    technician: '',
    date: todayStr,
    start_time: '09:00',
    end_time: '10:00',
    address_note: '',
    notes: '',
    createLinkedOrder: true,
  })

  useEffect(() => {
    if (open) {
      getCustomers()
        .then(setCustomers)
        .catch(() => {})
      getTechnicians()
        .then(setTechnicians)
        .catch(() => {})
      if (defaultDate) {
        setFormData((prev) => ({ ...prev, date: defaultDate }))
      }
    }
  }, [open, defaultDate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.customer || !formData.technician || !formData.date) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Selecione o cliente, o técnico e a data da visita.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const dateIso = `${formData.date} 00:00:00.000Z`
      const appt = await createAppointment({
        customer: formData.customer,
        technician: formData.technician,
        date: dateIso,
        start_time: formData.start_time,
        end_time: formData.end_time,
        status: 'scheduled',
        address_note: formData.address_note,
        notes: formData.notes,
      })

      if (formData.createLinkedOrder) {
        const cust = customers.find((c) => c.id === formData.customer)
        const order = await createServiceOrder({
          customer: formData.customer,
          technician: formData.technician,
          appointment: appt.id,
          title: `Visita Técnica - ${cust?.name || 'Cliente'}`,
          description: formData.notes || 'Atendimento técnico agendado.',
          status: 'open',
          priority: 'medium',
        })

        await addStatusHistory({
          service_order: order.id,
          status: 'open',
          note: 'Ordem de serviço vinculada ao agendamento criada automaticamente',
          changed_by: user?.id,
        })
      }

      toast({
        title: 'Agendamento cadastrado!',
        description: 'O agendamento foi salvo na agenda.',
      })

      onOpenChange(false)
      if (onCreated) onCreated()
    } catch (err) {
      toast({
        title: 'Erro ao agendar',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">
            Novo Agendamento Técnico
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
                {customers.map((c) => {
                  const displayName = c.razao_social || c.nome_fantasia || c.name || 'Cliente'
                  const rawPhone = c.celular || c.phone
                  const phone = rawPhone ? formatPhone(rawPhone) : ''
                  return (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {displayName} {phone ? `(${phone})` : ''}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Técnico Designado *</Label>
            <Select
              value={formData.technician}
              onValueChange={(val) => setFormData({ ...formData, technician: val })}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Selecione o técnico" />
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

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Data *</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Início</Label>
              <Input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Fim</Label>
              <Input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">
              Observações de Endereço / Acesso
            </Label>
            <Input
              placeholder="Ex: Interfona no bloco B / Procurar por Sr. Marcos"
              value={formData.address_note}
              onChange={(e) => setFormData({ ...formData, address_note: e.target.value })}
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Detalhes do Agendamento</Label>
            <Textarea
              placeholder="Descreva o objetivo da visita..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="text-xs"
            />
          </div>

          <div className="flex items-center space-x-2 pt-1">
            <Checkbox
              id="linkedOrder"
              checked={formData.createLinkedOrder}
              onCheckedChange={(chk) => setFormData({ ...formData, createLinkedOrder: !!chk })}
            />
            <label
              htmlFor="linkedOrder"
              className="text-xs font-medium text-slate-700 cursor-pointer"
            >
              Criar ordem de serviço vinculada automaticamente
            </label>
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
              {loading ? 'Salvando...' : 'Confirmar Agendamento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
