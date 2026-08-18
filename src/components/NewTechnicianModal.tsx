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
import { CheckCircle2, Copy } from 'lucide-react'

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
  const [createdCode, setCreatedCode] = useState<string | null>(null)
  const { toast } = useToast()
  const isEdit = !!editTechnician

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    password: '',
    passwordConfirm: '',
  })

  useEffect(() => {
    if (open) {
      setErrors({})
      setCreatedCode(null)
      if (editTechnician) {
        setFormData({
          name: editTechnician.name || '',
          phone: editTechnician.phone || '',
          password: '',
          passwordConfirm: '',
        })
      } else {
        setFormData({ name: '', phone: '', password: '', passwordConfirm: '' })
      }
    }
  }, [open, editTechnician])

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numeric = e.target.value.replace(/\D/g, '').slice(0, 8)
    setFormData({ ...formData, password: numeric })
  }

  const handlePasswordConfirmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numeric = e.target.value.replace(/\D/g, '').slice(0, 8)
    setFormData({ ...formData, passwordConfirm: numeric })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: 'Código copiado!' })
  }

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
        onOpenChange(false)
      } else {
        if (!formData.password.trim()) {
          setErrors({ password: 'Senha é obrigatória' })
          setLoading(false)
          return
        }
        if (formData.password.length < 8 || formData.password.length > 20) {
          setErrors({ password: 'A senha deve ter entre 8 e 20 dígitos' })
          setLoading(false)
          return
        }
        if (formData.password !== formData.passwordConfirm) {
          setErrors({ passwordConfirm: 'As senhas não coincidem' })
          setLoading(false)
          return
        }
        const normalized = formData.name
          .trim()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/\s+/g, '.')
        const email = `${normalized}@juca.local`
        const result = await createUser({
          password: formData.password,
          passwordConfirm: formData.passwordConfirm,
          name: formData.name,
          role: 'technician',
          phone: formData.phone,
          email,
        })
        setCreatedCode(result.username || '')
        toast({ title: 'Técnico cadastrado!', description: formData.name })
        if (onCreated) onCreated()
      }
    } catch (err) {
      setErrors(extractFieldErrors(err))
      toast({ title: 'Erro ao salvar técnico', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  if (createdCode) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Técnico Cadastrado!
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <p className="text-sm text-slate-600">
                O técnico foi cadastrado com sucesso. Compartilhe o login e a senha para que ele
                possa acessar o sistema.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Login
                  </p>
                  <p className="text-xl font-bold font-mono text-indigo-600">{createdCode}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => copyToClipboard(createdCode)}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copiar
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={() => onOpenChange(false)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
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
          {isEdit && editTechnician?.username && (
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Login</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={editTechnician.username}
                  disabled
                  className="h-9 text-xs font-mono font-bold text-indigo-600"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 px-2"
                  onClick={() => copyToClipboard(editTechnician.username!)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
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
                <Label className="text-xs font-semibold text-slate-700">
                  Senha (apenas números) *
                </Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  placeholder="8 a 20 dígitos"
                  value={formData.password}
                  onChange={handlePasswordChange}
                  className="h-9 text-xs"
                />
                {errors.password && <p className="text-[11px] text-red-500">{errors.password}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Confirmar Senha *</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  placeholder="Repita a senha"
                  value={formData.passwordConfirm}
                  onChange={handlePasswordConfirmChange}
                  className="h-9 text-xs"
                />
                {errors.passwordConfirm && (
                  <p className="text-[11px] text-red-500">{errors.passwordConfirm}</p>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                O login será gerado automaticamente a partir do nome após o cadastro.
              </p>
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
