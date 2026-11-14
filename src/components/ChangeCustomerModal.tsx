import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Loader2, Search, UserCog, X } from 'lucide-react'
import { getCustomerDisplayName, getCustomers } from '@/services/customers'
import { Customer, ServiceOrder } from '@/types'
import { offlinePb } from '@/lib/offline-pb'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions } from '@/hooks/use-permissions'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface ChangeCustomerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: ServiceOrder
  onCustomerChanged: (customer: Customer) => void
}

/**
 * Modal de troca de cliente em O.S. já lançada.
 * - Acesso: admin (bypass estrutural) ou usuário com a permissão 'os_trocar_cliente'.
 * - Usa o mecanismo offline (offlinePb) para atualizar o cliente e registrar o histórico.
 * - Em O.S. finalizada (completed/closed), exige digitar "CONFIRMAR".
 */
export function ChangeCustomerModal({
  open,
  onOpenChange,
  order,
  onCustomerChanged,
}: ChangeCustomerModalProps) {
  const { user } = useAuth()
  const { hasPermission } = usePermissions()
  const { toast } = useToast()

  const [search, setSearch] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Customer | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [saving, setSaving] = useState(false)

  const isFinalizada = order.status === 'completed' || order.status === 'closed'
  const currentCustomerId = order.customer
  const currentCustomerName = getCustomerDisplayName(order.expand?.customer)

  // Reset ao abrir + carga inicial da lista de clientes
  useEffect(() => {
    if (!open) return
    setSearch('')
    setSelected(null)
    setConfirmText('')
    setLoading(true)
    getCustomers('')
      .then((items) => setCustomers(items || []))
      .catch(() => setCustomers([]))
      .finally(() => setLoading(false))
  }, [open])

  // Busca incremental de clientes por nome/documento/telefone (debounce),
  // mesmo padrão de busca usado no OrderEquipmentModal.
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      setLoading(true)
      getCustomers(search)
        .then((items) => setCustomers(items || []))
        .catch(() => setCustomers([]))
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(timer)
  }, [search, open])

  const confirmationMissing = isFinalizada && confirmText.trim().toUpperCase() !== 'CONFIRMAR'

  const handleConfirm = async () => {
    if (!selected) return
    // Trava estrutural: mesmo que o modal seja aberto por caminho alternativo,
    // a troca só é executada por admin ou por quem recebeu a permissão granular.
    if (!(user?.role === 'admin' || hasPermission('os_trocar_cliente'))) {
      toast({
        title: 'Ação não permitida',
        description:
          'Somente o administrador (ou usuário autorizado por ele) pode trocar o cliente da O.S.',
        variant: 'destructive',
      })
      return
    }
    if (confirmationMissing) return

    setSaving(true)
    const newName = getCustomerDisplayName(selected)
    try {
      const upd = await offlinePb.update('service_orders', order.id, { customer: selected.id })
      if (upd.queued) {
        toast({ title: 'Cliente salvo localmente. Será sincronizado quando houver conexão.' })
      }
      const hist = await offlinePb.create('status_history', {
        service_order: order.id,
        status: order.status,
        note: `Cliente alterado de ${currentCustomerName} para ${newName} por ${user?.name || 'usuário'}`,
        changed_by: user?.id,
      })
      if (hist.queued) {
        toast({ title: 'Histórico salvo localmente. Será sincronizado quando houver conexão.' })
      }
      onCustomerChanged(selected)
      onOpenChange(false)
    } catch {
      toast({
        title: 'Erro ao trocar o cliente da O.S.',
        description: 'Tente novamente. Se o problema persistir, verifique sua conexão.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
              <UserCog className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                Trocar Cliente da O.S. {order.number}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Cliente atual: <strong className="text-slate-700">{currentCustomerName}</strong>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* Aviso de preservação dos vínculos */}
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-900">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Os orçamentos, laudos e registros já vinculados permanecem nesta O.S. e passam a
              pertencer ao novo cliente.
            </span>
          </div>

          {/* Busca de clientes */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Buscar cliente por nome, documento ou telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-8 h-10 text-xs sm:text-sm bg-slate-50/70 border-slate-200 focus:bg-white"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Lista de resultados */}
          <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 p-2 space-y-1.5">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
                <span className="text-xs">Buscando clientes...</span>
              </div>
            ) : customers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <p className="text-xs font-semibold text-slate-600">
                  {search
                    ? `Nenhum cliente encontrado para "${search}".`
                    : 'Nenhum cliente cadastrado no sistema.'}
                </p>
              </div>
            ) : (
              customers.map((c) => {
                const isCurrent = c.id === currentCustomerId
                const isSelected = selected?.id === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={isCurrent || saving}
                    onClick={() => setSelected(c)}
                    className={cn(
                      'w-full text-left p-2.5 rounded-lg border bg-white transition-all flex items-center justify-between gap-2 disabled:cursor-not-allowed hover:border-violet-300',
                      isSelected && 'border-violet-400 bg-violet-50/50 ring-1 ring-violet-300',
                      isCurrent && 'border-slate-200 opacity-70',
                    )}
                  >
                    <div className="min-w-0">
                      <span className="block font-semibold text-xs text-slate-900 truncate">
                        {getCustomerDisplayName(c)}
                      </span>
                      <span className="block text-[11px] text-slate-500 truncate">
                        {[c.cpf_cnpj, c.celular || c.phone].filter(Boolean).join(' • ') ||
                          'Sem documento/telefone'}
                      </span>
                    </div>
                    {isCurrent ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-slate-100 text-slate-500 border-slate-200 shrink-0"
                      >
                        Cliente atual
                      </Badge>
                    ) : isSelected ? (
                      <Badge className="text-[10px] bg-violet-600 text-white border-violet-600 shrink-0">
                        Selecionado
                      </Badge>
                    ) : null}
                  </button>
                )
              })
            )}
          </div>

          {/* Confirmação extra para O.S. finalizada */}
          {isFinalizada && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 space-y-2">
              <p className="text-[11px] text-rose-800 font-semibold">
                Esta O.S. está finalizada (status{' '}
                {order.status === 'completed' ? 'Concluída' : 'Fechada'}). Para confirmar a troca de
                cliente, digite <span className="font-mono font-bold">CONFIRMAR</span> abaixo:
              </p>
              <Input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Digite CONFIRMAR"
                className="h-9 text-xs border-rose-300 focus-visible:ring-rose-400"
              />
            </div>
          )}
        </div>

        <DialogFooter className="pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!selected || saving || confirmationMissing}
            onClick={handleConfirm}
            className="bg-violet-600 hover:bg-violet-700 text-white font-bold"
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Alterando...</span>
              </>
            ) : (
              'Confirmar Troca de Cliente'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
