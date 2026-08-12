import { useState, useEffect } from 'react'
import {
  Calendar as CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  UserCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Appointment, User } from '@/types'
import { getAppointments, updateAppointment } from '@/services/appointments'
import { getTechnicians } from '@/services/users'
import { NewAppointmentModal } from '@/components/NewAppointmentModal'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'

export default function Agendamentos() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [technicians, setTechnicians] = useState<User[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().substring(0, 10))
  const [newModalOpen, setNewModalOpen] = useState(false)
  const { toast } = useToast()
  const { user } = useAuth()

  const loadData = async () => {
    try {
      const techId = user?.role === 'technician' ? user?.id : undefined
      const [appts, techs] = await Promise.all([
        getAppointments(undefined, techId),
        getTechnicians(),
      ])
      setAppointments(appts)
      setTechnicians(techs)
    } catch {
      /* intentionally ignored */
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime('appointments', loadData)

  const selectedDayAppts = appointments.filter((a) => a.date?.substring(0, 10) === selectedDate)

  const handleStatusChange = async (id: string, status: any) => {
    try {
      await updateAppointment(id, { status })
      toast({ title: 'Status do agendamento atualizado!' })
      loadData()
    } catch (_) {
      toast({ title: 'Erro ao atualizar agendamento', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Agenda de Visitas Técnicas
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Gerencie o calendário de atendimento presencial e deslocamento dos técnicos.
          </p>
        </div>
        <Button
          onClick={() => setNewModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 h-9 text-xs sm:text-sm"
        >
          <Plus className="h-4 w-4" />
          <span>Novo Agendamento</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-bold text-slate-900">
              Selecione a Data de Atendimento
            </CardTitle>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-8 px-2 text-xs border border-slate-200 rounded-md bg-slate-50 font-mono"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-600">
                Agendamentos para {selectedDate.split('-').reverse().join('/')}:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {selectedDayAppts.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-col justify-between rounded-xl border border-slate-200 p-3.5 bg-white shadow-xs hover:border-indigo-200 transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-xs font-bold text-indigo-600">
                          {a.start_time} - {a.end_time || '18:00'}
                        </span>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {a.status}
                        </Badge>
                      </div>
                      <h3 className="text-xs font-bold text-slate-900">
                        {a.expand?.customer?.name || 'Cliente'}
                      </h3>
                      {a.expand?.customer?.phone && (
                        <p className="text-[11px] text-slate-500">{a.expand.customer.phone}</p>
                      )}
                      {a.address_note && (
                        <p className="text-[11px] text-slate-600 mt-1 flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-slate-400" /> {a.address_note}
                        </p>
                      )}
                      {a.expand?.technician && (
                        <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                          <UserCheck className="h-3 w-3 text-indigo-500" />{' '}
                          {a.expand.technician.name}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-end gap-1">
                      {a.status === 'scheduled' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleStatusChange(a.id, 'in_progress')}
                          className="h-7 text-[11px] text-purple-600 hover:bg-purple-50"
                        >
                          Iniciar Visita
                        </Button>
                      )}
                      {a.status === 'in_progress' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleStatusChange(a.id, 'completed')}
                          className="h-7 text-[11px] text-emerald-600 hover:bg-emerald-50"
                        >
                          Concluir
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {selectedDayAppts.length === 0 && (
                  <div className="col-span-full py-12 text-center text-slate-400 text-xs">
                    Nenhum agendamento cadastrado para esta data.
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-slate-900">
              Próximos Agendamentos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {appointments.slice(0, 6).map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-3 rounded-lg border border-slate-100 p-2.5 bg-slate-50/50"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-100 text-indigo-700 text-xs font-bold">
                  <CalendarIcon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0 text-xs">
                  <p className="font-semibold text-slate-900 truncate">
                    {a.expand?.customer?.name}
                  </p>
                  <p className="text-[11px] font-mono text-slate-500">
                    {a.date?.substring(0, 10).split('-').reverse().join('/')} às {a.start_time}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <NewAppointmentModal
        open={newModalOpen}
        onOpenChange={setNewModalOpen}
        defaultDate={selectedDate}
        onCreated={loadData}
      />
    </div>
  )
}
