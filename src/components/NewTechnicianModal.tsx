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
import { createUser, updateUser } from '@/services/users'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors } from '@/lib/pocketbase/errors'
import { User } from '@/types'

interface NewTechnicianModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
  editTechnician?: User | null
}

export function NewTechnicianModal({
  open,
  onOpenChange,
  onCreated,
  editTechnician,
}: NewTechnicianModalProps) {
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { toast } = useToast()
  const isEdit = !!editTechnician

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    passwordConfirm: '',
  })

  useEffect(() => {
    if (open) {
      setErrors({})
      if (editTechnician) {
        setFormData({
          name: editTechnician.name || '',
          email: editTechnician.email || '',
          phone: editTechnician.phone || '',
          password: '',
          passwordConfirm: '',
        })
      } else {
        setFormData({ name: '', email: '', phone: '', password: '', passwordConfirm: '' })
      }
    }
  }, [open, editTechnician])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    if (!formData.name.trim()) {
      setErrors({ name: 'Nome é obrigatório' })
      return
    }
    setLoading(true)
    try {
      if (isEdit && editTechnician) {
        await updateUser(editTechnician.id, { name: formData.name, phone: formData.phone })
        toast({ title: 'Técnico atualizado!', description: formData.name })
      } else {
        if (!formData.email.trim() || !formData.password.trim()) {
          setErrors({
            email: !formData.email.trim() ? 'E-mail é obrigatório' : '',
            password: !formData.password.trim() ? 'Senha é obrigatória' : '',
          })
          setLoading(false)
          return
        }
        if (formData.password !== formData.passwordConfirm) {
          setErrors({ passwordConfirm: 'As senhas não coincidem' })
          setLoading(false)
          return
        }
        await createUser({
          email: formData.email,
          password: formData.password,
          passwordConfirm: formData.passwordConfirm,
          name: formData.name,
          role: 'technician',
          phone: formData.phone,
        })
        toast({ title: 'Técnico cadastrado!', description: formData.name })
      }
      onOpenChange(false)
      if (onCreated) onCreated()
    } catch (err) {
      setErrors(extractFieldErrors(err))
      toast({ title: 'Erro ao salvar técnico', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">
            {isEdit ? 'Editar Técnico' : 'Novo Técnico'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700">Nome Completo *</Label>
            <Input
              placeholder="Ex: João da Silva"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="h-9 text-xs"
            />
            {errors.name && <p className="text-[11px] text-red-500">{errors.name}</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700">E-mail</Label>
            <Input
              type="email"
              placeholder="tecnico@email.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="h-9 text-xs"
              disabled={isEdit}
            />
            {errors.email && <p className="text-[11px] text-red-500">{errors.email}</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700">Telefone / WhatsApp</Label>
            <Input
              placeholder="(11) 99999-9999"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="h-9 text-xs"
            />
            {errors.phone && <p className="text-[11px] text-red-500">{errors.phone}</p>}
          </div>
          {!isEdit && (
            <>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Senha *</Label>
                <Input
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="h-9 text-xs"
                />
                {errors.password && <p className="text-[11px] text-red-500">{errors.password}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Confirmar Senha *</Label>
                <Input
                  type="password"
                  placeholder="Repita a senha"
                  value={formData.passwordConfirm}
                  onChange={(e) => setFormData({ ...formData, passwordConfirm: e.target.value })}
                  className="h-9 text-xs"
                />
                {errors.passwordConfirm && (
                  <p className="text-[11px] text-red-500">{errors.passwordConfirm}</p>
                )}
              </div>
            </>
          )}
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
              {loading ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Cadastrar Técnico'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
