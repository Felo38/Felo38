import { getTranslations, setRequestLocale } from 'next-intl/server'
import { staffSignInAction } from '@/lib/auth/actions'

export default async function StaffLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { locale } = await params
  const { error } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations('staff')

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">
      <h1 className="text-xl font-bold text-brand">{t('title')}</h1>

      {error === 'invalid' && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {t('errors.invalid')}
        </p>
      )}

      <form action={staffSignInAction} className="flex flex-col gap-4">
        <input type="hidden" name="locale" value={locale} />
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('email')}
          <input
            name="email"
            type="email"
            autoComplete="username"
            required
            dir="ltr"
            className="rounded-lg border border-slate-300 px-3 py-3"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('password')}
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            dir="ltr"
            className="rounded-lg border border-slate-300 px-3 py-3"
          />
        </label>
        <button type="submit" className="rounded-xl bg-brand px-4 py-3 font-semibold text-white">
          {t('signIn')}
        </button>
      </form>
    </main>
  )
}
