// Egyptian mobile numbers: 010, 011, 012, 015 followed by 8 digits.
const MOBILE_LOCAL = /^0?(1[0125]\d{8})$/
const MOBILE_INTL = /^(?:\+|00)?20(1[0125]\d{8})$/

// Accepts Arabic-Indic digits and common separators. Returns E.164 (+201xxxxxxxxx) or null.
export function normalizeEgyptPhone(input: string): string | null {
  const ascii = input.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
  const compact = ascii.replace(/[\s\-().]/g, '')

  const intl = MOBILE_INTL.exec(compact)
  if (intl) return `+20${intl[1]}`

  const local = MOBILE_LOCAL.exec(compact)
  if (local) return `+20${local[1]}`

  return null
}
