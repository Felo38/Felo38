import { createClient } from '@/lib/supabase/server'
import type { Branch, BranchProduct, Category, Product } from './types'

// Public reads. RLS limits these to active rows for customers.
// Admins also see inactive rows through the same functions.

function check<T>(label: string, res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(`${label}: ${res.error.message}`)
  return (res.data ?? []) as T
}

export async function listBranches(opts: { includeInactive?: boolean } = {}): Promise<Branch[]> {
  const supabase = await createClient()
  let q = supabase.from('branches').select('*').order('name_en')
  if (!opts.includeInactive) q = q.eq('active', true)
  return check('branches', await q)
}

export async function listCategories(opts: { includeInactive?: boolean } = {}): Promise<Category[]> {
  const supabase = await createClient()
  let q = supabase.from('categories').select('*').order('sort_order')
  if (!opts.includeInactive) q = q.eq('active', true)
  return check('categories', await q)
}

export async function listProducts(opts: { includeInactive?: boolean } = {}): Promise<Product[]> {
  const supabase = await createClient()
  let q = supabase.from('products').select('*').order('sort_order')
  if (!opts.includeInactive) q = q.eq('active', true)
  return check('products', await q)
}

export async function listBranchProducts(): Promise<BranchProduct[]> {
  const supabase = await createClient()
  return check('branch_products', await supabase.from('branch_products').select('branch_id, product_id, available'))
}
