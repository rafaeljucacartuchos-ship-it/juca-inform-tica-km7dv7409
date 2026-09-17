import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  KeyRound,
  Shield,
  RefreshCw,
  UserX,
  UserCheck,
  AlertTriangle,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { User, UserRole } from '@/types'
import {
  getAllUsers,
  deleteUser,
  updateUser,
  regenerateRegistrationCode,
  toggleUserActive,
} from '@/services/users'
import { getServiceOrders } from '@/services/service_orders'
import { NewTechnicianModal } from '@/components/NewTechnicianModal'
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog'
import { ResetPasswordModal } from '@/components/ResetPasswordModal'
import { PermissionsModal } from '@/components/PermissionsModal'
import { RecordActionsMenu, RecordActionItem } from '@/components/RecordActionsMenu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions } from '@/hooks/use-permissions'
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
  const [permissionsUser, setPermissionsUser] = useState<User | null>(null)
  const [inactivateTarget, setInactivateTarget] = useState<User | null>(null)
  const [pendingOrdersCount, setPendingOrdersCount] = useState<number | null>(null)
  const [checkingOrders, setCheckingOrders] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const isAdmin = user?.role === 'admin'
  const { hasPermission } = usePermissions()

  const loadData = async () => {
    try {
      const data = await getAllUsers()
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
    if (!isAdmin) {
      toast({
        title: 'Ação não permitida',
        description: 'Apenas administradores podem excluir usuários.',
        variant: 'destructive',
      })
      return
    }
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
    if (!isAdmin) {
      toast({
        title: 'Ação não permitida',
        description: 'Apenas administradores podem alterar a função dos usuários.',
        variant: 'destructive',
      })
      return
    }
    try {
      await updateUser(userId, { role: newRole })
      toast({ title: 'Função atualizada!', description: roleLabels[newRole as UserRole] })
      loadData()
    } catch {
      toast({ title: 'Erro ao atualizar função', variant: 'destructive' })
    }
  }

  const handleRegenerateCode = async (userId: string) => {
    try {
      await regenerateRegistrationCode(userId)
      toast({ title: 'Login regenerado com sucesso!' })
      loadData()
    } catch {
      toast({ title: 'Erro ao regenerar login', variant: 'destructive' })
    }
  }

  // Abre confirmação de inativação verificando O.S. em andamento
  const handleRequestInactivate = async (target: User) => {
    setInactivateTarget(target)
    setCheckingOrders(true)
    setPendingOrdersCount(null)
    try {
      // Busca ordens atribuídas a este técnico que não estejam completed/closed/cancelled
      const activeStatusFilter = `technician = "${target.id}" && (status = "open" || status = "in_progress" || status = "paused" || status = "waiting_parts" || status = "aguardando_orcamento" || status = "orcamento_enviado")`
      const openOrders = await getServiceOrders(activeStatusFilter)
      setPendingOrdersCount(openOrders.length)
    } catch {
      setPendingOrdersCount(0)
    } finally {
      setCheckingOrders(false)
    }
  }

  const handleConfirmInactivate = async () => {
    if (!inactivateTarget) return
    try {
      await toggleUserActive(inactivateTarget.id, inactivateTarget.ativo !== false)
      toast({
        title:
          inactivateTarget.ativo !== false
            ? 'Técnico inativado com sucesso!'
            : 'Técnico reativado com sucesso!',
        description:
          inactivateTarget.ativo !== false
            ? `${inactivateTarget.name} não aparecerá mais para novas seleções, mantendo o histórico de O.S. antigas.`
            : `${inactivateTarget.name} voltou a ficar ativo no sistema.`,
      })
      setInactivateTarget(null)
      setPendingOrdersCount(null)
      loadData()
    } catch {
      toast({ title: 'Erro ao alterar status do técnico', variant: 'destructive' })
    }
  }

  const handleQuickReactivate = async (target: User) => {
    try {
      await toggleUserActive(target.id, false)
      toast({
        title: 'Técnico reativado com sucesso!',
        description: `${target.name} já pode ser selecionado em novas ordens de serviço.`,
      })
      loadData()
    } catch {
      toast({ title: 'Erro ao reativar técnico', variant: 'destructive' })
    }
  }

  const filtered = users.filter((u) => {
    if (statusFilter === 'active' && u.ativo === false) return false
    if (statusFilter === 'inactive' && u.ativo !== false) return false

    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      u.name?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6">
      {!isAdmin && (
        <div className="flex items-center gap-2 p-3 bg-amber-50/90 border border-amber-200/80 rounded-xl text-amber-900 text-xs shadow-xs">
          <Info className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="font-medium">
            Apenas administradores podem gerenciar usuários e permissões.
          </span>
          <span className="text-amber-700/80 hidden sm:inline">
            (Visualização em modo somente leitura)
          </span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Usuários &amp; Permissões
            </h1>
            <Badge
              variant="outline"
              className="border-indigo-200 bg-indigo-50 text-indigo-700 text-[10px] font-bold"
            >
              v0.0.230
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Gerencie usuários, funções, senhas e permissões de acesso.
          </p>
        </div>
        {isAdmin ? (
          <Button
            onClick={() => setNewModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 h-9 text-xs sm:text-sm font-medium shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>+ Novo Técnico</span>
          </Button>
        ) : (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    disabled
                    className="bg-slate-200 text-slate-400 gap-1.5 h-9 text-xs sm:text-sm cursor-not-allowed opacity-60"
                  >
                    <Plus className="h-4 w-4" />
                    <span>+ Novo Técnico</span>
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent className="text-xs">
                Apenas administradores podem cadastrar novos técnicos
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por nome, e-mail ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs bg-slate-50 border-slate-200"
          />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            size="sm"
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('all')}
            className={`h-8 text-xs font-bold ${
              statusFilter === 'all'
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'text-slate-700'
            }`}
          >
            Todos ({users.length})
          </Button>
          <Button
            type="button"
            size="sm"
            variant={statusFilter === 'active' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('active')}
            className={`h-8 text-xs font-bold ${
              statusFilter === 'active'
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'text-emerald-700 bg-emerald-50/50 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            Ativos ({users.filter((u) => u.ativo !== false).length})
          </Button>
          <Button
            type="button"
            size="sm"
            variant={statusFilter === 'inactive' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('inactive')}
            className={`h-8 text-xs font-bold ${
              statusFilter === 'inactive'
                ? 'bg-slate-700 text-white hover:bg-slate-800'
                : 'text-slate-600 bg-slate-100 border-slate-300 hover:bg-slate-200'
            }`}
          >
            Inativos ({users.filter((u) => u.ativo === false).length})
          </Button>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Nome</th>
                  <th className="py-3 px-4 hidden sm:table-cell">Cadastro</th>
                  <th className="py-3 px-4 hidden md:table-cell">Telefone</th>
                  <th className="py-3 px-4">Função</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((u) => {
                  const isSelf = u.id === user?.id
                  const isUserActive = u.ativo !== false

                  // Monta os itens do menu em cascata respeitando permissões
                  const menuActions: RecordActionItem[] = [
                    {
                      key: 'edit',
                      label: 'Editar dados',
                      icon: Pencil,
                      onClick: () => setEditUser(u),
                    },
                    {
                      key: 'permissions',
                      label: 'Permissões de acesso',
                      icon: Shield,
                      onClick: () => setPermissionsUser(u),
                      hidden: !hasPermission('permissoes'),
                    },
                    {
                      key: 'password',
                      label: 'Alterar senha',
                      icon: KeyRound,
                      onClick: () => setResetPwdUser(u),
                    },
                    {
                      key: 'regenerate',
                      label: 'Regenerar código de login',
                      icon: RefreshCw,
                      onClick: () => handleRegenerateCode(u.id),
                    },
                    {
                      key: 'toggle_active',
                      label: isUserActive ? 'Inativar técnico' : 'Reativar técnico',
                      icon: isUserActive ? UserX : UserCheck,
                      variant: isUserActive ? 'warning' : 'success',
                      disabled: isSelf,
                      separatorBefore: true,
                      onClick: () => {
                        if (isUserActive) {
                          handleRequestInactivate(u)
                        } else {
                          handleQuickReactivate(u)
                        }
                      },
                    },
                    {
                      key: 'delete',
                      label: 'Excluir usuário',
                      icon: Trash2,
                      variant: 'destructive',
                      disabled: isSelf,
                      separatorBefore: true,
                      onClick: () => setDeleteUserTarget(u),
                    },
                  ]

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        !isUserActive ? 'bg-slate-50/60 opacity-80' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span className={!isUserActive ? 'text-slate-500 line-through' : ''}>
                            {u.name}
                          </span>
                          {isSelf && (
                            <Badge
                              variant="outline"
                              className="text-[10px] py-0 px-1.5 border-slate-300 text-slate-500"
                            >
                              Você
                            </Badge>
                          )}
                        </div>
                        <span className="sm:hidden block font-normal font-mono text-slate-500 mt-0.5">
                          {u.username || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4 hidden sm:table-cell">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-indigo-600 text-sm">
                            {u.username || '-'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 hidden md:table-cell">
                        {u.phone || '-'}
                      </td>
                      <td className="py-3 px-4">
                        {!isAdmin ? (
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-block">
                                  <Select value={u.role} disabled>
                                    <SelectTrigger className="h-8 w-[140px] text-xs bg-slate-50/70 border-slate-200 text-slate-600 cursor-not-allowed opacity-80">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </Select>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">
                                Apenas administradores podem alterar a função
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : isSelf ? (
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-block">
                                  <Select value={u.role} disabled>
                                    <SelectTrigger className="h-8 w-[140px] text-xs bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </Select>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">
                                Você não pode alterar sua própria função
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <Select
                            value={u.role}
                            onValueChange={(value) => handleRoleChange(u.id, value)}
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
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold uppercase tracking-wider ${
                            isUserActive
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                              : 'border-slate-300 bg-slate-100 text-slate-600'
                          }`}
                        >
                          {isUserActive ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isAdmin ? (
                            <>
                              {/* 1 Ação Principal visível fora do menu */}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 font-semibold"
                                onClick={() => setEditUser(u)}
                                title="Editar técnico"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Editar</span>
                              </Button>

                              {/* Menu em cascata com todas as demais ações */}
                              <RecordActionsMenu
                                label={`Opções: ${u.name}`}
                                items={menuActions}
                                title={`Ações de ${u.name}`}
                              />
                            </>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic px-2">
                              Somente leitura
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
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
      <PermissionsModal
        open={!!permissionsUser}
        onOpenChange={(o) => !o && setPermissionsUser(null)}
        user={permissionsUser}
        onSaved={loadData}
      />

      {/* Confirmação de Inativação / Reativação com alerta de O.S. em andamento */}
      <Dialog
        open={!!inactivateTarget}
        onOpenChange={(open) => {
          if (!open) {
            setInactivateTarget(null)
            setPendingOrdersCount(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div
                className={`p-2 rounded-full ${
                  inactivateTarget?.ativo !== false
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {inactivateTarget?.ativo !== false ? (
                  <UserX className="h-5 w-5" />
                ) : (
                  <UserCheck className="h-5 w-5" />
                )}
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  {inactivateTarget?.ativo !== false ? 'Inativar Técnico' : 'Reativar Técnico'}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  {inactivateTarget?.name}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            {inactivateTarget?.ativo !== false ? (
              <>
                <p className="text-slate-700 leading-relaxed">
                  Tem certeza que deseja inativar o técnico{' '}
                  <strong className="text-slate-900">{inactivateTarget?.name}</strong>?
                </p>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 text-slate-600">
                  <p>
                    ✓ <strong>Histórico preservado:</strong> O.S. e orçamentos anteriores
                    continuarão exibindo o nome deste técnico.
                  </p>
                  <p>
                    ✓ <strong>Listas de seleção:</strong> Ele deixará de aparecer para novas
                    atribuições e transferências de O.S.
                  </p>
                </div>

                {checkingOrders ? (
                  <div className="p-2.5 text-center text-slate-500 text-xs bg-slate-50 rounded">
                    Verificando ordens de serviço vinculadas...
                  </div>
                ) : pendingOrdersCount && pendingOrdersCount > 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-2.5 text-amber-900">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-xs">Atenção: Ordens em andamento detectadas!</p>
                      <p className="text-[11px] mt-0.5 text-amber-800">
                        Este técnico possui <strong>{pendingOrdersCount} O.S. em andamento</strong>.
                        Ao inativá-lo, recomendamos transferir essas ordens para outro técnico
                        responsável.
                      </p>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-slate-700 leading-relaxed">
                Deseja reativar o técnico{' '}
                <strong className="text-slate-900">{inactivateTarget?.name}</strong>? Ele voltará a
                aparecer nas listas de atribuição e transferências de O.S.
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setInactivateTarget(null)
                setPendingOrdersCount(null)
              }}
              className="text-xs h-8"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmInactivate}
              className={`text-xs h-8 font-semibold text-white ${
                inactivateTarget?.ativo !== false
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {inactivateTarget?.ativo !== false ? 'Confirmar Inativação' : 'Confirmar Reativação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
