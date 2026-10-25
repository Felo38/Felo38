import type { NotificationProvider, Notice, PushTarget, SendReport } from './types'

export type DispatchReport = Record<string, SendReport | { error: string }>

// Runs every provider. One failing provider never blocks the others, and nothing here throws.
export async function dispatch(
  providers: NotificationProvider[],
  targets: PushTarget[],
  notice: Notice,
): Promise<DispatchReport> {
  const results = await Promise.allSettled(providers.map((p) => p.send(targets, notice)))
  const report: DispatchReport = {}
  results.forEach((result, i) => {
    const name = providers[i].name
    report[name] = result.status === 'fulfilled' ? result.value : { error: String(result.reason) }
  })
  return report
}
