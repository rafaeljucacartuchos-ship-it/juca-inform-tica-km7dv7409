import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  FileText,
  Search,
  Plus,
  RefreshCw,
  Printer,
  Trash2,
  Edit,
  ExternalLink,
  Wrench,
  Monitor,
  User as UserIcon,
  ShieldCheck,
  Calendar,
  AlertCircle,
  FileCheck2,
} from 'lucide-react'
import { getLaudos, deleteLaudo } from '@/services/laudos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/hooks/use-auth'
import type { LaudoTecnico } from '@/types'

export function LaudosList() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [laudos, setLaudos] = useState<LaudoTecnico[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('todos')

  // Exclusão
  const [laudoToDelete, setLaudoToDelete] = useState<LaudoTecnico | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const list = await getLaudos()
      setLaudos(list)
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao carregar laudos técnicos', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime('laudos_tecnicos', () => {
    loadData()
  })

  // Filtros
  const filteredLaudos = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()
    return laudos.filter((laudo) => {
      // Filtro status
      if (statusFilter !== 'todos' && laudo.status !== statusFilter) {
        return false
      }

      if (!term) return true

      const matchNum = laudo.numero_laudo?.toLowerCase().includes(term)
      const matchCliente =
        laudo.cliente_nome?.toLowerCase().includes(term) ||
        laudo.expand?.id_cliente?.name?.toLowerCase().includes(term)
      const matchEquip =
        laudo.equipamento_nome?.toLowerCase().includes(term) ||
        laudo.equipamento_modelo?.toLowerCase().includes(term) ||
        laudo.equipamento_fabricante?.toLowerCase().includes(term) ||
        laudo.equipamento_serial?.toLowerCase().includes(term)
      const matchOs = laudo.expand?.id_ordem?.number?.toLowerCase().includes(term)
      const matchOrc = laudo.expand?.id_orcamento?.numero_orcamento?.toLowerCase().includes(term)
      const matchDiag = laudo.diagnostico_tecnico?.toLowerCase().includes(term)

      return Boolean(matchNum || matchCliente || matchEquip || matchOs || matchOrc || matchDiag)
    })
  }, [laudos, searchTerm, statusFilter])

  const handleDelete = async () => {
    if (!laudoToDelete) return
    setDeleting(true)
    try {
      await deleteLaudo(laudoToDelete.id)
      toast({ title: 'Laudo técnico excluído com sucesso!' })
      setLaudoToDelete(null)
      loadData()
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao excluir laudo', variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <FileCheck2 className="h-6 w-6 text-indigo-600" />
            Laudos Técnicos
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Emissão de laudos periciais e diagnósticos técnicos vinculados a O.S., orçamentos e
            equipamentos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="h-9 text-xs gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            size="sm"
            onClick={() => navigate('/laudos/novo')}
            className="h-9 text-xs font-bold gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Novo Laudo Técnico
          </Button>
        </div>
      </div>

      {/* BARRA DE FILTROS E BUSCA */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por número do laudo, cliente, equipamento, modelo, O.S., serial..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 text-xs bg-white"
          />
        </div>

        <div className="w-full sm:w-48">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10 text-xs bg-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Status</SelectItem>
              <SelectItem value="rascunho">Apenas Rascunho</SelectItem>
              <SelectItem value="finalizado">Apenas Finalizados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* LISTAGEM DOS LAUDOS */}
      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500">Carregando laudos técnicos...</p>
        </div>
      ) : filteredLaudos.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-slate-200 bg-white p-12 text-center">
          <FileCheck2 className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">Nenhum laudo técnico encontrado</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            {searchTerm || statusFilter !== 'todos'
              ? 'Tente ajustar os filtros de busca para encontrar o laudo desejado.'
              : 'Gere laudos técnicos vinculando a uma Ordem de Serviço ou orçamento existente.'}
          </p>
          <Button
            size="sm"
            onClick={() => navigate('/laudos/novo')}
            className="h-9 text-xs font-bold gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="h-4 w-4" />
            Criar Primeiro Laudo
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLaudos.map((laudo) => {
            const dataFmt = new Date(
              laudo.data_laudo || laudo.created || Date.now(),
            ).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })
            const cliente =
              laudo.cliente_nome || laudo.expand?.id_cliente?.name || 'Cliente não informado'
            const equip =
              laudo.equipamento_nome ||
              laudo.expand?.id_equipamento?.name ||
              'Equipamento não especificado'
            const modelo = laudo.equipamento_modelo || laudo.expand?.id_equipamento?.model || ''
            const osNum = laudo.expand?.id_ordem?.number
            const orcNum = laudo.expand?.id_orcamento?.numero_orcamento

            return (
              <div
                key={laudo.id}
                className="group flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all"
              >
                <div className="space-y-3">
                  {/* TOPO: NÚMERO DO LAUDO E STATUS */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-extrabold text-indigo-950">
                        {laudo.numero_laudo}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        laudo.status === 'finalizado'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {laudo.status === 'finalizado' ? 'Finalizado' : 'Rascunho'}
                    </span>
                  </div>

                  {/* VÍNCULOS COM O.S. E ORÇAMENTO */}
                  {(osNum || orcNum) && (
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      {osNum && (
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          <Wrench className="h-3 w-3 text-indigo-600" />
                          O.S. #{osNum}
                        </span>
                      )}
                      {orcNum && (
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          <FileText className="h-3 w-3 text-indigo-600" />
                          {orcNum}
                        </span>
                      )}
                    </div>
                  )}

                  {/* DADOS DO CLIENTE */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Cliente
                    </span>
                    <p className="font-bold text-xs text-slate-900 truncate">{cliente}</p>
                  </div>

                  {/* EQUIPAMENTO IMPORTADO */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Equipamento
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-slate-800">
                      <Monitor className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="font-medium truncate">
                        {equip} {modelo ? `(${modelo})` : ''}
                      </span>
                    </div>
                    {laudo.equipamento_serial && (
                      <p className="text-[10px] text-slate-500 font-mono pl-5">
                        S/N: {laudo.equipamento_serial}
                      </p>
                    )}
                  </div>

                  {/* PREVIEW DO DIAGNÓSTICO */}
                  {laudo.diagnostico_tecnico && (
                    <div className="space-y-1 pt-1 border-t border-slate-100">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Diagnóstico Técnico
                      </span>
                      <p className="text-xs text-slate-600 line-clamp-2 italic">
                        "{laudo.diagnostico_tecnico}"
                      </p>
                    </div>
                  )}
                </div>

                {/* RODAPÉ DO CARD COM AÇÕES */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {dataFmt}
                  </span>

                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`/laudos/${laudo.id}/imprimir`)}
                      className="h-8 w-8 p-0 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"
                      title="Imprimir Laudo"
                    >
                      <Printer className="h-4 w-4" />
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`/laudos/${laudo.id}`)}
                      className="h-8 px-2.5 text-xs text-indigo-600 hover:bg-indigo-50 font-semibold"
                    >
                      <Edit className="h-3.5 w-3.5 mr-1" />
                      Editar
                    </Button>

                    {user?.role === 'admin' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setLaudoToDelete(laudo)}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                        title="Excluir Laudo"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* DIÁLOGO DE CONFIRMAÇÃO DE EXCLUSÃO */}
      <AlertDialog
        open={Boolean(laudoToDelete)}
        onOpenChange={(open) => !open && setLaudoToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Excluir Laudo Técnico?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-xs text-slate-600">
              <p>
                Tem certeza que deseja excluir permanentemente o laudo técnico{' '}
                <strong className="text-slate-900 font-mono">{laudoToDelete?.numero_laudo}</strong>?
              </p>
              <p className="text-red-600 font-semibold bg-red-50 p-2 rounded border border-red-100">
                Esta ação é irreversível. O snapshot dos diagnósticos e pareceres técnicos será
                removido do banco de dados.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              {deleting ? 'Excluindo...' : 'Sim, Excluir Laudo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default LaudosList
