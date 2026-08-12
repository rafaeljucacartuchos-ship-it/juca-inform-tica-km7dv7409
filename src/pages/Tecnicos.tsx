import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { Plus, Search, Pencil, Trash2, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { User, UserRole } from '@/types'
import { getUsers, deleteUser, updateUser } from '@/services/users'
import { NewTechnicianModal } from '@/components/NewTechnicianModal'
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog'
import { ResetPasswordModal } from '@/components/ResetPasswordModal'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'

const roleLabels: Record<UserRole, string> = {
  admin: 'Administrador',
  attendant: 'Atendente',
  technician: 'Técnico',
}

export default function Tecnicos() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState('')
  const [newModalOpen, setNewModalOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [deleteUserTarget, setDeleteUserTarget] = useState<User | null>(null)
  const [resetPwdUser, setResetPwdUser] = useState<User | null>(null)

  const isAdmin = user?.role === 'admin'

  const loadData = async () => {
    try {
      const data = await getUsers()
      setUsers(data)
    } catch {
      /* ignored */
    }
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime('users', loadData)

  const handleDelete = async () => {
    if (!deleteUserTarget) return
    try {
      await deleteUser(deleteUserTarget.id)
      toast({ title: 'Usuário excluído com sucesso!' })
      setDeleteUserTarget(null)
      loadData()
    } catch {
      toast({ title: 'Erro ao excluir usuário', variant: 'destructive' })
    }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await updateUser(userId, { role: newRole })
      toast({ title: 'Função atualizada!', description: roleLabels[newRole as UserRole] })
      loadData()
    } catch {
      toast({ title: 'Erro ao atualizar função', variant: 'destructive' })
    }
  }

  const filtered = users.filter((u) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q)
    )
  })

  if (!isAdmin) return <Navigate to="/dashboard" replace />

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Usuários &amp; Permissões
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Gerencie usuários, funções, senhas e permissões de acesso.
          </p>
        </div>
        <Button
          onClick={() => setNewModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 h-9 text-xs sm:text-sm"
        >
          <Plus className="h-4 w-4" />
          <span>Novo Técnico</span>
        </Button>
      </div>

      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por nome, e-mail ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs bg-slate-50 border-slate-200"
          />
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Nome</th>
                  <th className="py-3 px-4 hidden sm:table-cell">E-mail</th>
                  <th className="py-3 px-4 hidden md:table-cell">Telefone</th>
                  <th className="py-3 px-4">Função</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        {u.name}
                        {u.id === user?.id && (
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 px-1.5 border-slate-300 text-slate-500"
                          >
                            Você
                          </Badge>
                        )}
                      </div>
                      <span className="sm:hidden block font-normal font-mono text-slate-500 mt-0.5">
                        {u.email}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono hidden sm:table-cell">
                      {u.email}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 hidden md:table-cell">
                      {u.phone || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <Select
                        value={u.role}
                        onValueChange={(value) => handleRoleChange(u.id, value)}
                        disabled={u.id === user?.id}
                      >
                        <SelectTrigger className="h-8 w-[140px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrador</SelectItem>
                          <SelectItem value="attendant">Atendente</SelectItem>
                          <SelectItem value="technician">Técnico</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-amber-600 gap-1"
                          onClick={() => setEditUser(u)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="hidden lg:inline">Editar</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-indigo-600 gap-1"
                          onClick={() => setResetPwdUser(u)}
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          <span className="hidden lg:inline">Senha</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-600"
                          onClick={() => setDeleteUserTarget(u)}
                          disabled={u.id === user?.id}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <NewTechnicianModal open={newModalOpen} onOpenChange={setNewModalOpen} onCreated={loadData} />
      <NewTechnicianModal
        open={!!editUser}
        onOpenChange={(o) => !o && setEditUser(null)}
        onCreated={loadData}
        editTechnician={editUser}
      />
      <ConfirmDeleteDialog
        open={!!deleteUserTarget}
        onOpenChange={(o) => !o && setDeleteUserTarget(null)}
        onConfirm={handleDelete}
        title="Excluir Usuário"
        description={`Tem certeza que deseja excluir ${deleteUserTarget?.name}? Esta ação não pode ser desfeita.`}
      />
      <ResetPasswordModal
        open={!!resetPwdUser}
        onOpenChange={(o) => !o && setResetPwdUser(null)}
        user={resetPwdUser}
      />
    </div>
  )
}
