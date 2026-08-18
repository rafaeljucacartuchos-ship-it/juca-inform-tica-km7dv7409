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
import { Plus } from 'lucide-react'
import { Customer, User, OrderPriority, Equipment } from '@/types'
import { getCustomers } from '@/services/customers'
import { getTechnicians } from '@/services/users'
import { getEquipmentByCustomer } from '@/services/equipment'
import { createAppointment } from '@/services/appointments'
import { NewEquipmentModal } from '@/components/NewEquipmentModal'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors } from '@/lib/pocketbase/errors'
import { offlinePb } from '@/lib/offline-pb'

interface NewOrderModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
}

export function NewOrderModal({ open, onOpenChange, onCreated }: NewOrderModalProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [technicians, setTechnicians] = useState<User[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [equipmentModalOpen, setEquipmentModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { user } = useAuth()
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    customer: '',
    technician: '',
    attendance_date: '',
    attendance_time: '',
    equipment_ref: '',
    title: '',
    description: '',
    priority: 'medium' as OrderPriority,
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

  useEffect(() => {
    if (formData.customer) {
      getEquipmentByCustomer(formData.customer)
        .then(setEquipment)
        .catch(() => setEquipment([]))
    } else {
      setEquipment([])
    }
  }, [formData.customer])

  const refreshEquipment = () => {
    if (formData.customer) {
      getEquipmentByCustomer(formData.customer)
        .then(setEquipment)
        .catch(() => {})
    }
  }

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
    if (!formData.attendance_date) {
      setErrors((prev) => ({ ...prev, attendance_date: 'Informe a data do atendimento' }))
      return
    }
    if (!formData.attendance_time) {
      setErrors((prev) => ({ ...prev, attendance_time: 'Informe o horário do atendimento' }))
      return
    }

    setLoading(true)
    try {
      const appointment = await createAppointment({
        customer: formData.customer,
        technician: formData.technician || user?.id || '',
        date: formData.attendance_date,
        start_time: formData.attendance_time,
        status: 'scheduled',
      })

      const eqItem = equipment.find((eq) => eq.id === formData.equipment_ref)
      const created = await offlinePb.create('service_orders', {
        customer: formData.customer,
        technician: formData.technician || undefined,
        appointment: appointment.id,
        equipment_ref: formData.equipment_ref || undefined,
        equipment: eqItem
          ? `${eqItem.name}${eqItem.brand ? ' - ' + eqItem.brand : ''}${eqItem.model ? ' ' + eqItem.model : ''}`
          : '',
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        status: 'open',
        total: 0,
      })

      const hist = await offlinePb.create('status_history', {
        service_order: created.id,
        status: 'open',
        note: 'Ordem de serviço criada no sistema',
        changed_by: user?.id,
      })

      if (created.queued || hist.queued) {
        toast({
          title: 'Ordem salva localmente',
          description: 'Será sincronizada quando houver conexão.',
        })
      } else {
        toast({
          title: 'Ordem criada com sucesso!',
          description: `Ordem aberta no sistema.`,
        })
      }

      setFormData({
        customer: '',
        technician: '',
        attendance_date: '',
        attendance_time: '',
        equipment_ref: '',
        title: '',
        description: '',
        priority: 'medium',
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
    <>
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
                onValueChange={(val) =>
                  setFormData({ ...formData, customer: val, equipment_ref: '' })
                }
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
                  onValueChange={(val: OrderPriority) =>
                    setFormData({ ...formData, priority: val })
                  }
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Data do Atendimento *
                </Label>
                <Input
                  type="date"
                  value={formData.attendance_date}
                  onChange={(e) => setFormData({ ...formData, attendance_date: e.target.value })}
                  className="h-9 text-xs"
                />
                {errors.attendance_date && (
                  <p className="text-[11px] text-red-500">{errors.attendance_date}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Horário do Atendimento *
                </Label>
                <Input
                  type="time"
                  value={formData.attendance_time}
                  onChange={(e) => setFormData({ ...formData, attendance_time: e.target.value })}
                  className="h-9 text-xs"
                />
                {errors.attendance_time && (
                  <p className="text-[11px] text-red-500">{errors.attendance_time}</p>
                )}
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

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700">
                  Equipamento do Cliente
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEquipmentModalOpen(true)}
                  disabled={!formData.customer}
                  className="h-7 text-[11px] text-indigo-600 hover:text-indigo-700 p-0"
                >
                  <Plus className="h-3 w-3 mr-0.5" /> Cadastrar Novo
                </Button>
              </div>
              <Select
                value={formData.equipment_ref}
                onValueChange={(val) => setFormData({ ...formData, equipment_ref: val })}
                disabled={!formData.customer}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue
                    placeholder={
                      formData.customer
                        ? 'Selecione o equipamento'
                        : 'Selecione um cliente primeiro'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {equipment.map((eq) => (
                    <SelectItem key={eq.id} value={eq.id} className="text-xs">
                      {eq.name}
                      {eq.brand ? ` - ${eq.brand}` : ''}
                      {eq.model ? ` ${eq.model}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.customer && equipment.length === 0 && (
                <p className="text-[11px] text-amber-600">
                  Nenhum equipamento cadastrado. Clique em "Cadastrar Novo" para adicionar.
                </p>
              )}
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

      <NewEquipmentModal
        open={equipmentModalOpen}
        onOpenChange={setEquipmentModalOpen}
        onCreated={refreshEquipment}
        defaultCustomerId={formData.customer}
      />
    </>
  )
}
