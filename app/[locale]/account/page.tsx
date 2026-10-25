import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { BottomNav, Hero } from '@/components/customer-shell'
import { getCurrentProfile } from '@/lib/auth/session'
import { linkGoogleAction, requestPhoneAction, verifyPhoneAction } from '@/lib/auth/actions'
import { createClient } from '@/lib/supabase/server'
import { getNavLabels } from '@/lib/customer/nav'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ phone?: string; verified?: string; error?: string }>
}

export default async function AccountPage({ params, searchParams }: Props) {
  const { locale } = await params
  const { phone: pendingPhone, verified, error } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations('account')

  const profile = await getCurrentProfile()
  if (!profile) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/account`)}`)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const hasGoogle = Boolean(user?.identities?.some((i) => i.provider === 'google'))
  const hasPhone = Boolean(profile.phone)

  return (
    <>
      <Hero title={t('title')} />
      <main className="mx-auto max-w-md space-y-5 px-5 pb-28 pt-5">
        {verified && <p role="status" className="rounded-2xl bg-emerald-50 p-4 font-semibold text-emerald-700">{t('phoneSaved')}</p>}
        {error && <p role="alert" className="rounded-2xl bg-red-50 p-4 font-semibold text-red-700">{t(`errors.${error}`)}</p>}

        <section className="space-y-3 rounded-3xl bg-white p-5 shadow-sm">
          <p className="font-extrabold text-brand">{profile.full_name ?? user?.email ?? t('guest')}</p>
          <p className="text-sm text-slate-600">{t('phoneLabel')}: <span dir="ltr">{profile.phone ?? t('none')}</span></p>
          <p className="text-sm text-slate-600">{t('googleLabel')}: {hasGoogle ? t('connected') : t('none')}</p>
        </section>

        {!hasPhone && (
          <section className="space-y-3 rounded-3xl bg-white p-5 shadow-sm">
            <p className="font-bold">{t('addPhone')}</p>
            <p className="text-sm text-slate-500">{t('addPhoneHint')}</p>
            {!pendingPhone ? (
              <form action={requestPhoneAction} className="space-y-3">
                <input type="hidden" name="locale" value={locale} />
                <input name="phone" type="tel" required dir="ltr" placeholder={t('phonePlaceholder')} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
                <button type="submit" className="w-full rounded-xl bg-brand py-2.5 font-bold text-white">{t('sendCode')}</button>
              </form>
            ) : (
              <form action={verifyPhoneAction} className="space-y-3">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="phone" value={pendingPhone} />
                <p className="text-sm text-slate-600">{t('codeSentTo', { phone: pendingPhone })}</p>
                <input name="token" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" required dir="ltr" placeholder="123456" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-center tracking-widest" />
                <button type="submit" className="w-full rounded-xl bg-brand py-2.5 font-bold text-white">{t('verify')}</button>
              </form>
            )}
          </section>
        )}

        {!hasGoogle && (
          <section className="space-y-3 rounded-3xl bg-white p-5 shadow-sm">
            <p className="font-bold">{t('linkGoogle')}</p>
            <p className="text-sm text-slate-500">{t('linkGoogleHint')}</p>
            <form action={linkGoogleAction}>
              <input type="hidden" name="locale" value={locale} />
              <button type="submit" className="w-full rounded-xl border border-slate-300 py-2.5 font-bold text-brand">{t('linkGoogleAction')}</button>
            </form>
          </section>
        )}

        <Link href={`/${locale}/orders`} className="block text-center text-sm font-semibold text-brand underline">{t('back')}</Link>
      </main>
      <BottomNav locale={locale} labels={await getNavLabels()} />
    </>
  )
}
