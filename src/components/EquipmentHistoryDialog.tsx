import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Link } from 'react-router-dom'
import { Equipment, ServiceOrder } from '@/types'
import { getEquipmentServiceOrders } from '@/services/equipment'
import { getFileUrl } from '@/lib/pocketbase/files'

import { Button } from '@/components/ui/button'
import { Edit2, ImageIcon } from 'lucide-react'

interface EquipmentHistoryDialogProps {
  equipment: Equipment | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (equipment: Equipment) => void
  onOpenPhotos?: (equipment: Equipment) => void
  canEdit?: boolean
}

export function EquipmentHistoryDialog({
  equipment,
  open,
  onOpenChange,
  onEdit,
  onOpenPhotos,
  canEdit = true,
}: EquipmentHistoryDialogProps) {
  const [orders, setOrders] = useState<ServiceOrder[]>([])

  useEffect(() => {
    if (open && equipment) {
      getEquipmentServiceOrders(equipment.id)
        .then(setOrders)
        .catch(() => setOrders([]))
    }
  }, [open, equipment])

  if (!equipment) return null
  const photos = equipment.photos || []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <DialogTitle className="text-lg font-bold text-slate-900">{equipment.name}</DialogTitle>
            <p className="text-xs text-slate-500">
              {equipment.expand?.customer?.name
                ? `Cliente: ${equipment.expand.customer.name}`
                : 'Histórico e detalhes do equipamento'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 mr-6">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (onOpenPhotos) onOpenPhotos(equipment)
              }}
              className="h-8 text-xs gap-1 border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100"
              title="Abrir galeria de imagens do equipamento"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              <span>Fotos ({photos.length})</span>
            </Button>
            {canEdit && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (onEdit) onEdit(equipment)
                }}
                className="h-8 text-xs gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                title="Editar dados e fotos do equipamento"
              >
                <Edit2 className="h-3.5 w-3.5" />
                <span>Editar</span>
              </Button>
            )}
          </div>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="font-semibold text-slate-500">Marca:</span>
              <p className="text-slate-900">{equipment.brand || '-'}</p>
            </div>
            <div>
              <span className="font-semibold text-slate-500">Modelo:</span>
              <p className="text-slate-900">{equipment.model || '-'}</p>
            </div>
            <div>
              <span className="font-semibold text-slate-500">Série:</span>
              <p className="font-mono text-slate-900">{equipment.serial_number || '-'}</p>
            </div>
            <div>
              <span className="font-semibold text-slate-500">Cliente:</span>
              <p className="text-slate-900">{equipment.expand?.customer?.name || '-'}</p>
            </div>
          </div>
          {photos.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  Fotos cadastradas ({photos.length})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenPhotos) onOpenPhotos(equipment)
                  }}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold"
                >
                  Abrir visualizador completo →
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {photos.map((p, i) => (
                  <img
                    key={i}
                    src={getFileUrl(equipment.id, p, 'equipment', '200x200')}
                    alt=""
                    onClick={() => {
                      if (onOpenPhotos) onOpenPhotos(equipment)
                    }}
                    className="w-20 h-20 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-90 hover:scale-105 transition-all shadow-xs"
                    title="Clique para abrir e ampliar"
                  />
                ))}
              </div>
            </div>
          )}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-2">Histórico de Reparos</h3>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-y border-slate-200 text-slate-500 font-semibold">
                <tr>
                  <th className="py-2 px-3">Número</th>
                  <th className="py-2 px-3">Título</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="py-2 px-3 font-mono font-bold text-indigo-600">
                      <Link to={`/ordens/${o.id}`}>{o.number}</Link>
                    </td>
                    <td className="py-2 px-3 font-medium">{o.title}</td>
                    <td className="py-2 px-3">
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {o.status}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 text-slate-500">
                      {o.created?.substring(0, 10).split('-').reverse().join('/')}
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400">
                      Nenhum reparo registrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
