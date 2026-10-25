// Provider interface. In-app notifications are rows the database writes (public.notifications).
// Push, SMS and WhatsApp are providers that send the same message, so adding one doesn't touch the flows.

export type PushTarget = { endpoint: string; p256dh: string; auth: string }

export type Notice = { title: string; body: string; url: string }

export type SendReport = { sent: number; expired: number; failed: number }

export interface NotificationProvider {
  readonly name: string
  send(targets: PushTarget[], notice: Notice): Promise<SendReport>
}
