import { getTranslations, setRequestLocale } from 'next-intl/server'
import { saveProductAction } from '@/lib/admin/actions'
import { listCategories, listProducts } from '@/lib/catalog/queries'
import { flashMessage } from '../../flash'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ edit?: string; saved?: string; error?: string }>
}

export default async function AdminProductsPage({ params, searchParams }: Props) {
  const { locale } = await params
  const { edit, saved, error } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations('admin.products')
  const ta = await getTranslations('admin')
  const isAr = locale === 'ar'

  const [categories, products] = await Promise.all([
    listCategories({ includeInactive: true }),
    listProducts({ includeInactive: true }),
  ])
  const editing = products.find((p) => p.id === edit)
  const catName = (id: string) => {
    const c = categories.find((x) => x.id === id)
    return c ? (isAr ? c.name_ar : c.name_en) : '—'
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-6">
      {flashMessage(saved, error, ta)}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-brand">{t('title')}</h1>
          <a href={`/${locale}/admin/products`} className="text-sm font-semibold text-brand underline">
            {t('add')}
          </a>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-start text-slate-600">
              <tr>
                <th className="p-3 text-start">{t('nameAr')}</th>
                <th className="p-3 text-start">{t('nameEn')}</th>
                <th className="p-3 text-start">{t('category')}</th>
                <th className="p-3 text-start">{t('price')}</th>
                <th className="p-3 text-start">{t('status')}</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t border-slate-200">
                  <td className="p-3">{p.name_ar}</td>
                  <td className="p-3" dir="ltr">{p.name_en}</td>
                  <td className="p-3">{catName(p.category_id)}</td>
                  <td className="p-3">{p.price_egp}</td>
                  <td className="p-3">{p.active ? '✓' : '—'}</td>
                  <td className="p-3">
                    <a href={`/${locale}/admin/products?edit=${p.id}`} className="font-semibold text-brand underline">
                      {t('edit')}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-brand">
          {editing ? t('formTitle') : t('formNew')}
        </h2>
        <form key={editing?.id ?? 'new'} action={saveProductAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="locale" value={locale} />
          {editing && <input type="hidden" name="id" value={editing.id} />}

          <Field label={t('nameAr')} name="name_ar" defaultValue={editing?.name_ar} required />
          <Field label={t('nameEn')} name="name_en" defaultValue={editing?.name_en} required dir="ltr" />
          <Field label={t('slug')} name="slug" defaultValue={editing?.slug} required dir="ltr" />
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('category')}
            <select
              name="category_id"
              required
              defaultValue={editing?.category_id ?? categories[0]?.id}
              className="rounded-lg border border-slate-300 px-3 py-2.5"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {isAr ? c.name_ar : c.name_en}
                </option>
              ))}
            </select>
          </label>
          <Field label={t('price')} name="price_egp" type="number" step="0.01" min="0"
            defaultValue={editing?.price_egp} required dir="ltr" />
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('type')}
            <select name="type" defaultValue={editing?.type ?? 'other'} className="rounded-lg border border-slate-300 px-3 py-2.5">
              {(['coffee', 'food', 'other'] as const).map((v) => (
                <option key={v} value={v}>{t(`types.${v}`)}</option>
              ))}
            </select>
          </label>
          <Field label={t('descAr')} name="description_ar" defaultValue={editing?.description_ar ?? ''} />
          <Field label={t('descEn')} name="description_en" defaultValue={editing?.description_en ?? ''} dir="ltr" />
          <Field label={t('sortOrder')} name="sort_order" type="number" defaultValue={editing?.sort_order ?? 0} dir="ltr" />
          <label className="flex items-center gap-2 self-end text-sm font-medium">
            <input type="checkbox" name="active" defaultChecked={editing ? editing.active : true} className="size-4" />
            {t('active')}
          </label>

          <div className="sm:col-span-2">
            <button type="submit" className="rounded-xl bg-brand px-5 py-3 font-semibold text-white">
              {t('save')}
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}

function Field({
  label,
  ...input
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <input {...input} className="rounded-lg border border-slate-300 px-3 py-2.5" />
    </label>
  )
}
