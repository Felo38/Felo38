// Shared success and error banners for admin pages.
export function flashMessage(
  saved: string | undefined,
  error: string | undefined,
  t: (key: string) => string,
) {
  if (saved) {
    return (
      <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
        {t('saved')}
      </p>
    )
  }
  if (error) {
    const key = error === 'save' || error === 'coords' ? error : 'invalid'
    return (
      <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
        {t(`errors.${key}`)}
      </p>
    )
  }
  return null
}
