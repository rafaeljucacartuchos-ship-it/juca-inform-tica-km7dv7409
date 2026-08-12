import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { Plus, Search, Pencil, Trash2, Phone, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { User } from '@/types'
import { getUsers, deleteUser } from '@/services/users'
import { NewTechnicianModal } from '@/components/NewTechnicianModal'
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'

export default function Tecnicos() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [technicians, setTechnicians] = useState<User[]>([])
  const [search, setSearch] = useState('')
  const [newModalOpen, setNewModalOpen] = useState(false)
  const [editTech, setEditTech] = useState<User | null>(null)
  const [deleteTech, setDeleteTech] = useState<User | null>(null)

  const isAdmin = user?.role === 'admin'

  const loadData = async () => {
    try {
      const data = await getUsers()
      setTechnicians(data.filter((u) => u.role === 'technician'))
    } catch {
      /* ignored */
    }
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime('users', loadData)

  const handleDelete = async () => {
    if (!deleteTech) return
    try {
      await deleteUser(deleteTech.id)
      toast({ title: 'Técnico excluído com sucesso!' })
      setDeleteTech(null)
      loadData()
    } catch {
      toast({ title: 'Erro ao excluir técnico', variant: 'destructive' })
    }
  }

  const filtered = technicians.filter((t) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      t.name?.toLowerCase().includes(q) ||
      t.email?.toLowerCase().includes(q) ||
      t.phone?.toLowerCase().includes(q)
    )
  })

  if (!isAdmin) return <Navigate to="/" replace />

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Técnicos de Campo</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Gerencie a equipe técnica, contatos e atribuições.
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
                  <th className="py-3 px-4">E-mail</th>
                  <th className="py-3 px-4">Telefone</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{t.name}</td>
                    <td className="py-3 px-4 text-slate-600 font-mono">{t.email}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{t.phone || '-'}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-amber-600 gap-1"
                          onClick={() => setEditTech(t)}
                        >
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-600"
                          onClick={() => setDeleteTech(t)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      Nenhum técnico encontrado.
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
        open={!!editTech}
        onOpenChange={(o) => !o && setEditTech(null)}
        onCreated={loadData}
        editTechnician={editTech}
      />
      <ConfirmDeleteDialog
        open={!!deleteTech}
        onOpenChange={(o) => !o && setDeleteTech(null)}
        onConfirm={handleDelete}
        title="Excluir Técnico"
        description={`Tem certeza que deseja excluir ${deleteTech?.name}? Esta ação não pode ser desfeita.`}
      />
    </div>
  )
}
