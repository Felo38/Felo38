import { getTranslations } from 'next-intl/server'
import type { NavLabels } from '@/components/customer-shell'

export async function getNavLabels(): Promise<NavLabels> {
  const t = await getTranslations('nav')
  return {
    home: t('home'),
    menu: t('menu'),
    branches: t('branches'),
    cart: t('cart'),
    orders: t('orders'),
  }
}
