import type { Notice } from '@/lib/notifications/types'
import type { OrderStatus } from './status'

// Push text. Mirrors the in-app notification text written by public._apply_order_status.
const TEXT: Partial<Record<OrderStatus, { ar: string; en: string }>> = {
  accepted: { ar: 'تم قبول طلبك', en: 'Your order was accepted' },
  preparing: { ar: 'طلبك بيتحضر', en: 'Your order is being prepared' },
  ready: { ar: 'طلبك جاهز، تعالى استلمه', en: 'Your order is ready for pickup' },
  picked_up: { ar: 'شكرًا! طلبك اتسلم', en: 'Thanks! Your order was picked up' },
  rejected: { ar: 'الفرع مقدرش يقبل طلبك', en: 'The branch could not accept your order' },
  cancelled: { ar: 'طلبك اتلغى', en: 'Your order was cancelled' },
  rescheduled: { ar: 'طلبك اتحجز بموعد جديد', en: 'Your order was rescheduled' },
}

export function orderNotice(status: OrderStatus, orderNo: number | string, locale: string): Notice {
  const text = TEXT[status] ?? { ar: 'تحديث على طلبك', en: 'Update on your order' }
  return {
    title: `On the Run · #${orderNo}`,
    body: locale === 'ar' ? text.ar : text.en,
    url: `/${locale}/orders`,
  }
}
