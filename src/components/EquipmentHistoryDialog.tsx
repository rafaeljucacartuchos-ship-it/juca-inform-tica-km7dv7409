import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Link } from 'react-router-dom'
import { Equipment, ServiceOrder } from '@/types'
import { getEquipmentServiceOrders } from '@/services/equipment'
import { getFileUrl } from '@/lib/pocketbase/files'

interface EquipmentHistoryDialogProps {
  equipment: Equipment | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EquipmentHistoryDialog({
  equipment,
  open,
  onOpenChange,
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
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">{equipment.name}</DialogTitle>
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
            <div className="flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <img
                  key={i}
                  src={getFileUrl(equipment.id, p, 'equipment', '200x200')}
                  alt=""
                  className="w-20 h-20 object-cover rounded-lg border border-slate-200"
                />
              ))}
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
