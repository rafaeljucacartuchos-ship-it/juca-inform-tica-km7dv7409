import { useState, useEffect } from 'react'
import { Plus, Briefcase, Pencil, Trash2, Power, Filter, Search, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Service, SERVICE_CATEGORY_LABELS } from '@/types'
import { getServices, updateService, deleteService } from '@/services/services_catalog'
import { RecordActionsMenu } from '@/components/RecordActionsMenu'
import { NewServiceModal } from '@/components/NewServiceModal'
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'

export default function Servicos() {
  const [services, setServices] = useState<Service[]>([])
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editService, setEditService] = useState<Service | null>(null)
  const [deleteServiceItem, setDeleteServiceItem] = useState<Service | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const { toast } = useToast()

  const loadData = async () => {
    try {
      const data = await getServices(search)
      setServices(data)
    } catch {
      /* intentionally ignored */
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])
  useRealtime('services', loadData)

  const filteredServices = services.filter((s) => {
    if (categoryFilter === 'all') return true
    return s.category === categoryFilter
  })

  const toggleActive = async (s: Service) => {
    try {
      await updateService(s.id, { active: !s.active })
      toast({ title: s.active ? 'Serviço desativado' : 'Serviço ativado' })
      loadData()
    } catch {
      toast({ title: 'Erro ao alterar status', variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!deleteServiceItem) return
    try {
      await deleteService(deleteServiceItem.id)
      toast({ title: 'Serviço excluído com sucesso!' })
      setDeleteServiceItem(null)
      loadData()
    } catch {
      toast({ title: 'Erro ao excluir serviço', variant: 'destructive' })
    }
  }

  const displayName = (s: Service) => s.title || s.name || '—'
  const isActive = (s: Service) =>
    s.active ?? (s.status ? s.status.toLowerCase() === 'ativo' : true)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Serviços</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Tabela de serviços importada da planilha ({services.length} serviços).
          </p>
        </div>
        <Button
          onClick={() => setModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 h-9 text-xs sm:text-sm"
        >
          <Plus className="h-4 w-4" />
          <span>Novo Serviço</span>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por título, código ou CNAE..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs bg-slate-50 border-slate-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 text-xs w-48">
              <SelectValue placeholder="Todas as categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                Todas as categorias
              </SelectItem>
              {Object.entries(SERVICE_CATEGORY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value} className="text-xs">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Título</th>
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">CNAE</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4">Preço</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredServices.map((s) => {
                  const active = isActive(s)
                  return (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{displayName(s)}</div>
                        {s.description && (
                          <div className="text-[11px] text-slate-500 line-clamp-1">
                            {s.description}
                          </div>
                        )}
                        {s.obs && (
                          <div className="flex items-center gap-1 text-[10px] text-amber-600 mt-0.5">
                            <FileText className="h-3 w-3" /> {s.obs}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {s.external_code || '-'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">{s.cnae || '-'}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {s.category
                          ? SERVICE_CATEGORY_LABELS[
                              s.category as keyof typeof SERVICE_CATEGORY_LABELS
                            ] || s.category
                          : '-'}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        R$ {(s.price || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={active ? 'default' : 'secondary'} className="text-[10px]">
                          {active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* 1 Ação Principal visível fora do menu: Editar */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-semibold gap-1"
                            onClick={() => setEditService(s)}
                            title="Editar serviço"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span>Editar</span>
                          </Button>

                          {/* Menu em cascata com Inativar/Ativar e Excluir */}
                          <RecordActionsMenu
                            label={`Serviço: ${displayName(s)}`}
                            title={`Ações de ${displayName(s)}`}
                            items={[
                              {
                                key: 'toggle_active',
                                label: active ? 'Inativar serviço' : 'Ativar serviço',
                                icon: Power,
                                variant: active ? 'warning' : 'success',
                                onClick: () => toggleActive(s),
                              },
                              {
                                key: 'delete',
                                label: 'Excluir serviço',
                                icon: Trash2,
                                variant: 'destructive',
                                separatorBefore: true,
                                onClick: () => setDeleteServiceItem(s),
                              },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filteredServices.length === 0 && (
            <div className="py-12 text-center text-slate-400 text-sm">
              Nenhum serviço encontrado.
            </div>
          )}
        </CardContent>
      </Card>

      <NewServiceModal open={modalOpen} onOpenChange={setModalOpen} onCreated={loadData} />
      <NewServiceModal
        open={!!editService}
        onOpenChange={(o) => !o && setEditService(null)}
        onCreated={loadData}
        editService={editService as any}
      />
      <ConfirmDeleteDialog
        open={!!deleteServiceItem}
        onOpenChange={(o) => !o && setDeleteServiceItem(null)}
        onConfirm={handleDelete}
        title="Excluir Serviço"
        description={`Tem certeza que deseja excluir ${
          deleteServiceItem ? displayName(deleteServiceItem) : ''
        }? Esta ação não pode ser desfeita.`}
      />
    </div>
  )
}
