// Turns a Postgres error message into a stable key. The UI translates the key, so messages stay in one place.
const RULES: [RegExp, string][] = [
  [/Not enough points/i, 'points'],
  [/Minimum redemption/i, 'minRedeem'],
  [/not accepting orders|not available at this branch|Branch not found/i, 'unavailable'],
  [/too soon|future|today|Choose a time|Ready time/i, 'time'],
  [/Sign in required/i, 'signin'],
  [/already used/i, 'duplicate'],
  [/Not allowed|Only customers/i, 'forbidden'],
  [/Cannot move order|no longer be cancelled|Order not found/i, 'move'],
  [/reason is required/i, 'reason'],
  [/Invalid quantity|Cart is empty|Too many items/i, 'cart'],
  [/Invalid amounts|required|Enter a positive/i, 'input'],
]

export function errorKey(message: string | undefined | null): string {
  if (!message) return 'generic'
  return RULES.find(([re]) => re.test(message))?.[1] ?? 'generic'
}

// Safe post-login path. Only same-site relative paths.
export function safeNext(value: FormDataEntryValue | string | null | undefined, fallback: string): string {
  const s = typeof value === 'string' ? value : ''
  return s.startsWith('/') && !s.startsWith('//') ? s : fallback
}
