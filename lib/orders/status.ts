// Status keys shared by the database enum, the UI, and push notices.
export const ORDER_STATUSES = [
  'pending', 'accepted', 'preparing', 'ready', 'picked_up', 'rejected', 'cancelled', 'rescheduled',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

// Statuses that still need the branch's attention. The dashboard lists these.
export const ACTIVE_STATUSES: OrderStatus[] = ['pending', 'rescheduled', 'accepted', 'preparing', 'ready']

// Moves the branch can make from each status. Mirrors public.order_move_allowed (staff part).
export const STAFF_MOVES: Record<OrderStatus, OrderStatus[]> = {
  pending: ['accepted', 'rejected', 'rescheduled'],
  rescheduled: ['accepted', 'rejected', 'rescheduled'],
  accepted: ['preparing', 'rescheduled'],
  preparing: ['ready'],
  ready: ['picked_up'],
  picked_up: [],
  rejected: [],
  cancelled: [],
}

export const CUSTOMER_CANCELLABLE: OrderStatus[] = ['pending', 'accepted', 'rescheduled']
