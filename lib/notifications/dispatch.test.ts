import { describe, expect, it } from 'vitest'
import { dispatch } from './dispatch'
import type { NotificationProvider, Notice, PushTarget } from './types'

const notice: Notice = { title: 't', body: 'b', url: '/ar/orders/1' }
const targets: PushTarget[] = [{ endpoint: 'e', p256dh: 'p', auth: 'a' }]

function provider(name: string, impl: NotificationProvider['send']): NotificationProvider {
  return { name, send: impl }
}

describe('dispatch', () => {
  it('sends to every provider and reports each result', async () => {
    const seen: string[] = []
    const report = await dispatch(
      [
        provider('push', async (t) => (seen.push(`push:${t.length}`), { sent: 1, expired: 0, failed: 0 })),
        provider('sms', async () => (seen.push('sms'), { sent: 1, expired: 0, failed: 0 })),
      ],
      targets,
      notice,
    )
    expect(seen).toEqual(['push:1', 'sms'])
    expect(report).toEqual({
      push: { sent: 1, expired: 0, failed: 0 },
      sms: { sent: 1, expired: 0, failed: 0 },
    })
  })

  it('keeps going when one provider fails', async () => {
    const report = await dispatch(
      [
        provider('broken', async () => {
          throw new Error('network down')
        }),
        provider('ok', async () => ({ sent: 1, expired: 0, failed: 0 })),
      ],
      targets,
      notice,
    )
    expect(report.broken).toEqual({ error: 'Error: network down' })
    expect(report.ok).toEqual({ sent: 1, expired: 0, failed: 0 })
  })

  it('does nothing harmful with no targets', async () => {
    const report = await dispatch([provider('push', async () => ({ sent: 0, expired: 0, failed: 0 }))], [], notice)
    expect(report.push).toEqual({ sent: 0, expired: 0, failed: 0 })
  })
})
