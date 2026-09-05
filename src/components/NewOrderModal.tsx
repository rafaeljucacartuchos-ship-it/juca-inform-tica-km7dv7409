import { useState, useEffect, useRef } from 'react'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Check, ChevronsUpDown, Loader2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Customer, User, OrderPriority, Equipment, ServiceType } from '@/types'
import { getCustomers, getCustomer } from '@/services/customers'
import { getTechnicians } from '@/services/users'
import { formatPhone } from '@/lib/phones'
import { getEquipmentByCustomer } from '@/services/equipment'
import { createAppointment } from '@/services/appointments'
import { getServiceTypes } from '@/services/service_types'
import { NewEquipmentModal } from '@/components/NewEquipmentModal'
import { NewCustomerModal } from '@/components/NewCustomerModal'
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
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [comboboxOpen, setComboboxOpen] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [techComboboxOpen, setTechComboboxOpen] = useState(false)
  const [technicians, setTechnicians] = useState<User[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [customerModalOpen, setCustomerModalOpen] = useState(false)
  const [equipmentModalOpen, setEquipmentModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { user } = useAuth()
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    customer: '',
    technician: '',
    attendance_type: '',
    attendance_date: '',
    attendance_time: '',
    equipment_ref: '',
    title: '',
    description: '',
    priority: 'medium' as OrderPriority,
    desconto: 0,
    acrescimo: 0,
  })

  // Carrega clientes iniciais e técnicos ao abrir o modal
  useEffect(() => {
    if (open) {
      setIsSearchingCustomers(true)
      getCustomers('')
        .then((items) => {
          setCustomers(items)
        })
        .catch(() => {})
        .finally(() => setIsSearchingCustomers(false))

      getTechnicians()
        .then(setTechnicians)
        .catch(() => {})

      getServiceTypes(true)
        .then((types) => {
          setServiceTypes(types)
          if (types.length > 0) {
            setFormData((prev) => {
              if (prev.attendance_type) return prev
              const balcao = types.find((t) => t.name.trim().toLowerCase() === 'balcão')
              return { ...prev, attendance_type: balcao ? balcao.id : types[0].id }
            })
          }
        })
        .catch(() => {})
    } else {
      setCustomerSearch('')
      setComboboxOpen(false)
      setTechComboboxOpen(false)
    }
  }, [open])

  // Busca de clientes com debounce de 300ms
  useEffect(() => {
    if (!open) return

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    setIsSearchingCustomers(true)
    debounceTimerRef.current = setTimeout(() => {
      getCustomers(customerSearch)
        .then((items) => {
          setCustomers(items)
        })
        .catch(() => {})
        .finally(() => {
          setIsSearchingCustomers(false)
        })
    }, 300)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [customerSearch, open])

  // Mantém selectedCustomer sincronizado
  useEffect(() => {
    if (!formData.customer) {
      setSelectedCustomer(null)
      return
    }
    const found = customers.find((c) => c.id === formData.customer)
    if (found) {
      setSelectedCustomer(found)
    } else if (!selectedCustomer || selectedCustomer.id !== formData.customer) {
      getCustomer(formData.customer)
        .then((cust) => setSelectedCustomer(cust))
        .catch(() => {})
    }
  }, [formData.customer, customers])

  const handleCustomerCreated = async (newCust?: Customer) => {
    try {
      if (newCust?.id) {
        setSelectedCustomer(newCust)
        setFormData((prev) => ({ ...prev, customer: newCust.id, equipment_ref: '' }))
      }
      const data = await getCustomers(customerSearch)
      setCustomers(data)
    } catch {
      /* ignored */
    }
  }

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

  const selectedServiceType = serviceTypes.find((st) => st.id === formData.attendance_type)
  const isBalcao =
    selectedServiceType?.name?.trim().toLowerCase() === 'balcão' ||
    (!formData.attendance_type && serviceTypes.length === 0)

  const handleTimeChange = (rawValue: string) => {
    const digits = rawValue.replace(/\D/g, '').slice(0, 4)
    let formatted = digits
    if (digits.length >= 3) {
      formatted = `${digits.slice(0, 2)}:${digits.slice(2, 4)}`
    } else if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}:${digits.slice(2)}`
    }

    setFormData((prev) => ({ ...prev, attendance_time: formatted }))

    if (errors.attendance_time) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next.attendance_time
        return next
      })
    }

    if (formatted.length === 5) {
      const [hStr, mStr] = formatted.split(':')
      const h = parseInt(hStr, 10)
      const m = parseInt(mStr, 10)
      if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
        setErrors((prev) => ({
          ...prev,
          attendance_time: 'Horário inválido. Use um horário entre 00:00 e 23:59',
        }))
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    if (!formData.customer) {
      setErrors((prev) => ({ ...prev, customer: 'Selecione um cliente' }))
      return
    }
    if (isBalcao && !formData.equipment_ref) {
      setErrors((prev) => ({
        ...prev,
        equipment_ref: 'Equipamento é obrigatório para atendimento do tipo Balcão',
      }))
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

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/
    if (!timeRegex.test(formData.attendance_time)) {
      setErrors((prev) => ({
        ...prev,
        attendance_time: 'Horário inválido. Formato esperado: HH:MM (00:00 a 23:59)',
      }))
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
        attendance_type: formData.attendance_type || undefined,
        equipment_ref: formData.equipment_ref || undefined,
        equipment: eqItem
          ? `${eqItem.name}${eqItem.brand ? ' - ' + eqItem.brand : ''}${eqItem.model ? ' ' + eqItem.model : ''}`
          : '',
        attendance_date: formData.attendance_date || undefined,
        attendance_time: formData.attendance_time || undefined,
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        status: 'open',
        desconto: Number(formData.desconto) || 0,
        acrescimo: Number(formData.acrescimo) || 0,
        total: Math.max(0, (Number(formData.acrescimo) || 0) - (Number(formData.desconto) || 0)),
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

      const balcaoDefault = serviceTypes.find((t) => t.name.trim().toLowerCase() === 'balcão')
      setFormData({
        customer: '',
        technician: '',
        attendance_type: balcaoDefault ? balcaoDefault.id : serviceTypes[0]?.id || '',
        attendance_date: '',
        attendance_time: '',
        equipment_ref: '',
        title: '',
        description: '',
        priority: 'medium',
        desconto: 0,
        acrescimo: 0,
      })
      setSelectedCustomer(null)
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

  const selectedDisplayName = selectedCustomer
    ? selectedCustomer.nome_fantasia ||
      selectedCustomer.razao_social ||
      selectedCustomer.name ||
      'Cliente Selecionado'
    : ''
  const selectedPhone =
    selectedCustomer?.celular || selectedCustomer?.phone
      ? formatPhone(selectedCustomer?.celular || selectedCustomer?.phone)
      : ''

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-full max-w-full sm:max-w-[560px] h-[100dvh] sm:h-auto max-h-[var(--app-visible-height,100dvh)] sm:max-h-[90vh] p-0 flex flex-col rounded-none sm:rounded-lg overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2 sm:px-6 sm:pt-6 shrink-0 border-b border-slate-100">
            <DialogTitle className="text-lg font-bold text-slate-900">
              Nova Ordem de Serviço
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-700">Cliente *</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCustomerModalOpen(true)}
                    className="h-6 text-[11px] text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-1.5 gap-1"
                    title="Cadastrar novo cliente rapidamente"
                  >
                    <Plus className="h-3 w-3" /> Novo Cliente
                  </Button>
                </div>
                <div className="flex gap-1.5">
                  <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={comboboxOpen}
                        className={cn(
                          'h-9 text-xs flex-1 justify-between font-normal px-3 bg-white border-slate-200 hover:bg-slate-50',
                          !formData.customer && 'text-slate-400',
                        )}
                      >
                        <span className="truncate text-left">
                          {formData.customer && selectedCustomer
                            ? `${selectedDisplayName}${selectedPhone ? ` (${selectedPhone})` : ''}`
                            : 'Selecione ou digite para buscar o cliente...'}
                        </span>
                        <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[--radix-popover-trigger-width] p-0 shadow-lg max-h-60 overflow-hidden"
                      align="start"
                    >
                      <Command shouldFilter={false} className="max-h-60 flex flex-col">
                        <CommandInput
                          placeholder="Digite o nome do cliente..."
                          value={customerSearch}
                          onValueChange={setCustomerSearch}
                          className="h-9 text-xs shrink-0"
                        />
                        <CommandList className="max-h-48 overflow-y-auto">
                          {isSearchingCustomers && (
                            <div className="flex items-center justify-center p-4 text-xs text-slate-400 gap-1.5">
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                              <span>Buscando clientes...</span>
                            </div>
                          )}
                          {!isSearchingCustomers && customers.length === 0 && (
                            <CommandEmpty className="py-4 text-center text-xs text-slate-500">
                              Nenhum cliente encontrado.
                            </CommandEmpty>
                          )}
                          <CommandGroup>
                            {customers.map((c) => {
                              const displayName =
                                c.nome_fantasia || c.razao_social || c.name || 'Cliente'
                              const rawPhone = c.celular || c.phone
                              const phone = rawPhone ? formatPhone(rawPhone) : ''
                              const isSelected = formData.customer === c.id
                              const showSecondaryCode =
                                Boolean(c.nome_fantasia) &&
                                Boolean(c.razao_social) &&
                                c.nome_fantasia?.trim() !== c.razao_social?.trim()

                              return (
                                <CommandItem
                                  key={c.id}
                                  value={c.id}
                                  onSelect={() => {
                                    setFormData((prev) => ({
                                      ...prev,
                                      customer: c.id,
                                      equipment_ref: '',
                                    }))
                                    setSelectedCustomer(c)
                                    setComboboxOpen(false)
                                  }}
                                  className="text-xs cursor-pointer flex items-center justify-between py-2"
                                >
                                  <div className="flex flex-col min-w-0 pr-2">
                                    <span className="font-bold text-slate-900 truncate">
                                      {displayName}
                                    </span>
                                    {(showSecondaryCode || phone) && (
                                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                        {showSecondaryCode && (
                                          <span className="truncate">{c.razao_social}</span>
                                        )}
                                        {showSecondaryCode && phone && <span>•</span>}
                                        {phone && <span className="font-mono">{phone}</span>}
                                      </div>
                                    )}
                                  </div>
                                  <Check
                                    className={cn(
                                      'h-4 w-4 shrink-0 text-indigo-600',
                                      isSelected ? 'opacity-100' : 'opacity-0',
                                    )}
                                  />
                                </CommandItem>
                              )
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCustomerModalOpen(true)}
                    className="h-9 px-2.5 shrink-0 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-medium"
                    title="Cadastrar Novo Cliente"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Novo
                  </Button>
                </div>
                {errors.customer && <p className="text-[11px] text-red-500">{errors.customer}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-700">
                      Tipo de Atendimento
                    </Label>
                    {isBalcao ? (
                      <span className="text-[10px] text-amber-600 font-medium bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        Balcão (Exige Eq.)
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-medium">Eq. opcional</span>
                    )}
                  </div>
                  <Select
                    value={formData.attendance_type}
                    onValueChange={(val) => setFormData({ ...formData, attendance_type: val })}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Selecione o tipo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {serviceTypes.map((st) => (
                        <SelectItem key={st.id} value={st.id} className="text-xs">
                          {st.name}
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

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Técnico Responsável</Label>
                <Popover open={techComboboxOpen} onOpenChange={setTechComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={techComboboxOpen}
                      className={cn(
                        'w-full h-9 text-xs justify-between font-normal px-3 bg-white border-slate-200 hover:bg-slate-50',
                        !formData.technician && 'text-slate-400',
                      )}
                    >
                      <span className="truncate text-left">
                        {formData.technician
                          ? technicians.find((t) => t.id === formData.technician)?.name ||
                            'Técnico selecionado'
                          : 'Sem técnico'}
                      </span>
                      <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[--radix-popover-trigger-width] p-0 shadow-lg max-h-60 overflow-hidden"
                    align="start"
                  >
                    <Command className="max-h-60 flex flex-col">
                      <CommandInput
                        placeholder="Buscar técnico..."
                        className="h-9 text-xs shrink-0"
                      />
                      <CommandList className="max-h-48 overflow-y-auto">
                        <CommandEmpty className="py-4 text-center text-xs text-slate-500">
                          Nenhum técnico encontrado.
                        </CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="__none__"
                            onSelect={() => {
                              setFormData((prev) => ({ ...prev, technician: '' }))
                              setTechComboboxOpen(false)
                            }}
                            className="text-xs cursor-pointer flex items-center justify-between py-2"
                          >
                            <span className="text-slate-500 italic">Sem técnico</span>
                            <Check
                              className={cn(
                                'h-4 w-4 shrink-0 text-indigo-600',
                                !formData.technician ? 'opacity-100' : 'opacity-0',
                              )}
                            />
                          </CommandItem>
                          {technicians.map((t) => {
                            const isSelected = formData.technician === t.id
                            return (
                              <CommandItem
                                key={t.id}
                                value={t.name || t.id}
                                onSelect={() => {
                                  setFormData((prev) => ({ ...prev, technician: t.id }))
                                  setTechComboboxOpen(false)
                                }}
                                className="text-xs cursor-pointer flex items-center justify-between py-2"
                              >
                                <span className="font-medium text-slate-900 truncate">
                                  {t.name}
                                </span>
                                <Check
                                  className={cn(
                                    'h-4 w-4 shrink-0 text-indigo-600',
                                    isSelected ? 'opacity-100' : 'opacity-0',
                                  )}
                                />
                              </CommandItem>
                            )
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
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
                    type="text"
                    inputMode="numeric"
                    placeholder="HH:MM"
                    maxLength={5}
                    value={formData.attendance_time}
                    onChange={(e) => handleTimeChange(e.target.value)}
                    className="h-9 text-xs font-mono"
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
                    Equipamento do Cliente {isBalcao ? '*' : '(Opcional no cadastro)'}
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
                  onValueChange={(val) => {
                    setFormData({ ...formData, equipment_ref: val })
                    if (errors.equipment_ref) {
                      setErrors((prev) => {
                        const next = { ...prev }
                        delete next.equipment_ref
                        return next
                      })
                    }
                  }}
                  disabled={!formData.customer}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue
                      placeholder={
                        formData.customer
                          ? isBalcao
                            ? 'Selecione o equipamento (obrigatório)'
                            : 'Selecione o equipamento (ou deixe em branco)'
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
                {errors.equipment_ref && (
                  <p className="text-[11px] text-red-500">{errors.equipment_ref}</p>
                )}
                {formData.customer && equipment.length === 0 && (
                  <p className="text-[11px] text-amber-600">
                    {isBalcao
                      ? 'Nenhum equipamento cadastrado. Clique em "Cadastrar Novo" para adicionar (obrigatório para Balcão).'
                      : 'Nenhum equipamento cadastrado. (Opcional para este tipo de atendimento)'}
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

              {/* Campos de Desconto e Acréscimo */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-3">
                <span className="text-xs font-bold text-slate-800 block">
                  Ajustes Financeiros Iniciais
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Desconto (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={formData.desconto === 0 ? '' : formData.desconto}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          desconto:
                            e.target.value === ''
                              ? 0
                              : Math.max(0, parseFloat(e.target.value) || 0),
                        })
                      }
                      className="h-9 text-xs font-mono bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Acréscimo (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={formData.acrescimo === 0 ? '' : formData.acrescimo}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          acrescimo:
                            e.target.value === ''
                              ? 0
                              : Math.max(0, parseFloat(e.target.value) || 0),
                        })
                      }
                      className="h-9 text-xs font-mono bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-100 shrink-0 bg-slate-50/50 flex flex-row items-center justify-end gap-2">
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

      <NewCustomerModal
        open={customerModalOpen}
        onOpenChange={setCustomerModalOpen}
        onCreated={handleCustomerCreated}
      />

      <NewEquipmentModal
        open={equipmentModalOpen}
        onOpenChange={setEquipmentModalOpen}
        onCreated={(created) => {
          refreshEquipment()
          if (created?.id) {
            setFormData((prev) => ({ ...prev, equipment_ref: created.id }))
          }
        }}
        defaultCustomerId={formData.customer}
      />
    </>
  )
}
