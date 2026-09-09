import { useState, useEffect } from 'react'
import { Search, Monitor, Laptop, Smartphone, Printer, Plus, Edit2, ImageIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Equipment } from '@/types'
import { getEquipment } from '@/services/equipment'
import { getFileUrl } from '@/lib/pocketbase/files'
import { useRealtime } from '@/hooks/use-realtime'
import { usePermissions } from '@/hooks/use-permissions'
import { NewEquipmentModal } from '@/components/NewEquipmentModal'
import { EditEquipmentModal } from '@/components/EditEquipmentModal'
import { EquipmentHistoryDialog } from '@/components/EquipmentHistoryDialog'

const typeIcons: Record<string, typeof Monitor> = {
  notebook: Laptop,
  desktop: Monitor,
  monitor: Monitor,
  printer: Printer,
  smartphone: Smartphone,
  tablet: Smartphone,
  network: Monitor,
  other: Monitor,
}

export default function Equipamentos() {
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedEquip, setSelectedEquip] = useState<Equipment | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editModalTab, setEditModalTab] = useState<'edit' | 'photos'>('edit')
  const { hasPermission } = usePermissions()
  const canEditEquip = hasPermission('equipamentos')

  const loadData = async () => {
    try {
      setEquipment(await getEquipment())
    } catch {
      /* */
    }
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime('equipment', loadData)

  const filtered = equipment.filter((e) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      e.name?.toLowerCase().includes(q) ||
      e.brand?.toLowerCase().includes(q) ||
      e.model?.toLowerCase().includes(q) ||
      e.serial_number?.toLowerCase().includes(q)
    )
  })

  const openHistory = (e: Equipment) => {
    setSelectedEquip(e)
    setHistoryOpen(true)
  }

  const openEdit = (e: Equipment, tab: 'edit' | 'photos' = 'edit') => {
    setSelectedEquip(e)
    setEditModalTab(tab)
    setEditModalOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Equipamentos</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Base de equipamentos cadastrados dos clientes.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4 mr-1" /> Novo Equipamento
        </Button>
      </div>

      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por nome, marca, modelo ou série..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs bg-slate-50 border-slate-200"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((e) => {
          const Icon = typeIcons[e.type || 'other'] || Monitor
          const photos = e.photos || []
          return (
            <Card
              key={e.id}
              className="border-slate-200 shadow-xs cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => openHistory(e)}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {photos[0] ? (
                      <img
                        src={getFileUrl(e.id, photos[0], 'equipment', '64x64')}
                        alt=""
                        className="h-8 w-8 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                        <Icon className="h-4 w-4" />
                      </div>
                    )}
                    <h3 className="text-xs font-bold text-slate-900">{e.name}</h3>
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {e.type || 'other'}
                  </Badge>
                </div>
                <div className="text-[11px] text-slate-500 space-y-0.5">
                  <p>
                    <span className="font-semibold">Marca:</span> {e.brand || '-'}
                  </p>
                  <p>
                    <span className="font-semibold">Modelo:</span> {e.model || '-'}
                  </p>
                  <p>
                    <span className="font-semibold">Série:</span>{' '}
                    <span className="font-mono">{e.serial_number || '-'}</span>
                  </p>
                  <p>
                    <span className="font-semibold">Cliente:</span>{' '}
                    {e.expand?.customer?.name || '-'}
                  </p>
                </div>

                {/* Ações diretas do card: Editar e Abrir Imagens */}
                <div
                  className="pt-2 border-t border-slate-100 flex items-center justify-end gap-1.5"
                  onClick={(ev) => ev.stopPropagation()}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(e, 'photos')}
                    className="h-7 text-[11px] px-2 text-indigo-700 hover:bg-indigo-50 font-medium gap-1"
                    title="Abrir galeria de imagens do equipamento"
                  >
                    <ImageIcon className="h-3 w-3" />
                    <span>Fotos ({photos.length})</span>
                  </Button>
                  {canEditEquip && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(e, 'edit')}
                      className="h-7 text-[11px] px-2 border-slate-200 text-slate-700 hover:bg-slate-100 font-medium gap-1"
                      title="Editar cadastro do equipamento"
                    >
                      <Edit2 className="h-3 w-3 text-slate-500" />
                      <span>Editar</span>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
      {filtered.length === 0 && (
        <div className="py-12 text-center text-slate-400 text-sm">
          Nenhum equipamento encontrado.
        </div>
      )}

      <NewEquipmentModal open={modalOpen} onOpenChange={setModalOpen} onCreated={loadData} />
      <EquipmentHistoryDialog
        equipment={selectedEquip}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        onEdit={(eq) => {
          setHistoryOpen(false)
          openEdit(eq, 'edit')
        }}
        onOpenPhotos={(eq) => {
          setHistoryOpen(false)
          openEdit(eq, 'photos')
        }}
        canEdit={canEditEquip}
      />
      <EditEquipmentModal
        equipment={selectedEquip}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        defaultTab={editModalTab}
        canEdit={canEditEquip}
        onSaved={() => {
          loadData()
        }}
      />
    </div>
  )
}
