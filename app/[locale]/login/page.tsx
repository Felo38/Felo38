import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requestOtpAction, verifyOtpAction } from '@/lib/auth/actions'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ phone?: string; error?: string }>
}

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params
  const { phone, error } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations('login')

  const errorKey = error === 'phone' || error === 'send' || error === 'code' ? error : null

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">
      <h1 className="text-xl font-bold text-brand">{t('title')}</h1>

      {errorKey && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {t(`errors.${errorKey}`)}
        </p>
      )}

      {phone ? (
        <form action={verifyOtpAction} className="flex flex-col gap-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="phone" value={phone} />
          <p className="text-sm text-slate-600">{t('codeSentTo', { phone })}</p>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('codeLabel')}
            <input
              name="token"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              placeholder={t('codeHint')}
              required
              className="rounded-lg border border-slate-300 px-3 py-3 text-center text-lg tracking-widest"
            />
          </label>
          <button type="submit" className="rounded-xl bg-brand px-4 py-3 font-semibold text-white">
            {t('verify')}
          </button>
          <a href={`/${locale}/login`} className="text-center text-sm text-brand underline">
            {t('changePhone')}
          </a>
        </form>
      ) : (
        <form action={requestOtpAction} className="flex flex-col gap-4">
          <input type="hidden" name="locale" value={locale} />
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('phoneLabel')}
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder={t('phoneHint')}
              required
              dir="ltr"
              className="rounded-lg border border-slate-300 px-3 py-3 text-lg"
            />
          </label>
          <button type="submit" className="rounded-xl bg-brand px-4 py-3 font-semibold text-white">
            {t('sendCode')}
          </button>
        </form>
      )}
    </main>
  )
}
