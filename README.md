# On the Run

تطبيق On the Run: منيو العميل وطلباته ونقاطه، ولوحة الإدارة، والداشبورد الخاص بالفروع. الكود كله في مشروع واحد بيستخدم Next.js وSupabase.

> **الحالة الحالية: المرحلة 1 (الإعداد، الـ Auth، الأدوار، قاعدة البيانات).**
> الموجود دلوقتي: دخول العميل بالـ OTP، ودخول الفروع والإدارة بالإيميل، وحماية المسارات حسب الدور. باقي المنيو والطلب والداشبورد هيتبنوا في المراحل الجاية.

---

## المتطلبات

- Node.js 20.9 أو أحدث
- حساب Supabase (مشروع للـ dev ومشروع للـ prod)
- Supabase CLI (اختياري، لو هتشغّل Supabase محليًا بـ Docker)

## التشغيل محليًا

```bash
npm install
cp .env.example .env.local   # عبّي القيم من Supabase
npm run dev                  # http://localhost:3000 (بيتحول لـ /ar)
```

## متغيرات البيئة

| المتغير | المكان | الوصف |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | عام | رابط المشروع: Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | عام | المفتاح العام (anon). آمن للمتصفح لأن RLS بيحمي البيانات |
| `SUPABASE_SERVICE_ROLE_KEY` | **سيرفر بس** | صلاحيات كاملة. ماينفعش يتحط بـ `NEXT_PUBLIC_` أبدًا. هيتستخدم في المراحل الجاية |

## قاعدة البيانات

الـ migrations في `supabase/migrations/` بتتطبق بالترتيب:

1. `20261025100000_core_schema.sql`: الجداول والـ enums.
2. `20261025100100_rls_and_guards.sql`: دوال الصلاحيات، الـ triggers، سياسات RLS، والـ grants.

### على Supabase محلي (Docker)

```bash
supabase init          # مرة واحدة لو مفيش supabase/config.toml
supabase start
supabase db reset      # بيطبّق الـ migrations وبعدين supabase/seed.sql
```

### على مشروع Supabase حقيقي

```bash
supabase link --project-ref YOUR-PROJECT-REF
supabase db push
```

الـ seed الأساسي (3 فروع، منتجات، مستخدمين تجريبيين) للـ dev بس. للـ prod شغّل `supabase/seed/branches_all.sql` مرة واحدة من SQL Editor عشان تضيف الـ 35 فرع الحقيقيين.

### مستخدمين تجريبيين (dev)

| الدور | الدخول | ملاحظة |
|---|---|---|
| admin | `admin@ontherun.test` | لازم تحدد كلمة سر من Dashboard الأول |
| branch_staff (كورنيش) | `staff.cornich@ontherun.test` | نفس الكلام |
| customer | `+201000000001` | OTP، ولازم الـ Phone provider يكون مفعّل |

## الاختبارات

```bash
npm test              # اختبارات الوحدة (تحويل رقم الموبايل وغيره)
npm run typecheck     # فحص الـ TypeScript
npm run lint          # ESLint
npm run build         # build للإنتاج

# اختبارات قاعدة البيانات (RLS والـ ledger) على Postgres عادي:
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:54322/postgres bash scripts/db-test.sh
```

`scripts/db-test.sh` بيعيد بناء الـ schema كامل على Postgres محلي، وبيحمّل `supabase/tests/auth_shim.sql` عشان يحاكي `auth.uid()`. **متشغلهوش على مشروع Supabase حقيقي**، لأن الـ shim بيستبدل `auth.uid()` الحقيقية.

## نقاط مهمة للأمان

- **الأدوار:** `customer` و`branch_staff` و`admin`. الدور متخزن في جدول `profiles`، ومفيش طريقة يتغير من الـ client. أي تسجيل جديد بيتعمل كـ `customer` حتى لو بعت `role` في الـ metadata.
- **RLS على كل جدول.** الحماية الحقيقية في قاعدة البيانات. الـ proxy والـ layouts بيحموا الصفحات بس.
- **دفتر النقاط append-only.** مفيش UPDATE ولا DELETE، حتى من الـ postgres (فيه trigger بيمنع ده).
- **رقم الإيصال فريد لكل فرع** عشان النقاط ماتتحسبش مرتين.

## النشر على Vercel

1. ارفع الريبو على GitHub، وضيفه في Vercel كـ New Project.
2. Framework: Next.js (بيتكشف لوحده). Node: 20.9 أو أحدث.
3. ضيف متغيرات البيئة `NEXT_PUBLIC_SUPABASE_URL` و`NEXT_PUBLIC_SUPABASE_ANON_KEY`، وكمان `SUPABASE_SERVICE_ROLE_KEY` لو اتطلبت.
4. في Supabase:
   - **Authentication → URL Configuration:** حط `Site URL` = رابط Vercel، وزوّده في Redirect URLs.
   - **Authentication → Providers → Phone:** فعّله، ووصّل مزود SMS (Twilio أو Vonage). اتأكد إن الـ sender مسموح في مصر.
   - طبّق الـ migrations (`supabase db push`)، وشغّل `branches_all.sql`.
5. ادخل على `/ar/staff/login` بحساب الأدمن، وتأكد إن لوحة الإدارة بتفتح.

## هيكل المشروع

```
app/[locale]/         صفحات العميل والأدمن والفروع (ar / en)
i18n/                 إعدادات اللغات
messages/             النصوص (ar.json, en.json)
proxy.ts              i18n + تجديد الجلسة + حماية مسارات الأدمن والفروع
lib/auth/             رقم الموبايل، الجلسة، الـ server actions
lib/supabase/         عميل Supabase للسيرفر
lib/env.ts            التحقق من متغيرات البيئة
supabase/migrations/  الـ schema والـ RLS
supabase/seed.sql     بيانات تجريبية للـ dev
supabase/seed/        بيانات الإنتاج (الـ 35 فرع)
supabase/data/        بيانات الفروع كـ JSON
supabase/tests/       اختبارات RLS والـ ledger
```

## الطلب والنقاط والداشبورد (المراحل 3 إلى 5)

- **السلة** بتتحفظ على الجهاز، والسيرفر بيعيد حساب كل حاجة (الأسعار والتوفر والنقاط) عند تأكيد الطلب.
- **الدفع في الفرع** عند الاستلام. الـ Paymob أو Fawry هيتضافوا لاحقًا من غير ما يتغير الـ flow.
- **حالات الطلب:** `pending → accepted → preparing → ready → picked_up`، ومعاها `rejected` و`cancelled` و`rescheduled`. كل حركة بتتسجل في `order_status_events`.
- **النقاط** بتتكسب لما الطلب يتسلم (`picked_up`) فقط، وبتتحسب على المبلغ قبل الخصم. الاسترداد بيتحجز وقت الطلب، ويرجع لو الطلب اترفض أو اتلغى.
- **كاشير النقاط:** الفرع يبحث عن العميل بالـ QR أو الموبايل، ويسجل إيصال (رقمه فريد لكل فرع)، أو يستبدل نقاط.
- **الإشعارات:** كل تغيير في الطلب بيكتب إشعار داخلي، وبيتبعت كمان Push لو المفاتيح مضبوطة.

### متغيرات البيئة الإضافية (Push)

| المتغير | المكان | الوصف |
|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | عام | المفتاح العام لـ Web Push |
| `VAPID_PRIVATE_KEY` | سيرفر بس | المفتاح الخاص (ماينفعش يتحط في `NEXT_PUBLIC_`) |
| `VAPID_SUBJECT` | سيرفر | مثال: `mailto:admin@yourdomain` |

توليد المفاتيح: `npx web-push generate-vapid-keys`. من غير المفاتيح، الإشعار الداخلي بيشتغل عادي، والـ Push مش بيتبعت.

### ملحوظات مفتوحة

- **انتهاء صلاحية النقاط** (`expiry_days`) متخزنة في الإعدادات لكن مش بتتطبق لسه.
- **ساعات العمل** ما بتمنعش الطلب في الـ database لسه (الإدارة بتقفل الطلبات بـ `accepting_orders`).
- **الكوبونات** مش متعملة.

## تشغيل كامل على جهازك (بدون Supabase حقيقي)

للتجربة بس. الـ backend المحلي (`dev/local-backend`) بيحاكي Supabase API على Postgres حقيقي، وفيه الـ migrations والـ RLS والـ functions كاملة. **مش للإنتاج.**

1. Postgres 16 (أسهل طريقة بـ Docker):
   ```bash
   docker run -d --name otr-pg -p 54322:5432 -e POSTGRES_PASSWORD=postgres postgres:16
   ```
2. `npm install`
3. بناء الداتا (migrations + بيانات تجريبية): `npm run dev:db`
4. في terminal: `npm run dev:backend` (بيشتغل على `localhost:54400`)
5. في `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54400
   NEXT_PUBLIC_SUPABASE_ANON_KEY=local-anon
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```
   وبعدين `npm run dev` وافتح `http://localhost:3000/ar`.

**الدخول التجريبي:**
- أدمن: `/ar/staff/login` بالإيميل `admin@ontherun.test` وكلمة السر `demo1234`
- فرع (كورنيش): نفس الصفحة بالإيميل `staff.cornich@ontherun.test`
- عميل: `/ar/login` برقم `01000000001` وكود `123456`

**ملاحظات:**
- تسجيل الدخول بجوجل والـ SMS الحقيقي محتاجين Supabase حقيقي.
- الـ Realtime مش موجود في الـ backend المحلي، فداشبورد الفرع بيتحدث كل 10 ثواني.
- بعد ما تعمل `npm run dev:db`، كل البيانات بتترجع للحالة التجريبية.
