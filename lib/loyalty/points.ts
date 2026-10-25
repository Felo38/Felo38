// Mirrors public.calculate_points and public.counter_redeem in SQL. The database is the source of truth.
// This module is for previews in the UI and for unit tests. supabase/tests/orders_loyalty.test.sql checks both agree.

export type LoyaltyRules = {
  coffee_points_per_egp: number
  food_points_per_egp: number
  redeem_egp_per_point: number
  min_redeem_points: number
}

// Rounds to 6 decimals before flooring, so 0.1 * 30 doesn't floor to 2 because of float error.
const EPS = 1e6

export function calculatePoints(amounts: { coffee: number; food: number }, rules: LoyaltyRules): number {
  const raw = amounts.coffee * rules.coffee_points_per_egp + amounts.food * rules.food_points_per_egp
  return Math.floor(Math.round(raw * EPS) / EPS)
}

// EGP off for a number of points, capped at the order subtotal.
export function redeemDiscount(points: number, subtotal: number, rules: LoyaltyRules): number {
  if (points < rules.min_redeem_points) {
    throw new RangeError(`Minimum redemption is ${rules.min_redeem_points} points`)
  }
  if (rules.redeem_egp_per_point <= 0) return 0
  const raw = Math.min(points * rules.redeem_egp_per_point, subtotal)
  return Math.round(raw * 100) / 100
}

// Points actually charged for a discount. Only what the discount needs is spent.
export function pointsForDiscount(discount: number, rules: LoyaltyRules): number {
  if (rules.redeem_egp_per_point <= 0) return 0
  return Math.ceil(Math.round((discount / rules.redeem_egp_per_point) * EPS) / EPS)
}
