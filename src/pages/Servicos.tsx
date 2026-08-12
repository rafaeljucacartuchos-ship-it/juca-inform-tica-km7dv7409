import { useState, useEffect } from 'react'
import { Plus, Briefcase, Clock, Pencil, Trash2, Power } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CatalogService } from '@/types'
import {
  getCatalogServices,
  updateCatalogService,
  deleteCatalogService,
} from '@/services/services_catalog'
import { NewServiceModal } from '@/components/NewServiceModal'
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'

export default function Servicos() {
  const [services, setServices] = useState<CatalogService[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editService, setEditService] = useState<CatalogService | null>(null)
  const [deleteService, setDeleteService] = useState<CatalogService | null>(null)
  const { toast } = useToast()

  const loadData = async () => {
    try {
      const data = await getCatalogServices()
      setServices(data)
    } catch {
      /* intentionally ignored */
    }
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime('services', loadData)

  const toggleActive = async (s: CatalogService) => {
    try {
      await updateCatalogService(s.id, { active: !s.active })
      toast({ title: s.active ? 'Serviço desativado' : 'Serviço ativado' })
      loadData()
    } catch {
      toast({ title: 'Erro ao alterar status', variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!deleteService) return
    try {
      await deleteCatalogService(deleteService.id)
      toast({ title: 'Serviço excluído com sucesso!' })
      setDeleteService(null)
      loadData()
    } catch {
      toast({ title: 'Erro ao excluir serviço', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Catálogo de Serviços</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Tabela de preços e tempo estimado para orçamentos rápidos.
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((s) => (
          <Card key={s.id} className="border-slate-200 shadow-xs hover:shadow-md transition-shadow">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <Briefcase className="h-4 w-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900">{s.name}</h3>
                </div>
                <Badge variant={s.active ? 'default' : 'secondary'} className="text-[10px]">
                  {s.active ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 line-clamp-2">
                {s.description || 'Sem descrição.'}
              </p>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1 text-slate-500 font-mono text-[11px]">
                  <Clock className="h-3.5 w-3.5" /> {s.estimated_duration} min
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    R$ {(s.price || 0).toFixed(2)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-slate-400 hover:text-emerald-600"
                    onClick={() => toggleActive(s)}
                  >
                    <Power className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-amber-600"
                    onClick={() => setEditService(s)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-red-600"
                    onClick={() => setDeleteService(s)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {services.length === 0 && (
        <div className="py-12 text-center text-slate-400 text-sm">Nenhum serviço cadastrado.</div>
      )}

      <NewServiceModal open={modalOpen} onOpenChange={setModalOpen} onCreated={loadData} />
      <NewServiceModal
        open={!!editService}
        onOpenChange={(o) => !o && setEditService(null)}
        onCreated={loadData}
        editService={editService}
      />
      <ConfirmDeleteDialog
        open={!!deleteService}
        onOpenChange={(o) => !o && setDeleteService(null)}
        onConfirm={handleDelete}
        title="Excluir Serviço"
        description={`Tem certeza que deseja excluir ${deleteService?.name}? Esta ação não pode ser desfeita.`}
      />
    </div>
  )
}
