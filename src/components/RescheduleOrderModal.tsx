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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { offlinePb } from '@/lib/offline-pb'
import { ServiceOrder } from '@/types'
import { CalendarClock, Calendar, Clock, Laptop, User as UserIcon, Wrench } from 'lucide-react'

interface RescheduleOrderModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: ServiceOrder | null
  onRescheduled?: () => void
}

/** Formata data ISO (YYYY-MM-DD) para pt-BR (DD/MM/AAAA) */
function formatDateBr(isoDate: string): string {
  if (!isoDate) return ''
  const parts = isoDate.split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return isoDate
}

export function RescheduleOrderModal({
  open,
  onOpenChange,
  order,
  onRescheduled,
}: RescheduleOrderModalProps) {
  const { user } = useAuth()
  const { toast } = useToast()

  const todayStr = new Date().toISOString().substring(0, 10)

  const [newDate, setNewDate] = useState<string>('')
  const [newTime, setNewTime] = useState<string>('')
  const [reason, setReason] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<{ date?: string; time?: string }>({})

  // Inicializa os campos quando a modal abre
  useEffect(() => {
    if (open && order) {
      // Se a OS já tem attendance_date, podemos sugerir ou preencher
      setNewDate(order.attendance_date || todayStr)
      setNewTime(order.attendance_time || '')
      setReason('')
      setErrors({})
    }
  }, [open, order, todayStr])

  if (!order) return null

  const isFinalizada = order.status === 'completed' || order.status === 'closed'
  const customerName =
    order.expand?.customer?.razao_social ||
    order.expand?.customer?.nome_fantasia ||
    order.expand?.customer?.name ||
    'Não informado'
  const equipmentName = order.equipment || order.expand?.equipment_ref?.name || 'Não informado'
  const techName = order.expand?.technician?.name || 'Não atribuído'

  const currentFormattedDate = order.attendance_date
    ? formatDateBr(order.attendance_date)
    : 'Não agendado'
  const currentFormattedTime = order.attendance_time || ''

  const handleTimeChange = (raw: string) => {
    let clean = raw.replace(/\D/g, '')
    if (clean.length > 4) clean = clean.slice(0, 4)
    let formatted = clean
    if (clean.length >= 3) {
      formatted = `${clean.slice(0, 2)}:${clean.slice(2)}`
    }
    setNewTime(formatted)
    if (errors.time) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next.time
        return next
      })
    }
  }

  const handleConfirm = async () => {
    if (isFinalizada) {
      toast({
        title: 'O.S. finalizada',
        description: 'Não é possível reagendar uma ordem de serviço concluída ou fechada.',
        variant: 'destructive',
      })
      return
    }

    const newErrors: { date?: string; time?: string } = {}
    if (!newDate) {
      newErrors.date = 'Selecione a nova data para o atendimento'
    } else if (newDate < todayStr) {
      newErrors.date = 'A nova data deve ser igual ou posterior a hoje'
    }

    if (!newTime) {
      newErrors.time = 'Informe o horário do atendimento (HH:MM)'
    } else {
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/
      if (!timeRegex.test(newTime)) {
        newErrors.time = 'Horário inválido. Use o formato HH:MM (00:00 a 23:59)'
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    // Se data e hora forem idênticas às já salvas
    if (newDate === order.attendance_date && newTime === order.attendance_time) {
      toast({
        title: 'Data e horário idênticos',
        description: 'Escolha uma data ou horário diferente do agendamento atual.',
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)
    try {
      const formattedBr = formatDateBr(newDate)
      const cleanReason = reason.trim()

      // 1. Atualiza a O.S. com a nova data e hora
      const upd = await offlinePb.update('service_orders', order.id, {
        attendance_date: newDate,
        attendance_time: newTime,
      })

      // 2. Se houver agendamento vinculado em appointments, atualiza também para sincronismo da agenda
      const linkedApptId = order.appointment || order.expand?.appointment?.id
      if (linkedApptId) {
        try {
          await offlinePb.update('appointments', linkedApptId, {
            date: `${newDate} 00:00:00.000Z`,
            start_time: newTime,
          })
        } catch (errAppt) {
          console.warn('Atualização de appointment vinculado (log):', errAppt)
        }
      }

      // 3. Monta nota descritiva para o histórico (status_history)
      const prevDateText = order.attendance_date
        ? `${formatDateBr(order.attendance_date)}${order.attendance_time ? ` às ${order.attendance_time}` : ''}`
        : 'sem agendamento prévio'
      const newDateText = `${formattedBr} às ${newTime}`
      const historyNote = cleanReason
        ? `Reagendamento de atendimento: de ${prevDateText} para ${newDateText}. Motivo: ${cleanReason}`
        : `Reagendamento de atendimento: de ${prevDateText} para ${newDateText}`

      await offlinePb.create('status_history', {
        service_order: order.id,
        status: order.status,
        note: historyNote,
        changed_by: user?.id,
      })

      // 4. Cria notificação interna para o técnico responsável, se houver
      const techId = order.technician || order.expand?.technician?.id
      if (techId) {
        try {
          await offlinePb.create('notifications', {
            user: techId,
            title: `O.S. #${order.number} reagendada`,
            message: cleanReason
              ? `Novo agendamento: ${formattedBr} às ${newTime}. Motivo: ${cleanReason}`
              : `Atendimento da O.S. #${order.number} reagendado para ${formattedBr} às ${newTime}.`,
            type: 'service_order',
            read: false,
            link: `/ordens/${order.id}`,
          })
        } catch (errNotif) {
          console.warn('Notificação de reagendamento (log):', errNotif)
        }
      }

      toast({
        title: 'O.S. reagendada com sucesso!',
        description: `Novo atendimento agendado para ${formattedBr} às ${newTime}.${
          upd.queued ? ' (Salvo offline, sincronizará ao reconectar)' : ''
        }`,
      })

      onOpenChange(false)
      onRescheduled?.()
    } catch {
      toast({
        title: 'Erro ao reagendar ordem de serviço',
        description: 'Não foi possível atualizar o agendamento da O.S. Tente novamente.',
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
            <div className="p-2 rounded-full bg-blue-50 text-blue-600">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                Reagendar Ordem de Serviço
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Altere a data e horário previstos para o atendimento técnico desta O.S.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isFinalizada ? (
          <div className="py-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
            <p className="font-bold">Esta ordem de serviço já foi concluída ou fechada.</p>
            <p className="text-amber-700">
              Não é permitido reagendar ordens de serviço finalizadas. Reabra a O.S. se precisar
              realizar novo atendimento.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5 py-1 text-xs">
            {/* Card com resumo da O.S. e agendamento atual */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                <span className="font-semibold text-slate-500">Número da O.S.:</span>
                <span className="font-mono font-bold text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200">
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

              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-500 flex items-center gap-1">
                  <Wrench className="h-3.5 w-3.5 text-indigo-500" /> Técnico:
                </span>
                <span className="font-medium text-slate-800 truncate max-w-[200px]">
                  {techName}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/60">
                <span className="font-semibold text-slate-500 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-amber-500" /> Agendamento Atual:
                </span>
                <span className="font-bold text-slate-800">
                  {currentFormattedDate}
                  {currentFormattedTime ? ` às ${currentFormattedTime}` : ''}
                </span>
              </div>
            </div>

            {/* Nova Data e Horário */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="reagenda-data"
                  className="text-xs font-semibold text-slate-700 flex items-center gap-1"
                >
                  <Calendar className="h-3.5 w-3.5 text-blue-600" />
                  Nova Data *
                </Label>
                <Input
                  id="reagenda-data"
                  type="date"
                  min={todayStr}
                  value={newDate}
                  onChange={(e) => {
                    setNewDate(e.target.value)
                    if (errors.date) {
                      setErrors((prev) => {
                        const next = { ...prev }
                        delete next.date
                        return next
                      })
                    }
                  }}
                  disabled={submitting}
                  className="h-9 text-xs bg-white font-mono"
                />
                {errors.date && <p className="text-[11px] text-red-500">{errors.date}</p>}
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="reagenda-hora"
                  className="text-xs font-semibold text-slate-700 flex items-center gap-1"
                >
                  <Clock className="h-3.5 w-3.5 text-blue-600" />
                  Novo Horário *
                </Label>
                <Input
                  id="reagenda-hora"
                  type="text"
                  inputMode="numeric"
                  placeholder="HH:MM"
                  maxLength={5}
                  value={newTime}
                  onChange={(e) => handleTimeChange(e.target.value)}
                  disabled={submitting}
                  className="h-9 text-xs bg-white font-mono"
                />
                {errors.time && <p className="text-[11px] text-red-500">{errors.time}</p>}
              </div>
            </div>

            {/* Motivo do Reagendamento */}
            <div className="space-y-1.5">
              <Label
                htmlFor="motivo-reagendamento"
                className="text-xs font-semibold text-slate-700"
              >
                Motivo do Reagendamento{' '}
                <span className="text-slate-400 font-normal">(opcional)</span>
              </Label>
              <Textarea
                id="motivo-reagendamento"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={submitting}
                placeholder="Ex: Cliente solicitou mudança para o período da tarde, aguardando chegada de peças..."
                rows={2}
                className="text-xs resize-none bg-white"
              />
              <p className="text-[11px] text-slate-400">
                Esta informação será registrada no histórico de acompanhamento da O.S.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="text-xs h-8"
          >
            {isFinalizada ? 'Fechar' : 'Cancelar'}
          </Button>
          {!isFinalizada && (
            <Button
              type="button"
              size="sm"
              onClick={handleConfirm}
              disabled={submitting}
              className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-1.5"
            >
              <CalendarClock className="h-3.5 w-3.5" />
              <span>{submitting ? 'Reagendando...' : 'Confirmar Reagendamento'}</span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
