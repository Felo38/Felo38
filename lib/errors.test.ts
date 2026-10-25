import { describe, expect, it } from 'vitest'
import { errorKey, safeNext } from './errors'

describe('errorKey', () => {
  it.each([
    ['ERROR: Not enough points', 'points'],
    ['Minimum redemption is 50 points', 'minRedeem'],
    ['A product is not available at this branch', 'unavailable'],
    ['Reservation is too soon', 'time'],
    ['Receipt R-1 was already used at this branch', 'duplicate'],
    ['Cannot move order from pending to picked_up', 'move'],
    ['something unexpected', 'generic'],
  ])('maps %s to %s', (msg, key) => {
    expect(errorKey(msg)).toBe(key)
  })
})

describe('safeNext', () => {
  it('keeps same-site paths', () => {
    expect(safeNext('/ar/cart', '/ar')).toBe('/ar/cart')
  })
  it('rejects external and protocol-relative targets', () => {
    expect(safeNext('https://evil.example', '/ar')).toBe('/ar')
    expect(safeNext('//evil.example', '/ar')).toBe('/ar')
    expect(safeNext(null, '/ar')).toBe('/ar')
  })
})
