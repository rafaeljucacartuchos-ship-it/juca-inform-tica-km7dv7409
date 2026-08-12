import { useMemo } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { getUserPermissions, type UserPermissions, type PermissionModule } from '@/lib/permissions'

export function usePermissions() {
  const { user } = useAuth()

  const permissions = useMemo<UserPermissions>(() => {
    if (!user) return getUserPermissions('technician', null)
    return getUserPermissions(user.role, user.permissions ?? null)
  }, [user])

  const hasPermission = (module: PermissionModule): boolean => {
    return permissions[module] ?? false
  }

  return { permissions, hasPermission }
}
