// LOCAL DEVELOPMENT ONLY. A small stand-in for the Supabase REST and Auth APIs, backed by a real Postgres
// (migrations, RLS, functions). It does not verify JWT signatures and accepts the OTP code 123456.
// It refuses to run with NODE_ENV=production. Never point production traffic at it.
import http from 'node:http'
import pg from 'pg'

if (process.env.NODE_ENV === 'production') {
  console.error('local backend must not run in production')
  process.exit(1)
}

const PORT = Number(process.env.PORT ?? 54400)
const DB_URL = process.env.DEV_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:54322/postgres'
const OTP_CODE = '123456'
const pool = new pg.Pool({ connectionString: DB_URL, max: 5 })

class HttpError extends Error {
  constructor(status, body) {
    super(body.message ?? 'error')
    this.status = status
    this.body = body
  }
}

const ident = (s) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new HttpError(400, { message: `bad identifier ${s}` })
  return `"${s}"`
}
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')

function publicUser(u) {
  return { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email ?? undefined, phone: u.phone ?? undefined, app_metadata: {}, user_metadata: {}, created_at: u.created_at }
}

function session(u) {
  const now = Math.floor(Date.now() / 1000)
  const access = `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({ sub: u.id, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600 })}.dev`
  return { access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: `dev-refresh.${u.id}`, user: publicUser(u) }
}

function bearerUserId(req) {
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub ?? null
  } catch {
    return null // anon key or no session
  }
}

const digits = (p) => String(p).replace(/\D/g, '')

async function findOrCreatePhoneUser(phone) {
  const d = digits(phone)
  const { rows } = await pool.query('select * from auth.users where phone = $1', [d])
  if (rows[0]) return rows[0]
  const created = await pool.query(
    `insert into auth.users (id, aud, role, phone, raw_app_meta_data, raw_user_meta_data)
     values (gen_random_uuid(), 'authenticated', 'authenticated', $1, '{"provider":"phone"}', '{}') returning *`,
    [d],
  )
  return created.rows[0]
}

// ---- Auth API ----
async function authRoute(req, url, body) {
  const p = url.pathname
  if (req.method === 'POST' && p === '/auth/v1/otp') return [200, {}]

  if (req.method === 'POST' && p === '/auth/v1/verify') {
    if (String(body.token) !== OTP_CODE) throw new HttpError(403, { error: 'otp_expired', error_code: 'otp_expired', msg: 'Token has expired or is invalid' })
    if (body.type === 'phone_change') {
      const uid = bearerUserId(req)
      if (!uid) throw new HttpError(401, { message: 'not signed in' })
      const { rows } = await pool.query('update auth.users set phone = $2 where id = $1 returning *', [uid, digits(body.phone)])
      return [200, session(rows[0])]
    }
    return [200, session(await findOrCreatePhoneUser(body.phone))]
  }

  if (req.method === 'POST' && p === '/auth/v1/token') {
    const grant = url.searchParams.get('grant_type')
    if (grant === 'password') {
      const { rows } = await pool.query('select * from auth.users where email = $1 and dev_password = $2', [body.email, body.password])
      if (!rows[0]) throw new HttpError(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' })
      return [200, session(rows[0])]
    }
    if (grant === 'refresh_token') {
      const m = /^dev-refresh\.(.+)$/.exec(body.refresh_token ?? '')
      if (!m) throw new HttpError(400, { error: 'invalid_grant' })
      const { rows } = await pool.query('select * from auth.users where id = $1', [m[1]])
      if (!rows[0]) throw new HttpError(400, { error: 'invalid_grant' })
      return [200, session(rows[0])]
    }
  }

  if (req.method === 'GET' && p === '/auth/v1/user') {
    const uid = bearerUserId(req)
    if (!uid) throw new HttpError(401, { message: 'invalid JWT' })
    const { rows } = await pool.query('select * from auth.users where id = $1', [uid])
    if (!rows[0]) throw new HttpError(401, { message: 'invalid JWT' })
    return [200, publicUser(rows[0])]
  }

  if (req.method === 'PUT' && p === '/auth/v1/user') {
    const uid = bearerUserId(req)
    if (!uid) throw new HttpError(401, { message: 'not signed in' })
    // The phone is saved only after the code is verified (phone_change), as in Supabase.
    const { rows } = await pool.query('select * from auth.users where id = $1', [uid])
    return [200, publicUser(rows[0])]
  }

  if (req.method === 'POST' && p === '/auth/v1/logout') return [204, null]
  throw new HttpError(404, { message: `no auth route ${req.method} ${p}` })
}

// ---- PostgREST subset ----
const OPS = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' }
const RESERVED = ['select', 'order', 'limit', 'offset', 'on_conflict']

function splitTop(s) {
  const out = []
  let depth = 0, cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) { out.push(cur); cur = '' } else cur += ch
  }
  if (cur) out.push(cur)
  return out
}

function buildWhere(params, values) {
  const clauses = []
  for (const [key, raw] of params) {
    if (RESERVED.includes(key)) continue
    const m = /^(eq|neq|gt|gte|lt|lte|in|is)\.(.*)$/s.exec(raw)
    if (!m) throw new HttpError(400, { message: `unsupported filter ${key}=${raw}` })
    const col = ident(key)
    if (m[1] === 'in') {
      const items = m[2].replace(/^\(|\)$/g, '').split(',').filter((x) => x !== '')
      if (items.length === 0) { clauses.push('false'); continue }
      const ph = items.map((v) => { values.push(v); return `$${values.length}` })
      clauses.push(`${col} in (${ph.join(',')})`)
    } else if (m[1] === 'is') {
      clauses.push(`${col} is ${m[2] === 'null' ? 'null' : m[2] === 'true' ? 'true' : 'false'}`)
    } else {
      values.push(m[2])
      clauses.push(`${col} ${OPS[m[1]]} $${values.length}`)
    }
  }
  return clauses.length ? `where ${clauses.join(' and ')}` : ''
}

function buildOrder(order) {
  if (!order) return ''
  const parts = order.split(',').map((term) => {
    const [col, dir = 'asc', nulls] = term.split('.')
    const d = dir === 'desc' ? 'desc' : 'asc'
    const n = nulls === 'nullslast' ? ' nulls last' : nulls === 'nullsfirst' ? ' nulls first' : ''
    return `${ident(col)} ${d}${n}`
  })
  return `order by ${parts.join(', ')}`
}

function buildSelect(table, select) {
  const items = select && select !== '*' ? splitTop(select) : ['*']
  const embeds = []
  const cols = []
  for (const item of items) {
    const m = /^([a-z_][a-z0-9_]*)\((.*)\)$/.exec(item.trim())
    if (m) embeds.push(m[1])
    else if (item.trim() === '*') cols.push('*')
    else cols.push(item.trim())
  }
  const base = cols.includes('*') || cols.length === 0 ? `to_jsonb(t)` : `jsonb_build_object(${cols.map((c) => `'${c}', t.${ident(c)}`).join(', ')})`
  if (embeds.length === 0) return base
  const singular = table.endsWith('ies') ? table.slice(0, -3) + 'y' : table.replace(/s$/, '')
  const fk = `${singular}_id`
  const subs = embeds.map((rel) => `'${rel}', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from ${ident(rel)} c where c.${ident(fk)} = t.id)`)
  return `${base} || jsonb_build_object(${subs.join(', ')})`
}

function pgToHttp(err) {
  const map = { '23505': 409, '42501': 403, '23503': 409, '23514': 400, '22P02': 400, '42703': 400 }
  return new HttpError(map[err.code] ?? 400, { code: err.code, message: err.message, details: err.detail ?? null, hint: err.hint ?? null })
}

async function inTransaction(uid, fn) {
  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(uid ? { sub: uid, role: 'authenticated' } : {})])
    await client.query(uid ? 'set local role authenticated' : 'set local role anon')
    const result = await fn(client)
    await client.query('commit')
    return result
  } catch (err) {
    await client.query('rollback').catch(() => {})
    if (err instanceof HttpError) throw err
    throw pgToHttp(err)
  } finally {
    client.release()
  }
}

function wantsSingle(req) {
  return (req.headers.accept ?? '').includes('pgrst.object')
}

async function restRoute(req, url, body) {
  const uid = bearerUserId(req)
  const parts = url.pathname.replace(/^\/rest\/v1\//, '').split('/')
  const params = [...url.searchParams]
  const single = wantsSingle(req)

  if (parts[0] === 'rpc' && req.method === 'POST') {
    const fn = ident(parts[1])
    const args = body ?? {}
    const keys = Object.keys(args)
    const values = keys.map((k) => (args[k] === null ? null : typeof args[k] === 'object' ? JSON.stringify(args[k]) : String(args[k])))
    const argSql = keys.map((k, i) => `${ident(k)} => $${i + 1}`).join(', ')
    return inTransaction(uid, async (c) => {
      const meta = await c.query(
        `select p.proretset, t.typtype, t.typname from pg_proc p join pg_type t on t.oid = p.prorettype
         join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1`,
        [parts[1]],
      )
      if (!meta.rows[0]) throw new HttpError(404, { message: `no function ${parts[1]}` })
      const { proretset, typtype, typname } = meta.rows[0]
      if (typname === 'void') { await c.query(`select public.${fn}(${argSql})`, values); return [200, null] }
      if (proretset || typtype === 'c') {
        const { rows } = await c.query(`select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) as j from public.${fn}(${argSql}) s`, values)
        const list = rows[0].j
        return [200, single ? list[0] ?? null : list]
      }
      const { rows } = await c.query(`select to_jsonb(public.${fn}(${argSql})) as j`, values)
      return [200, rows[0].j]
    })
  }

  const table = ident(parts[0])
  if (req.method === 'GET') {
    const values = []
    const where = buildWhere(params, values)
    const order = buildOrder(url.searchParams.get('order'))
    const limit = url.searchParams.get('limit') ? `limit ${Number(url.searchParams.get('limit'))}` : ''
    const offset = url.searchParams.get('offset') ? `offset ${Number(url.searchParams.get('offset'))}` : ''
    const expr = buildSelect(parts[0], url.searchParams.get('select') ?? '*')
    return inTransaction(uid, async (c) => {
      const { rows } = await c.query(
        `select coalesce(jsonb_agg(s.r), '[]'::jsonb) as j from (
           select ${expr} as r from ${table} t ${where} ${order} ${limit} ${offset}) s`,
        values,
      )
      const list = rows[0].j
      if (single) {
        if (list.length !== 1) throw new HttpError(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' })
        return [200, list[0]]
      }
      return [200, list]
    })
  }

  if (req.method === 'POST') {
    const rows = Array.isArray(body) ? body : [body]
    const columns = Object.keys(rows[0] ?? {})
    const colSql = columns.map(ident).join(', ')
    const prefer = req.headers.prefer ?? ''
    const onConflict = url.searchParams.get('on_conflict')
    let conflict = ''
    if (prefer.includes('merge-duplicates') && onConflict) {
      const keys = onConflict.split(',')
      const sets = columns.filter((c) => !keys.includes(c)).map((c) => `${ident(c)} = excluded.${ident(c)}`)
      conflict = `on conflict (${keys.map(ident).join(', ')}) ${sets.length ? `do update set ${sets.join(', ')}` : 'do nothing'}`
    }
    return inTransaction(uid, async (c) => {
      const { rows: out } = await c.query(
        `insert into ${table} (${colSql}) select ${colSql} from jsonb_populate_recordset(null::${table}, $1::jsonb) ${conflict}
         returning to_jsonb(${table}.*) as r`,
        [JSON.stringify(rows)],
      )
      const list = out.map((x) => x.r)
      if (!prefer.includes('return=representation')) return [201, null]
      return [201, single ? list[0] : list]
    })
  }

  if (req.method === 'PATCH') {
    const data = body ?? {}
    const keys = Object.keys(data)
    const values = keys.map((k) => (data[k] === null ? null : typeof data[k] === 'object' ? JSON.stringify(data[k]) : String(data[k])))
    const sets = keys.map((k, i) => `${ident(k)} = $${i + 1}`)
    const filterValues = []
    const where = buildWhere(params, filterValues).replace(/\$(\d+)/g, (_, n) => `$${Number(n) + values.length}`)
    return inTransaction(uid, async (c) => {
      const { rows } = await c.query(
        `update ${table} set ${sets.join(', ')} ${where} returning to_jsonb(${table}.*) as r`,
        [...values, ...filterValues],
      )
      const list = rows.map((x) => x.r)
      if (!String(req.headers.prefer ?? '').includes('return=representation')) return [204, null]
      return [200, single ? list[0] ?? null : list]
    })
  }

  if (req.method === 'DELETE') {
    const values = []
    const where = buildWhere(params, values)
    return inTransaction(uid, async (c) => {
      const { rows } = await c.query(`delete from ${table} ${where} returning to_jsonb(${table}.*) as r`, values)
      return [200, rows.map((x) => x.r)]
    })
  }

  throw new HttpError(404, { message: `no route ${req.method} ${url.pathname}` })
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

http.createServer(async (req, res) => {
  res.setHeader('access-control-allow-origin', '*')
  res.setHeader('access-control-allow-headers', '*')
  res.setHeader('access-control-allow-methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS')
  if (req.method === 'OPTIONS') return res.writeHead(204).end()
  try {
    const url = new URL(req.url, 'http://localhost')
    const raw = await readBody(req)
    const body = raw ? JSON.parse(raw) : null
    const [status, payload] = url.pathname.startsWith('/auth/v1/')
      ? await authRoute(req, url, body ?? {})
      : url.pathname.startsWith('/rest/v1/')
        ? await restRoute(req, url, body)
        : [404, { message: 'not found' }]
    res.writeHead(status, { 'content-type': 'application/json' })
    res.end(payload === null || status === 204 ? '' : JSON.stringify(payload))
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500
    const payload = err instanceof HttpError ? err.body : { message: String(err) }
    if (status === 500) console.error(err)
    res.writeHead(status, { 'content-type': 'application/json' })
    res.end(JSON.stringify(payload))
  }
}).listen(PORT, () => console.log(`local backend on http://localhost:${PORT} (dev only, OTP code ${OTP_CODE})`))
