import { useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { branches, type Branch } from './branches'
import { products, type Category } from './data'

const categoryLabels: Record<Category, string> = {
  coffee: 'قهوة',
  food: 'أكل',
  snacks: 'سناكس',
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (d: number) => (d * Math.PI) / 180
  const r = 6371
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * r * Math.asin(Math.sqrt(h))
}

function MenuPage() {
  const [active, setActive] = useState<Category>('coffee')
  const items = products.filter((p) => p.category === active)

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold text-otr-blue">المنيو</h1>
      <div className="flex gap-2">
        {(Object.keys(categoryLabels) as Category[]).map((c) => (
          <button
            key={c}
            onClick={() => setActive(c)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              active === c ? 'bg-otr-blue text-white' : 'bg-otr-yellow/40 text-otr-blue'
            }`}
          >
            {categoryLabels[c]}
          </button>
        ))}
      </div>
      <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200">
        {items.map((p) => (
          <li key={p.id} className="flex items-center justify-between p-4">
            <div>
              <p className="font-semibold">{p.name}</p>
              {p.bonusPoints ? (
                <span className="mt-1 inline-block rounded-full bg-otr-red px-2 py-0.5 text-xs font-bold text-white">
                  +{p.bonusPoints} نقطة
                </span>
              ) : null}
            </div>
            <p className="font-bold text-otr-blue">{p.price} ج.م</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

function BranchesPage() {
  const [nearest, setNearest] = useState<Branch | null>(null)
  const [status, setStatus] = useState<string>('')

  const findNearest = () => {
    if (!navigator.geolocation) {
      setStatus('المتصفح مش بيدعم تحديد الموقع')
      return
    }
    setStatus('جاري تحديد موقعك...')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        // Only branches with known coordinates can be ranked by distance.
        const located = branches.filter((b) => b.lat !== null && b.lng !== null)
        if (located.length === 0) {
          setStatus('إحداثيات الفروع لسه مش متضافة')
          return
        }
        const best = located.reduce((a, b) =>
          distanceKm(latitude, longitude, a.lat!, a.lng!) <=
          distanceKm(latitude, longitude, b.lat!, b.lng!)
            ? a
            : b,
        )
        setNearest(best)
        setStatus('')
      },
      () => setStatus('لازم تسمح بالوصول للموقع عشان نحدد أقرب فرع'),
    )
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold text-otr-blue">الفروع</h1>
      <button
        onClick={findNearest}
        className="w-full rounded-2xl bg-otr-red px-4 py-3 font-bold text-white"
      >
        أقرب فرع ليا
      </button>
      {status && <p className="text-sm text-slate-600">{status}</p>}
      {nearest && (
        <div className="rounded-2xl border-2 border-otr-blue bg-otr-yellow/30 p-4">
          <p className="text-sm font-semibold text-otr-red">أقرب فرع ليك</p>
          <p className="font-bold">{nearest.name}</p>
          <p className="text-sm text-slate-600">{nearest.address}</p>
        </div>
      )}
      <ul className="space-y-3">
        {branches.map((b) => (
          <li key={b.id} className="rounded-2xl border border-slate-200 p-4">
            <p className="font-semibold">{b.name}</p>
            <p className="text-sm text-slate-600">{b.address}</p>
            <a
              href={b.mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-sm font-semibold text-otr-blue underline"
            >
              افتح في الخريطة
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ReceiptPage() {
  const [preview, setPreview] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>('')

  const onPick = (file: File | undefined) => {
    if (!file) return
    setFileName(file.name)
    setPreview(URL.createObjectURL(file))
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold text-otr-blue">صوّر الريسيت</h1>
      <p className="text-sm text-slate-600">
        صوّر الفاتورة اللي من الفرع عشان تضيف نقاطك. النقاط بتتحسب بعد مراجعة الريسيت.
      </p>
      <label className="flex h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-otr-blue bg-otr-yellow/20 text-otr-blue">
        <span className="font-bold">اضغط عشان تصوّر أو ترفع صورة</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0])}
        />
      </label>
      {preview && (
        <div className="space-y-2">
          <img src={preview} alt={fileName} className="w-full rounded-2xl border border-slate-200" />
          <button className="w-full rounded-2xl bg-otr-blue px-4 py-3 font-bold text-white">
            إرسال الريسيت
          </button>
        </div>
      )}
    </section>
  )
}

function PointsPage() {
  const bonus = products.filter((p) => p.bonusPoints)
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold text-otr-blue">النقاط</h1>
      <p className="text-sm text-slate-600">
        اشتري المنتجات دي واكسب نقاط بونص:
      </p>
      <ul className="space-y-2">
        {bonus.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between rounded-2xl bg-otr-yellow/30 p-4"
          >
            <span className="font-semibold">{p.name}</span>
            <span className="font-bold text-otr-red">+{p.bonusPoints}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

const tabs = [
  { to: '/', label: 'المنيو', end: true },
  { to: '/branches', label: 'الفروع' },
  { to: '/receipt', label: 'الريسيت' },
  { to: '/points', label: 'النقاط' },
]

export default function App() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col">
      <header className="flex items-center justify-center bg-otr-yellow px-4 py-3">
        <img src="/on-the-run-logo.png" alt="On the Run" className="h-14 w-14" />
      </header>

      <main className="flex-1 p-4 pb-24">
        <Routes>
          <Route path="/" element={<MenuPage />} />
          <Route path="/branches" element={<BranchesPage />} />
          <Route path="/receipt" element={<ReceiptPage />} />
          <Route path="/points" element={<PointsPage />} />
        </Routes>
      </main>

      <nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md border-t border-slate-200 bg-white">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `flex-1 py-3 text-center text-xs font-semibold ${
                isActive ? 'text-otr-red' : 'text-slate-500'
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
