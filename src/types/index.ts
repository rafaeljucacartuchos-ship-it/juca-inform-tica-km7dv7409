export type UserRole = 'admin' | 'attendant' | 'technician'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  phone?: string
  avatar?: string
  created?: string
  updated?: string
}

export interface Customer {
  id: string
  name: string
  email?: string
  phone: string
  street?: string
  number?: string
  city?: string
  state?: string
  zip?: string
  notes?: string
  created?: string
  updated?: string
}

export type AppointmentStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'

export interface Appointment {
  id: string
  customer: string
  technician: string
  date: string
  start_time?: string
  end_time?: string
  status: AppointmentStatus
  address_note?: string
  notes?: string
  created?: string
  updated?: string
  expand?: {
    customer?: Customer
    technician?: User
  }
}

export type OrderStatus =
  | 'open'
  | 'in_progress'
  | 'waiting_parts'
  | 'completed'
  | 'closed'
  | 'cancelled'
export type OrderPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface ServiceOrder {
  id: string
  number: string
  customer: string
  technician?: string
  appointment?: string
  status: OrderStatus
  priority: OrderPriority
  title: string
  description?: string
  equipment?: string
  diagnostic?: string
  estimated_cost?: number
  total?: number
  notes?: string
  created?: string
  updated?: string
  expand?: {
    customer?: Customer
    technician?: User
    appointment?: Appointment
  }
}

export interface CatalogService {
  id: string
  name: string
  description?: string
  price: number
  estimated_duration: number
  active: boolean
  created?: string
  updated?: string
}

export interface ServiceOrderItem {
  id: string
  service_order: string
  service?: string
  description: string
  quantity: number
  unit_price: number
  total: number
  created?: string
  updated?: string
  expand?: {
    service?: CatalogService
  }
}

export interface StatusHistory {
  id: string
  service_order: string
  status: OrderStatus
  note?: string
  changed_by?: string
  created?: string
  updated?: string
  expand?: {
    changed_by?: User
  }
}

export type PaymentMethod = 'cash' | 'pix' | 'credit_card' | 'debit_card' | 'transfer'
export type PaymentStatus = 'pending' | 'paid' | 'refunded'

export interface Payment {
  id: string
  service_order: string
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  paid_at?: string
  notes?: string
  created?: string
  updated?: string
}
