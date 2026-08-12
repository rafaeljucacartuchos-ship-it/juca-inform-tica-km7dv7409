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
import { resetUserPassword } from '@/services/users'
import { useToast } from '@/hooks/use-toast'
import { User } from '@/types'

interface ResetPasswordModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
}

export function ResetPasswordModal({ open, onOpenChange, user }: ResetPasswordModalProps) {
  const [loading, setLoading] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      setPassword('')
      setConfirmPassword('')
      setError('')
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('A senha deve ter no mínimo 8 caracteres')
      return
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem')
      return
    }

    setLoading(true)
    try {
      await resetUserPassword(user!.id, password)
      toast({ title: 'Senha redefinida com sucesso!', description: user?.name })
      onOpenChange(false)
    } catch {
      toast({ title: 'Erro ao redefinir senha', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">Redefinir Senha</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 py-2">
          <p className="text-xs text-slate-500">
            Defina uma nova senha para <span className="font-semibold">{user?.name}</span>.
          </p>
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700">Nova Senha *</Label>
            <Input
              type="password"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700">Confirmar Senha *</Label>
            <Input
              type="password"
              placeholder="Repita a nova senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
          {error && <p className="text-[11px] text-red-500">{error}</p>}
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
              {loading ? 'Salvando...' : 'Redefinir Senha'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
