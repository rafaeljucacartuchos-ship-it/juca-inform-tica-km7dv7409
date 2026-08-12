import { useState, useEffect } from 'react'
import { Search, Monitor, Laptop, Smartphone, Printer } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Equipment } from '@/types'
import { getEquipment } from '@/services/equipment'
import { useRealtime } from '@/hooks/use-realtime'

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

  const loadData = async () => {
    try {
      const data = await getEquipment()
      setEquipment(data)
    } catch {
      /* ignored */
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Equipamentos</h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Base de equipamentos cadastrados dos clientes.
        </p>
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
          return (
            <Card key={e.id} className="border-slate-200 shadow-xs">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                      <Icon className="h-4 w-4" />
                    </div>
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
    </div>
  )
}
