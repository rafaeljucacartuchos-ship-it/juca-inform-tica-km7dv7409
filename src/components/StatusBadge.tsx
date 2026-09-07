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
    case 'aguardando_orcamento':
      return (
        <Badge className="bg-cyan-100 text-cyan-800 border-cyan-200 hover:bg-cyan-100">
          Aguardando Orçamento
        </Badge>
      )
    case 'orcamento_enviado':
      return (
        <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 hover:bg-indigo-100">
          Orçamento Enviado
        </Badge>
      )
    case 'orcamento_rejeitado':
      return (
        <Badge className="bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-100">
          Orçamento Rejeitado
        </Badge>
      )
    default:
      return <Badge variant="outline">Cancelada</Badge>
  }
}
