import { getTranslations, setRequestLocale } from 'next-intl/server'
import { googleSignInAction, requestOtpAction, verifyOtpAction } from '@/lib/auth/actions'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ phone?: string; error?: string; next?: string }>
}

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params
  const { phone, error, next } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations('login')

  const errorKey = error === 'phone' || error === 'send' || error === 'code' || error === 'google' ? error : null

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">
      <h1 className="text-xl font-bold text-brand">{t('title')}</h1>

      {errorKey && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {t(`errors.${errorKey}`)}
        </p>
      )}

      {!phone && (
        <>
          <form action={googleSignInAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="next" value={next ?? ''} />
            <button type="submit" className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white py-3 font-bold text-slate-800">
              <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.5 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1C3.4 21.3 7.4 24 12 24z"/><path fill="#FBBC05" d="M5.4 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.6.4-2.4V6.5H1.4C.5 8.2 0 10 0 12s.5 3.8 1.4 5.5l4-3.1z"/><path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.4 0 3.4 2.7 1.4 6.5l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"/></svg>
              {t('google')}
            </button>
          </form>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />{t('or')}<span className="h-px flex-1 bg-slate-200" />
          </div>
        </>
      )}

      {phone ? (
        <form action={verifyOtpAction} className="flex flex-col gap-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="phone" value={phone} />
          <input type="hidden" name="next" value={next ?? ''} />
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
          <input type="hidden" name="next" value={next ?? ''} />
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
