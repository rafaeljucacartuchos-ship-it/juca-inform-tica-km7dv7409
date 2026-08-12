import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { updateUser } from '@/services/users'
import { useToast } from '@/hooks/use-toast'
import { User } from '@/types'
import {
  PERMISSION_LABELS,
  ALL_PERMISSION_MODULES,
  getDefaultPermissions,
  type PermissionModule,
  type UserPermissions,
} from '@/lib/permissions'

interface PermissionsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
  onSaved?: () => void
}

export function PermissionsModal({ open, onOpenChange, user, onSaved }: PermissionsModalProps) {
  const [loading, setLoading] = useState(false)
  const [perms, setPerms] = useState<UserPermissions>(getDefaultPermissions('technician'))
  const { toast } = useToast()

  useEffect(() => {
    if (open && user) {
      const defaults = getDefaultPermissions(user.role)
      if (user.permissions && typeof user.permissions === 'object') {
        setPerms({ ...defaults, ...user.permissions })
      } else {
        setPerms(defaults)
      }
    }
  }, [open, user])

  const handleToggle = (module: PermissionModule) => {
    setPerms((prev) => ({ ...prev, [module]: !prev[module] }))
  }

  const handleReset = () => {
    if (user) {
      setPerms(getDefaultPermissions(user.role))
    }
  }

  const handleSave = async () => {
    if (!user) return
    setLoading(true)
    try {
      await updateUser(user.id, { permissions: perms })
      toast({ title: 'Permissões atualizadas!', description: user.name })
      onOpenChange(false)
      if (onSaved) onSaved()
    } catch {
      toast({ title: 'Erro ao salvar permissões', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">
            Permissões — {user?.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          {ALL_PERMISSION_MODULES.map((module) => (
            <div
              key={module}
              className="flex items-center justify-between rounded-lg border border-slate-200 p-3"
            >
              <Label className="text-xs font-medium text-slate-700 cursor-pointer flex-1">
                {PERMISSION_LABELS[module]}
              </Label>
              <Switch checked={perms[module]} onCheckedChange={() => handleToggle(module)} />
            </div>
          ))}
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleReset}>
            Restaurar Padrão
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={loading}
            onClick={handleSave}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {loading ? 'Salvando...' : 'Salvar Permissões'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
