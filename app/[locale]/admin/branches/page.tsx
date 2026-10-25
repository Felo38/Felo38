import { getTranslations, setRequestLocale } from 'next-intl/server'
import { saveBranchAction } from '@/lib/admin/actions'
import { listBranches } from '@/lib/catalog/queries'
import { flashMessage } from '../../flash'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ edit?: string; saved?: string; error?: string }>
}

export default async function AdminBranchesPage({ params, searchParams }: Props) {
  const { locale } = await params
  const { edit, saved, error } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations('admin.branches')
  const ta = await getTranslations('admin')
  const isAr = locale === 'ar'

  const branches = await listBranches({ includeInactive: true })
  const editing = branches.find((b) => b.id === edit)

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-6">
      {flashMessage(saved, error, ta)}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-brand">{t('title')}</h1>
          <a href={`/${locale}/admin/branches`} className="text-sm font-semibold text-brand underline">
            {t('add')}
          </a>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-start text-slate-600">
              <tr>
                <th className="p-3 text-start">{t('nameAr')}</th>
                <th className="p-3 text-start">{t('nameEn')}</th>
                <th className="p-3 text-start">{t('lat')}</th>
                <th className="p-3 text-start">{t('lng')}</th>
                <th className="p-3 text-start">{t('status')}</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {branches.map((b) => (
                <tr key={b.id} className="border-t border-slate-200">
                  <td className="p-3">{b.name_ar}</td>
                  <td className="p-3" dir="ltr">{b.name_en}</td>
                  <td className="p-3" dir="ltr">{b.lat ?? '—'}</td>
                  <td className="p-3" dir="ltr">{b.lng ?? '—'}</td>
                  <td className="p-3">
                    {b.active ? '✓' : '—'} {b.accepting_orders ? '' : '(' + (isAr ? 'مقفول للطلبات' : 'orders paused') + ')'}
                  </td>
                  <td className="p-3">
                    <a href={`/${locale}/admin/branches?edit=${b.id}`} className="font-semibold text-brand underline">
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
        <h2 className="text-lg font-bold text-brand">{editing ? t('formTitle') : t('formNew')}</h2>
        <form key={editing?.id ?? 'new'} action={saveBranchAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="locale" value={locale} />
          {editing && <input type="hidden" name="id" value={editing.id} />}

          <Field label={t('nameAr')} name="name_ar" defaultValue={editing?.name_ar} required />
          <Field label={t('nameEn')} name="name_en" defaultValue={editing?.name_en} required dir="ltr" />
          <Field label={t('slug')} name="slug" defaultValue={editing?.slug} required dir="ltr" />
          <Field label={t('phone')} name="phone" defaultValue={editing?.phone ?? ''} dir="ltr" />
          <Field label={t('addressAr')} name="address_ar" defaultValue={editing?.address_ar} required className="sm:col-span-2" />
          <Field label={t('addressEn')} name="address_en" defaultValue={editing?.address_en ?? ''} dir="ltr" className="sm:col-span-2" />
          <Field label={t('mapsUrl')} name="maps_url" type="url" defaultValue={editing?.maps_url ?? ''} dir="ltr" className="sm:col-span-2" />
          <Field label={t('lat')} name="lat" type="number" step="any" min="-90" max="90"
            defaultValue={editing?.lat ?? ''} dir="ltr" />
          <Field label={t('lng')} name="lng" type="number" step="any" min="-180" max="180"
            defaultValue={editing?.lng ?? ''} dir="ltr" />
          <Field label={t('hours')} name="hours_text" defaultValue={editing?.working_hours?.text ?? ''} className="sm:col-span-2" />
          <Field label={t('prep')} name="prep_minutes" type="number" min="0" defaultValue={editing?.prep_minutes ?? 15} dir="ltr" />
          <div className="flex flex-col gap-2 self-end text-sm font-medium">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="accepting_orders" defaultChecked={editing ? editing.accepting_orders : true} className="size-4" />
              {t('accepting')}
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="active" defaultChecked={editing ? editing.active : true} className="size-4" />
              {t('active')}
            </label>
          </div>

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
  className = '',
  ...input
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`flex flex-col gap-1 text-sm font-medium ${className}`}>
      {label}
      <input {...input} className="rounded-lg border border-slate-300 px-3 py-2.5" />
    </label>
  )
}
