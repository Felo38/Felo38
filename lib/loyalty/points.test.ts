import { describe, expect, it } from 'vitest'
import { calculatePoints, pointsForDiscount, redeemDiscount, type LoyaltyRules } from './points'

const rules: LoyaltyRules = {
  coffee_points_per_egp: 0.1,
  food_points_per_egp: 0.05,
  redeem_egp_per_point: 0.1,
  min_redeem_points: 50,
}

describe('calculatePoints', () => {
  it.each([
    [{ coffee: 55, food: 85 }, 9], // 5.5 + 4.25 floors to 9
    [{ coffee: 9.99, food: 0 }, 0], // under 10 EGP earns nothing
    [{ coffee: 10, food: 0 }, 1],
    [{ coffee: 1000, food: 1000 }, 150], // 100 + 50
    [{ coffee: 0, food: 0 }, 0],
    [{ coffee: 30, food: 0 }, 3], // float check: 30 * 0.1 must not floor to 2
  ])('%j gives %i points', (amounts, expected) => {
    expect(calculatePoints(amounts, rules)).toBe(expected)
  })

  it('never awards points for other products', () => {
    expect(calculatePoints({ coffee: 0, food: 0 }, rules)).toBe(0)
  })
})

describe('redeemDiscount', () => {
  it('turns points into EGP at the configured rate', () => {
    expect(redeemDiscount(50, 110, rules)).toBe(5)
    expect(redeemDiscount(60, 110, rules)).toBe(6)
  })

  it('never discounts more than the subtotal', () => {
    expect(redeemDiscount(500, 3, rules)).toBe(3)
  })

  it('rejects redemptions below the minimum', () => {
    expect(() => redeemDiscount(49, 110, rules)).toThrow(RangeError)
  })

  it('gives no discount when the value per point is zero', () => {
    expect(redeemDiscount(60, 110, { ...rules, redeem_egp_per_point: 0 })).toBe(0)
  })
})

describe('pointsForDiscount', () => {
  it('charges only the points the discount needs', () => {
    expect(pointsForDiscount(5, rules)).toBe(50)
    expect(pointsForDiscount(3, rules)).toBe(30) // capped subtotal of 3 EGP costs 30 points
  })

  it('rounds up so a partial point is never given away', () => {
    expect(pointsForDiscount(0.15, rules)).toBe(2)
  })

  it('charges nothing when points have no value', () => {
    expect(pointsForDiscount(5, { ...rules, redeem_egp_per_point: 0 })).toBe(0)
  })
})
