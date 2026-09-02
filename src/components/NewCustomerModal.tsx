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
import { createCustomer, updateCustomer } from '@/services/customers'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors } from '@/lib/pocketbase/errors'
import { formatPhone, maskPhoneInput } from '@/lib/phones'
import { Customer } from '@/types'

interface NewCustomerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (customer?: Customer) => void
  editCustomer?: Customer | null
}

const emptyForm = {
  razao_social: '',
  nome_fantasia: '',
  endereco: '',
  bairro: '',
  celular: '',
  rg_ie: '',
  cpf_cnpj: '',
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
          razao_social: editCustomer.razao_social || editCustomer.name || '',
          nome_fantasia: editCustomer.nome_fantasia || editCustomer.name || '',
          endereco: editCustomer.endereco || editCustomer.street || '',
          bairro: editCustomer.bairro || '',
          celular: formatPhone(editCustomer.celular || editCustomer.phone || ''),
          rg_ie: editCustomer.rg_ie || '',
          cpf_cnpj: editCustomer.cpf_cnpj || '',
        })
      } else {
        setFormData(emptyForm)
      }
    }
  }, [open, editCustomer])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    const primaryName = formData.razao_social.trim() || formData.nome_fantasia.trim()
    if (!primaryName) {
      setErrors({
        razao_social: 'Razão Social ou Nome Fantasia é obrigatório',
      })
      return
    }

    setLoading(true)
    try {
      let saved: Customer | undefined
      const payload = {
        razao_social: formData.razao_social.trim() || formData.nome_fantasia.trim(),
        nome_fantasia: formData.nome_fantasia.trim() || formData.razao_social.trim(),
        endereco: formData.endereco.trim(),
        bairro: formData.bairro.trim(),
        celular: formData.celular.trim(),
        rg_ie: formData.rg_ie.trim(),
        cpf_cnpj: formData.cpf_cnpj.trim(),
      }

      if (isEdit && editCustomer) {
        saved = await updateCustomer(editCustomer.id, payload)
        toast({
          title: 'Cliente atualizado com sucesso!',
          description: (payload.razao_social || payload.nome_fantasia) ?? undefined,
        })
      } else {
        saved = await createCustomer(payload)
        toast({
          title: 'Cliente cadastrado com sucesso!',
          description: (payload.razao_social || payload.nome_fantasia) ?? undefined,
        })
      }
      onOpenChange(false)
      if (onCreated) onCreated(saved)
    } catch (err) {
      setErrors(extractFieldErrors(err))
      toast({
        title: isEdit ? 'Erro ao atualizar cliente' : 'Erro ao cadastrar cliente',
        description: 'Verifique as informações preenchidas e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-full sm:max-w-[520px] h-full sm:h-auto max-h-screen sm:max-h-[90vh] rounded-none sm:rounded-lg overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">
            {isEdit ? 'Editar Cliente' : 'Novo Cliente'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3.5 py-2">
          {/* 1. Razão Social */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700">Razão Social *</Label>
            <Input
              placeholder="Ex: SILVA & SANTOS TECNOLOGIA LTDA"
              value={formData.razao_social}
              onChange={(e) => setFormData({ ...formData, razao_social: e.target.value })}
              className="h-9 text-xs"
              autoFocus
            />
            {errors.razao_social && (
              <p className="text-[11px] text-red-500">{errors.razao_social}</p>
            )}
          </div>

          {/* 2. Nome Fantasia */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700">Nome Fantasia</Label>
            <Input
              placeholder="Ex: SILVA TECH INFORMÁTICA"
              value={formData.nome_fantasia}
              onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })}
              className="h-9 text-xs"
            />
          </div>

          {/* 3. Endereço e 4. Bairro */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Endereço</Label>
              <Input
                placeholder="Rua, Avenida, Número, Complemento..."
                value={formData.endereco}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Bairro</Label>
              <Input
                placeholder="Ex: Centro"
                value={formData.bairro}
                onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* 5. Celular */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700">Celular</Label>
            <Input
              placeholder="Ex: (67) 99964-7143"
              value={formData.celular}
              onChange={(e) =>
                setFormData({ ...formData, celular: maskPhoneInput(e.target.value) })
              }
              className="h-9 text-xs"
            />
            {errors.celular && <p className="text-[11px] text-red-500">{errors.celular}</p>}
          </div>

          {/* 6. RG/IE e 7. CPF/CNPJ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">RG / IE</Label>
              <Input
                placeholder="Ex: 12.345.678-9 ou ISENTO"
                value={formData.rg_ie}
                onChange={(e) => setFormData({ ...formData, rg_ie: e.target.value })}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">CPF / CNPJ</Label>
              <Input
                placeholder="000.000.000-00 ou 00.000.000/0001-00"
                value={formData.cpf_cnpj}
                onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value })}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-3">
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
