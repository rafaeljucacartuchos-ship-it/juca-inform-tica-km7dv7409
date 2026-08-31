import { Badge } from '@/components/ui/badge'

export function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'open':
      return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Aberta</Badge>
    case 'in_progress':
      return (
        <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">Em Andamento</Badge>
      )
    case 'paused':
      return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">Pausada</Badge>
    case 'waiting_parts':
      return (
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Aguardando Peças</Badge>
      )
    case 'completed':
      return (
        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Concluída</Badge>
      )
    case 'closed':
      return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">Fechada</Badge>
    default:
      return <Badge variant="outline">Cancelada</Badge>
  }
}
