export type Branch = {
  id: string
  slug: string
  name_ar: string
  name_en: string
  address_ar: string
  address_en: string | null
  maps_url: string | null
  phone: string | null
  lat: number | null
  lng: number | null
  working_hours: { text?: string }
  accepting_orders: boolean
  prep_minutes: number
  active: boolean
}

export type Category = {
  id: string
  slug: string
  name_ar: string
  name_en: string
  sort_order: number
  active: boolean
}

export type ProductType = 'coffee' | 'food' | 'other'

export type Product = {
  id: string
  category_id: string
  slug: string
  name_ar: string
  name_en: string
  description_ar: string | null
  description_en: string | null
  price_egp: number
  type: ProductType
  sort_order: number
  active: boolean
}

export type BranchProduct = {
  branch_id: string
  product_id: string
  available: boolean
}
