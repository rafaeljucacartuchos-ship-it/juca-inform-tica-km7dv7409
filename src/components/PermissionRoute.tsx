import { Navigate, Outlet } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions } from '@/hooks/use-permissions'
import type { PermissionModule } from '@/lib/permissions'

interface PermissionRouteProps {
  module: PermissionModule
  children?: React.ReactNode
}

export function PermissionRoute({ module, children }: PermissionRouteProps) {
  const { loading } = useAuth()
  const { hasPermission } = usePermissions()

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (!hasPermission(module)) {
    return <Navigate to="/dashboard" replace />
  }

  return children ? <>{children}</> : <Outlet />
}
