import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { getUsers } from '@/services/users'
import { offlinePb } from '@/lib/offline-pb'
import { ServiceOrder, User } from '@/types'
import { ArrowRightLeft, UserCheck, Wrench, Laptop, User as UserIcon } from 'lucide-react'

interface TransferTechnicianModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: ServiceOrder | null
  onTransferred?: () => void
}

export function TransferTechnicianModal({
  open,
  onOpenChange,
  order,
  onTransferred,
}: TransferTechnicianModalProps) {
  const { user } = useAuth()
  const { toast } = useToast()

  const [users, setUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [selectedTechId, setSelectedTechId] = useState<string>('')
  const [reason, setReason] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  // Carrega a mesma lista de usuários/responsáveis do sistema usada nos orçamentos
  useEffect(() => {
    if (open) {
      setLoadingUsers(true)
      getUsers()
        .then((data) => {
          setUsers(data)
        })
        .catch(() => {
          toast({
            title: 'Erro ao carregar lista de profissionais',
            variant: 'destructive',
          })
        })
        .finally(() => {
          setLoadingUsers(false)
        })

      setSelectedTechId('')
      setReason('')
    }
  }, [open, toast])

  if (!order) return null

  const currentTechId = order.technician || order.expand?.technician?.id || ''
  const currentTechName = order.expand?.technician?.name || 'Não atribuído'
  const customerName = order.expand?.customer?.name || 'Não informado'
  const equipmentName = order.equipment || order.expand?.equipment_ref?.name || 'Não informado'

  const handleConfirm = async () => {
    if (!selectedTechId) {
      toast({
        title: 'Selecione o novo técnico',
        description: 'É necessário escolher o técnico ou responsável que receberá a O.S.',
        variant: 'destructive',
      })
      return
    }

    if (selectedTechId === currentTechId) {
      toast({
        title: 'Técnico idêntico',
        description: 'A O.S. já está atribuída a este profissional. Escolha outro.',
        variant: 'destructive',
      })
      return
    }

    const newTech = users.find((u) => u.id === selectedTechId)
    const newTechName = newTech?.name || 'Novo técnico'

    setSubmitting(true)
    try {
      // 1. Atualiza o técnico responsável da O.S. via offlinePb (compatível offline/online)
      const upd = await offlinePb.update('service_orders', order.id, {
        technician: selectedTechId,
      })

      // 2. Monta nota para o histórico
      const cleanReason = reason.trim()
      const historyNote = cleanReason
        ? `O.S. transferida de ${currentTechName} para ${newTechName}. Motivo: ${cleanReason}`
        : `O.S. transferida de ${currentTechName} para ${newTechName}`

      // 3. Registra no histórico da ordem (status_history)
      await offlinePb.create('status_history', {
        service_order: order.id,
        status: order.status,
        note: historyNote,
        changed_by: user?.id,
      })

      // 4. Cria notificação interna para o novo técnico
      try {
        await offlinePb.create('notifications', {
          user: selectedTechId,
          title: `O.S. #${order.number} transferida para você`,
          message: cleanReason
            ? `Transferida de ${currentTechName}. Motivo: ${cleanReason}`
            : `Ordem de serviço #${order.number} transferida de ${currentTechName} para você.`,
          type: 'service_order',
          read: false,
          link: `/ordens/${order.id}`,
        })
      } catch (errNotif) {
        // Fallback não-bloqueante se hook do PB já registrar
        console.warn('Notificação de transferência (log):', errNotif)
      }

      toast({
        title: 'O.S. transferida com sucesso!',
        description: `Ordem #${order.number} agora está sob responsabilidade de ${newTechName}.${
          upd.queued ? ' (Salvo offline, sincronizará ao reconectar)' : ''
        }`,
      })

      onOpenChange(false)
      onTransferred?.()
    } catch {
      toast({
        title: 'Erro ao transferir ordem de serviço',
        description: 'Não foi possível atualizar o técnico responsável. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-indigo-50 text-indigo-600">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                Transferir Ordem de Serviço
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Atribua a responsabilidade desta O.S. a outro técnico da equipe.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3.5 py-1 text-xs">
          {/* Card com resumo da O.S. */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
              <span className="font-semibold text-slate-500">Número da O.S.:</span>
              <span className="font-mono font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">
                {order.number}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-500 flex items-center gap-1">
                <UserIcon className="h-3.5 w-3.5 text-slate-400" /> Cliente:
              </span>
              <span
                className="font-medium text-slate-900 truncate max-w-[200px]"
                title={customerName}
              >
                {customerName}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-500 flex items-center gap-1">
                <Laptop className="h-3.5 w-3.5 text-slate-400" /> Equipamento:
              </span>
              <span
                className="font-medium text-slate-900 truncate max-w-[200px]"
                title={equipmentName}
              >
                {equipmentName}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
              <span className="font-semibold text-slate-500 flex items-center gap-1">
                <Wrench className="h-3.5 w-3.5 text-amber-500" /> Técnico Atual:
              </span>
              <span className="font-bold text-slate-800">{currentTechName}</span>
            </div>
          </div>

          {/* Seleção do Novo Técnico */}
          <div className="space-y-1.5">
            <Label
              htmlFor="novo-tecnico"
              className="text-xs font-semibold text-slate-700 flex items-center gap-1"
            >
              <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
              Novo Técnico / Responsável *
            </Label>
            <Select
              value={selectedTechId}
              onValueChange={setSelectedTechId}
              disabled={loadingUsers || submitting}
            >
              <SelectTrigger id="novo-tecnico" className="h-9 text-xs bg-white">
                <SelectValue
                  placeholder={
                    loadingUsers ? 'Carregando equipe...' : 'Selecione o novo técnico...'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => {
                  const isCurrent = u.id === currentTechId
                  const roleLabel =
                    u.role === 'technician'
                      ? 'Técnico'
                      : u.role === 'admin'
                        ? 'Administrador'
                        : 'Atendente/Vendedor'
                  return (
                    <SelectItem key={u.id} value={u.id} disabled={isCurrent} className="text-xs">
                      {`${u.name} (${roleLabel})${isCurrent ? ' — Atual' : ''}`}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-slate-400">
              O novo técnico passará a visualizar esta O.S. imediatamente em seu painel.
            </p>
          </div>

          {/* Motivo / Observação */}
          <div className="space-y-1.5">
            <Label htmlFor="motivo-transferencia" className="text-xs font-semibold text-slate-700">
              Motivo da Transferência <span className="text-slate-400 font-normal">(opcional)</span>
            </Label>
            <Textarea
              id="motivo-transferencia"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={submitting}
              placeholder="Ex: Mudança de turno, especialidade em placa-mãe, redistribuição de demanda..."
              rows={2}
              className="text-xs resize-none bg-white"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="text-xs h-8"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={submitting || !selectedTechId || selectedTechId === currentTechId}
            className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-1.5"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            <span>{submitting ? 'Transferindo...' : 'Confirmar Transferência'}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
