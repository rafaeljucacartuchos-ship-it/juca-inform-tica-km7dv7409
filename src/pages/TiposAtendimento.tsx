import { useState, useEffect } from 'react'
import { Plus, Tag, Pencil, Trash2, PowerOff, CheckCircle2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog'
import { RecordActionsMenu } from '@/components/RecordActionsMenu'
import { ServiceType } from '@/types'
import {
  getAllServiceTypes,
  createServiceType,
  updateServiceType,
  toggleServiceTypeActive,
  deleteServiceType,
} from '@/services/service_types'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors } from '@/lib/pocketbase/errors'

export default function TiposAtendimento() {
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ServiceType | null>(null)
  const [deleteItem, setDeleteItem] = useState<ServiceType | null>(null)
  const [name, setName] = useState('')
  const [active, setActive] = useState(true)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { toast } = useToast()

  const loadData = async () => {
    try {
      const data = await getAllServiceTypes()
      setServiceTypes(data)
    } catch {
      /* ignored */
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime('service_types', loadData)

  const handleOpenNew = () => {
    setEditingItem(null)
    setName('')
    setActive(true)
    setErrors({})
    setModalOpen(true)
  }

  const handleOpenEdit = (item: ServiceType) => {
    setEditingItem(item)
    setName(item.name || '')
    setActive(item.active !== false)
    setErrors({})
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    if (!name.trim()) {
      setErrors({ name: 'Nome do tipo de atendimento é obrigatório' })
      return
    }

    setLoading(true)
    try {
      if (editingItem) {
        await updateServiceType(editingItem.id, {
          name: name.trim(),
          active,
        })
        toast({
          title: 'Tipo de atendimento atualizado!',
          description: `"${name}" foi atualizado com sucesso.`,
        })
      } else {
        await createServiceType({
          name: name.trim(),
          active,
        })
        toast({
          title: 'Tipo de atendimento cadastrado!',
          description: `"${name}" foi adicionado.`,
        })
      }
      setModalOpen(false)
      loadData()
    } catch (err) {
      setErrors(extractFieldErrors(err))
      toast({
        title: 'Erro ao salvar tipo de atendimento',
        description: 'Verifique se o nome já não está cadastrado.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (item: ServiceType) => {
    const next = !item.active
    try {
      await toggleServiceTypeActive(item.id, !!item.active)
      toast({
        title: next ? 'Tipo ativado!' : 'Tipo inativado!',
      })
      loadData()
    } catch {
      toast({
        title: 'Erro ao alterar status',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async () => {
    if (!deleteItem) return
    try {
      await deleteServiceType(deleteItem.id)
      toast({ title: 'Tipo de atendimento excluído com sucesso!' })
      setDeleteItem(null)
      loadData()
    } catch {
      toast({
        title: 'Erro ao excluir tipo de atendimento',
        description: 'Não é possível excluir se houver ordens vinculadas.',
        variant: 'destructive',
      })
    }
  }

  const filtered = serviceTypes.filter((st) => st.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <Tag className="h-6 w-6 text-indigo-600" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Tipos de Atendimento
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Gerenciamento exclusivo para administradores dos tipos de atendimento (Balcão, Visita
            Técnica, etc.).
          </p>
        </div>

        <Button
          onClick={handleOpenNew}
          className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 h-9 text-xs font-medium shadow-xs"
        >
          <Plus className="h-4 w-4" />
          <span>Novo Tipo</span>
        </Button>
      </div>

      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar tipo de atendimento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs bg-slate-50 border-slate-200"
          />
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Nome do Tipo</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((st) => {
                  const isActive = st.active !== false
                  return (
                    <tr
                      key={st.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        !isActive ? 'bg-slate-50/50 opacity-75' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{st.name}</span>
                          {st.name.trim().toLowerCase() === 'balcão' && (
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded font-medium">
                              Obriga Equipamento no Cadastro
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* 1 Ação Principal visível fora do menu: Editar */}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[11px] font-semibold text-slate-700 bg-white border-slate-200 hover:bg-slate-100 hover:text-slate-900 gap-1 shadow-2xs"
                            onClick={() => openEdit(st)}
                            title="Editar tipo de atendimento"
                          >
                            <Pencil className="h-3 w-3 text-indigo-600" />
                            <span>Editar</span>
                          </Button>

                          {/* Menu em cascata com Inativar/Ativar e Excluir */}
                          <RecordActionsMenu
                            label={`Tipo: ${st.name}`}
                            title={`Ações de ${st.name}`}
                            items={[
                              {
                                key: 'toggle_active',
                                label: isActive ? 'Inativar tipo' : 'Ativar tipo',
                                icon: isActive ? PowerOff : CheckCircle2,
                                variant: isActive ? 'warning' : 'success',
                                onClick: () => handleToggle(st),
                              },
                              {
                                key: 'delete',
                                label: 'Excluir tipo',
                                icon: Trash2,
                                variant: 'destructive',
                                separatorBefore: true,
                                onClick: () => setDeleteItem(st),
                              },
                            ]}
                          />
                        </div>
                      </td>{' '}
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-10 text-center text-slate-400 font-medium">
                      Nenhum tipo de atendimento cadastrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Criação / Edição */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-full max-w-full sm:max-w-[420px] rounded-none sm:rounded-lg p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              {editingItem ? 'Editar Tipo de Atendimento' : 'Novo Tipo de Atendimento'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Nome do Tipo *</Label>
              <Input
                placeholder="Ex: Balcão, Visita Técnica, Suporte Remoto..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 text-xs"
              />
              {errors.name && <p className="text-[11px] text-red-500">{errors.name}</p>}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Switch checked={active} onCheckedChange={setActive} />
              <Label className="text-xs font-semibold text-slate-700">
                Tipo de atendimento ativo
              </Label>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {loading ? 'Salvando...' : editingItem ? 'Salvar Alterações' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteItem}
        onOpenChange={(o) => !o && setDeleteItem(null)}
        onConfirm={handleDelete}
        title="Excluir Tipo de Atendimento"
        description={`Tem certeza que deseja excluir o tipo "${deleteItem?.name}"?`}
      />
    </div>
  )
}
