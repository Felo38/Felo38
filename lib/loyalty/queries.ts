import { createClient } from '@/lib/supabase/server'
import type { LoyaltyRules } from './points'

export type LedgerRow = { id: number; type: string; delta: number; created_at: string; branch_id: string | null }

// Public read. Rules are shown to everyone (the loyalty page explains the math).
export async function getCurrentRules(): Promise<LoyaltyRules & { large_order_total_egp: number | null }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('loyalty_rule_versions')
    .select('coffee_points_per_egp, food_points_per_egp, redeem_egp_per_point, min_redeem_points, large_order_total_egp')
    .lte('effective_from', new Date().toISOString())
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`rules: ${error.message}`)
  if (!data) throw new Error('rules: no loyalty rules configured')
  return {
    coffee_points_per_egp: Number(data.coffee_points_per_egp),
    food_points_per_egp: Number(data.food_points_per_egp),
    redeem_egp_per_point: Number(data.redeem_egp_per_point),
    min_redeem_points: data.min_redeem_points,
    large_order_total_egp: data.large_order_total_egp === null ? null : Number(data.large_order_total_egp),
  }
}

// RLS limits this to the signed-in customer's own rows. Guests get 0.
export async function getBalance(): Promise<number> {
  const supabase = await createClient()
  const { data } = await supabase.from('points_ledger').select('delta')
  return (data ?? []).reduce((sum, row) => sum + Number(row.delta), 0)
}

export async function getLedger(limit = 30): Promise<LedgerRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('points_ledger')
    .select('id, type, delta, created_at, branch_id')
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as LedgerRow[]
}
