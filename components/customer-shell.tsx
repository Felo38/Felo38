'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export type NavLabels = { home: string; menu: string; branches: string; points: string; account: string }

// Icons are inline SVG so no icon package is needed.
const icons = {
  home: 'M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  menu: 'M4 6h16M4 12h16M4 18h10',
  branches: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  points: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z',
  account: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0',
} as const

export function BottomNav({ locale, labels }: { locale: string; labels: NavLabels }) {
  const pathname = usePathname()
  const items: { key: string; href: string; label: string; icon: string; center?: boolean }[] = [
    { key: 'menu', href: `/${locale}/menu`, label: labels.menu, icon: icons.menu },
    { key: 'branches', href: `/${locale}/branches`, label: labels.branches, icon: icons.branches },
    { key: 'home', href: `/${locale}`, label: labels.home, icon: icons.home, center: true },
    { key: 'points', href: `/${locale}/login`, label: labels.points, icon: icons.points },
    { key: 'account', href: `/${locale}/login`, label: labels.account, icon: icons.account },
  ]

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5 items-end">
        {items.map((item) => {
          const active = item.href === `/${locale}` ? pathname === `/${locale}` : pathname.startsWith(item.href)
          if (item.center) {
            return (
              <li key={item.key} className="flex justify-center">
                <Link
                  href={item.href}
                  aria-label={item.label}
                  className="-mt-6 flex size-16 items-center justify-center rounded-full bg-brand text-white shadow-lg ring-4 ring-white"
                >
                  <svg viewBox="0 0 24 24" className="size-7" fill="currentColor" aria-hidden="true">
                    <path d={item.icon} />
                  </svg>
                </Link>
              </li>
            )
          }
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-1 py-3 text-[11px] font-semibold ${
                  active ? 'text-brand' : 'text-slate-500'
                }`}
              >
                <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d={item.icon} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

// Blue hero band at the top of customer pages. Children render inside, under the title.
export function Hero({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="rounded-b-[2rem] bg-brand px-5 pb-8 pt-6 text-white">
      <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
      {children && <div className="mt-4">{children}</div>}
    </header>
  )
}
