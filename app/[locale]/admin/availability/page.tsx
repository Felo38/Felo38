import { getTranslations, setRequestLocale } from 'next-intl/server'
import { saveAvailabilityAction } from '@/lib/admin/actions'
import { listBranchProducts, listBranches, listProducts } from '@/lib/catalog/queries'
import { flashMessage } from '../../flash'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ saved?: string; error?: string }>
}

export default async function AvailabilityPage({ params, searchParams }: Props) {
  const { locale } = await params
  const { saved, error } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations('admin.availability')
  const ta = await getTranslations('admin')
  const isAr = locale === 'ar'

  const [branches, products, branchProducts] = await Promise.all([
    listBranches({ includeInactive: true }),
    listProducts({ includeInactive: true }),
    listBranchProducts(),
  ])
  const on = new Set(
    branchProducts.filter((bp) => bp.available).map((bp) => `${bp.branch_id}|${bp.product_id}`),
  )

  return (
    <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      {flashMessage(saved, error, ta)}
      <h1 className="text-xl font-bold text-brand">{t('title')}</h1>
      <p className="text-sm text-slate-600">{t('help')}</p>

      <form action={saveAvailabilityAction} className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <div className="overflow-auto rounded-xl border border-slate-200" style={{ maxHeight: '70dvh' }}>
          <table className="text-sm">
            <thead className="sticky top-0 z-[1] bg-slate-50">
              <tr>
                <th className="sticky start-0 z-[2] bg-slate-50 p-3 text-start">{t('product')}</th>
                {branches.map((b) => (
                  <th key={b.id} className="min-w-24 p-3 text-center font-semibold">
                    {isAr ? b.name_ar : b.name_en}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t border-slate-200">
                  <th className="sticky start-0 bg-white p-3 text-start font-medium">
                    {isAr ? p.name_ar : p.name_en}
                  </th>
                  {branches.map((b) => {
                    const key = `${b.id}|${p.id}`
                    return (
                      <td key={b.id} className="p-3 text-center">
                        <input type="hidden" name="pair" value={key} />
                        <input
                          type="checkbox"
                          name="available"
                          value={key}
                          defaultChecked={on.has(key)}
                          aria-label={`${isAr ? p.name_ar : p.name_en} – ${isAr ? b.name_ar : b.name_en}`}
                          className="size-4"
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="submit" className="rounded-xl bg-brand px-5 py-3 font-semibold text-white">
          {t('save')}
        </button>
      </form>
    </main>
  )
}
