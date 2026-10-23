// Statistik penggunaan & download — tanpa dependensi.
// Penyimpanan: Upstash Redis (REST) bila env tersedia → file JSON (VPS) → memori (Vercel tanpa Redis, tidak permanen).
//
// Data disimpan sebagai counter harian + total:
//   u:YYYY-MM-DD  jumlah penggunaan (link/judul berhasil diproses)   u:total
//   d:YYYY-MM-DD  jumlah download (klik download, bukan preview)     d:total
// Mingguan/bulanan dihitung saat dibaca dari counter harian.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const DAY = /^[ud]:(\d{4}-\d{2}-\d{2})$/

// ---------- tanggal (zona waktu bisa diatur, default WIB) ----------
export function dayKey(ts = Date.now(), tz = 'Asia/Jakarta') {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ts) }
  catch { return new Date(ts).toISOString().slice(0, 10) } // zona tidak valid → UTC
}
const shift = (key, n) => { const d = new Date(`${key}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }

// ---------- agregasi ----------
// today: kunci tanggal hari ini. Minggu = Senin..hari ini, bulan = tanggal 1..hari ini.
export function summarize(all, today, { days = 14 } = {}) {
  const n = k => Number(all[k]) || 0
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay() // 0 = Minggu
  const weekStart = shift(today, -((dow + 6) % 7))
  const monthStart = `${today.slice(0, 8)}01`
  const sum = (t, from) => { let s = 0; for (let k = from; k <= today; k = shift(k, 1)) s += n(`${t}:${k}`); return s }
  const block = t => ({ today: n(`${t}:${today}`), week: sum(t, weekStart), month: sum(t, monthStart), total: n(`${t}:total`) })
  const daily = []
  for (let i = days - 1; i >= 0; i--) { const date = shift(today, -i); daily.push({ date, use: n(`u:${date}`), dl: n(`d:${date}`) }) }
  let since = null
  for (const k of Object.keys(all)) { const m = k.match(DAY); if (m && (!since || m[1] < since)) since = m[1] }
  return { usage: block('u'), downloads: block('d'), daily, since }
}

// ---------- penyimpanan ----------
export function memoryStore() {
  const m = new Map()
  return {
    kind: 'memory', persistent: false,
    async incr(fields) { for (const f of fields) m.set(f, (m.get(f) || 0) + 1) },
    async all() { return Object.fromEntries(m) }
  }
}

export function fileStore(file) {
  let data = {}
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')) } catch {}
  let timer, dirty = false
  const flush = () => {
    clearTimeout(timer)
    if (!dirty) return
    dirty = false
    try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(`${file}.tmp`, JSON.stringify(data)); fs.renameSync(`${file}.tmp`, file) }
    catch (e) { dirty = true; console.error('[stats] gagal menyimpan:', e.message) }
  }
  process.once('exit', flush)
  return {
    kind: 'file', persistent: true, flush,
    async incr(fields) { for (const f of fields) data[f] = (data[f] || 0) + 1; dirty = true; clearTimeout(timer); timer = setTimeout(flush, 500); timer.unref?.() },
    async all() { return { ...data } }
  }
}

// Upstash Redis lewat REST API (HINCRBY dalam satu request pipeline; tiap HINCRBY atomik)
export function redisStore({ url, token, fetchImpl = fetch, key = 'zeta:stats', timeoutMs = 3000 }) {
  const call = async (suffix, body) => {
    const res = await fetchImpl(url.replace(/\/$/, '') + suffix, {
      method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs)
    })
    const j = await res.json().catch(() => ({}))
    const bad = Array.isArray(j) ? j.find(x => x?.error) : j?.error ? j : null
    if (!res.ok || bad) throw new Error(bad?.error || `Redis HTTP ${res.status}`)
    return j
  }
  return {
    kind: 'redis', persistent: true,
    async incr(fields) { await call('/pipeline', fields.map(f => ['HINCRBY', key, f, 1])) },
    async all() {
      const { result } = await call('', ['HGETALL', key])
      const out = {}
      if (Array.isArray(result)) for (let i = 0; i < result.length; i += 2) out[result[i]] = Number(result[i + 1])
      else for (const [k, v] of Object.entries(result || {})) out[k] = Number(v)
      return out
    }
  }
}

export function createStore(env = process.env, fetchImpl = fetch) {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN
  if (url && token) return redisStore({ url, token, fetchImpl })
  if (env.VERCEL) return memoryStore() // filesystem Vercel tidak permanen
  return fileStore(env.STATS_FILE || path.join(ROOT, 'data', 'stats.json'))
}

// ---------- API yang dipakai server ----------
export function createStats({ store, tz = 'Asia/Jakarta', now = () => Date.now() } = {}) {
  store ||= createStore()
  return {
    store,
    // type: 'u' (penggunaan) | 'd' (download). Tidak pernah melempar error — statistik tidak boleh merusak aplikasi.
    async hit(type) {
      try { await store.incr([`${type}:${dayKey(now(), tz)}`, `${type}:total`]) }
      catch (e) { console.error('[stats] gagal mencatat:', e.message) }
    },
    async read() {
      const all = await store.all()
      return { ...summarize(all, dayKey(now(), tz)), tz, storage: store.kind, persistent: store.persistent }
    }
  }
}
