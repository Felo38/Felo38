import webpush from 'web-push'
import type { NotificationProvider, PushTarget, SendReport } from './types'

// Browser push via the Web Push protocol. Needs VAPID keys. Without them the provider reports nothing sent.
export function createWebPushProvider(): NotificationProvider {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:admin@ontherun.test'

  return {
    name: 'web-push',
    async send(targets: PushTarget[], notice): Promise<SendReport> {
      if (!publicKey || !privateKey) return { sent: 0, expired: 0, failed: targets.length }
      webpush.setVapidDetails(subject, publicKey, privateKey)

      const payload = JSON.stringify(notice)
      const report: SendReport = { sent: 0, expired: 0, failed: 0 }
      await Promise.all(
        targets.map(async (t) => {
          try {
            await webpush.sendNotification(
              { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
              payload,
            )
            report.sent++
          } catch (err) {
            // 404 and 410 mean the subscription is gone. That's expected, not a failure.
            const status = (err as { statusCode?: number }).statusCode
            if (status === 404 || status === 410) report.expired++
            else report.failed++
          }
        }),
      )
      return report
    },
  }
}
