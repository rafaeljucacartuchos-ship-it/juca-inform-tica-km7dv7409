import pb from '@/lib/pocketbase/client'
import { Appointment } from '@/types'

export const getAppointments = (dateFilter?: string, techId?: string) => {
  const filters: string[] = []
  if (dateFilter) {
    filters.push(`date >= "${dateFilter} 00:00:00.000Z" && date <= "${dateFilter} 23:59:59.999Z"`)
  }
  if (techId) {
    filters.push(`technician = "${techId}"`)
  }

  return pb.collection('appointments').getFullList<Appointment>({
    filter: filters.join(' && '),
    expand: 'customer,technician',
    sort: 'date,start_time',
  })
}

export const createAppointment = (data: Partial<Appointment>) =>
  pb.collection('appointments').create<Appointment>(data, { expand: 'customer,technician' })

export const updateAppointment = (id: string, data: Partial<Appointment>) =>
  pb.collection('appointments').update<Appointment>(id, data, { expand: 'customer,technician' })

export const deleteAppointment = (id: string) => pb.collection('appointments').delete(id)
