// Client components can't receive a translator function, so we pass the plain strings they need.
export function pick(t: (key: string) => string, keys: readonly string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, t(k)]))
}
