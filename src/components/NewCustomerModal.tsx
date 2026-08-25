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
import { createCustomer, updateCustomer } from '@/services/customers'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors } from '@/lib/pocketbase/errors'
import { Customer } from '@/types'

interface NewCustomerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (customer?: Customer) => void
  editCustomer?: Customer | null
}

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  cpf_cnpj: '',
  street: '',
  number: '',
  city: '',
  state: '',
  zip: '',
  notes: '',
}

export function NewCustomerModal({
  open,
  onOpenChange,
  onCreated,
  editCustomer,
}: NewCustomerModalProps) {
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { toast } = useToast()
  const isEdit = !!editCustomer
  const [formData, setFormData] = useState(emptyForm)

  useEffect(() => {
    if (open) {
      setErrors({})
      if (editCustomer) {
        setFormData({
          name: editCustomer.name || '',
          email: editCustomer.email || '',
          phone: editCustomer.phone || '',
          cpf_cnpj: editCustomer.cpf_cnpj || '',
          street: editCustomer.street || '',
          number: editCustomer.number || '',
          city: editCustomer.city || '',
          state: editCustomer.state || '',
          zip: editCustomer.zip || '',
          notes: editCustomer.notes || '',
        })
      } else {
        setFormData(emptyForm)
      }
    }
  }, [open, editCustomer])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    if (!formData.name.trim() || !formData.phone.trim()) {
      setErrors({
        name: !formData.name.trim() ? 'Nome é obrigatório' : '',
        phone: !formData.phone.trim() ? 'Telefone é obrigatório' : '',
      })
      return
    }
    setLoading(true)
    try {
      let saved: Customer | undefined
      if (isEdit && editCustomer) {
        saved = await updateCustomer(editCustomer.id, formData)
        toast({ title: 'Cliente atualizado!', description: formData.name })
      } else {
        saved = await createCustomer(formData)
        toast({ title: 'Cliente cadastrado!', description: formData.name })
      }
      onOpenChange(false)
      if (onCreated) onCreated(saved)
    } catch (err) {
      setErrors(extractFieldErrors(err))
      toast({
        title: isEdit ? 'Erro ao atualizar cliente' : 'Erro ao cadastrar cliente',
        description: 'Verifique as informações prestadas.',
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
            {isEdit ? 'Editar Cliente' : 'Novo Cliente'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700">
              Nome Completo / Razão Social *
            </Label>
            <Input
              placeholder="Ex: João da Silva ou Empresa X"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="h-9 text-xs"
            />
            {errors.name && <p className="text-[11px] text-red-500">{errors.name}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Telefone / WhatsApp *</Label>
              <Input
                placeholder="(11) 99999-9999"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="h-9 text-xs"
              />
              {errors.phone && <p className="text-[11px] text-red-500">{errors.phone}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">CPF / CNPJ</Label>
              <Input
                placeholder="000.000.000-00 ou CNPJ"
                value={formData.cpf_cnpj}
                onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value })}
                className="h-9 text-xs"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700">E-mail</Label>
            <Input
              type="email"
              placeholder="cliente@email.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="h-9 text-xs"
            />
            {errors.email && <p className="text-[11px] text-red-500">{errors.email}</p>}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Rua / Logradouro</Label>
              <Input
                placeholder="Av. Paulista"
                value={formData.street}
                onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Número</Label>
              <Input
                placeholder="1000"
                value={formData.number}
                onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                className="h-9 text-xs"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Cidade</Label>
              <Input
                placeholder="São Paulo"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Estado (UF)</Label>
              <Input
                placeholder="SP"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">CEP</Label>
              <Input
                placeholder="01000-000"
                value={formData.zip}
                onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                className="h-9 text-xs"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700">Observações do Cliente</Label>
            <Textarea
              placeholder="Anotações internas..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
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
              {loading ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Salvar Cliente'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
