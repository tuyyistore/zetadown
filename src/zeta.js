// Zeta Download — server tanpa dependensi (Node >= 18)
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import { SERVICES, SEARCHES, detectService, createApi, resolve, search, sign, verify, safeName } from './core.js'
import { createStats } from './stats.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

// .env loader sederhana
try {
  for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
} catch {}

const PORT = Number(process.env.PORT) || 3000
const SECRET = process.env.SIGN_SECRET || ''
const LIMIT = Number(process.env.RATE_LIMIT) || 20
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' }

const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)) }

// FILE_MODE: 'proxy' (stream lewat server, VPS) | 'redirect' (302 ke sumber, otomatis di Vercel)
const FILE_MODE = process.env.FILE_MODE || (process.env.VERCEL ? 'redirect' : 'proxy')

export function buildServer({ apiFn, stats, fetchImpl = fetch, secret = SECRET, limit = LIMIT, fileMode = FILE_MODE } = {}) {
  stats ||= createStats({ tz: process.env.STATS_TZ || 'Asia/Jakarta' })
  const DEFAULT_BASE = 'https://api.neoxr.eu/api'
  const apiBase = process.env.NEOXR_BASE || DEFAULT_BASE
  // cadangan: .my.id (dipakai bot lama). Bisa diubah/dimatikan lewat NEOXR_FALLBACK (isi "off" untuk mematikan).
  const apiFallback = process.env.NEOXR_FALLBACK === 'off' ? '' : process.env.NEOXR_FALLBACK || (apiBase === DEFAULT_BASE ? 'https://api.neoxr.my.id/api' : '')
  apiFn ||= createApi({ base: apiBase, fallback: apiFallback, key: (process.env.API_KEY || '').trim() })

  const hits = new Map()
  setInterval(() => { const n = Date.now(); for (const [k, v] of hits) if (v.reset < n) hits.delete(k) }, 60000).unref()
  const limited = (ip) => {
    const now = Date.now()
    let h = hits.get(ip)
    if (!h || h.reset < now) hits.set(ip, (h = { n: 0, reset: now + 60000 }))
    return ++h.n > limit
  }
  const clientIp = req => (process.env.TRUST_PROXY ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '') || req.socket.remoteAddress

  const withLinks = (result) => {
    const exp = Date.now() + 30 * 60 * 1000
    result.items = result.items.map(it => {
      const name = safeName(it.filename || result.title)
      const t = sign(secret, { u: it.url, n: name, r: it.referer, e: exp })
      return { kind: it.kind, label: it.label, size: it.size, filename: name, download: `/api/file?t=${t}`, preview: `/api/file?t=${t}&inline=1` }
    })
    return result
  }

  async function handleApi(req, res, u) {
    const q = u.searchParams
    if (u.pathname === '/api/services') {
      return json(res, 200, {
        status: true,
        services: Object.entries(SERVICES).filter(([, s]) => !s.hidden).map(([id, s]) => ({ id, name: s.name, category: s.category })),
        searches: Object.entries(SEARCHES).map(([id, s]) => ({ id, label: s.label }))
      })
    }
    if (limited(clientIp(req))) return json(res, 429, { status: false, msg: 'Terlalu banyak permintaan, coba lagi sebentar.' })

    if (u.pathname === '/api/stats') {
      try { return json(res, 200, { status: true, ...(await stats.read()) }) }
      catch (e) { console.error('[stats] gagal membaca:', e.message); return json(res, 503, { status: false, msg: 'Statistik belum tersedia' }) }
    }

    if (u.pathname === '/api/resolve') {
      const url = q.get('url'), query = q.get('q'), no = q.get('no')
      let service = q.get('service')
      if (!service) {
        if (!url) return json(res, 400, { status: false, msg: 'Masukkan link' })
        if (!/^https?:\/\//i.test(url)) return json(res, 400, { status: false, msg: 'Link harus diawali http:// atau https://' })
        service = detectService(url)
        if (!service) return json(res, 400, { status: false, msg: 'Link belum didukung. Lihat daftar platform di bawah.' })
      }
      const svc = SERVICES[service]
      if (!svc) return json(res, 400, { status: false, msg: 'Layanan tidak dikenal' })
      if (svc.detect && !url) return json(res, 400, { status: false, msg: 'Parameter url wajib' })
      if (!svc.detect && !query) return json(res, 400, { status: false, msg: 'Parameter q wajib' })
      const data = withLinks(await resolve(apiFn, service, { url: url?.slice(0, 2000), q: query?.slice(0, 200), no: no ? Number(no) : undefined }))
      await stats.hit('u')
      return json(res, 200, { status: true, data })
    }

    if (u.pathname === '/api/search') {
      const query = (q.get('q') || '').trim().slice(0, 200)
      if (!query) return json(res, 400, { status: false, msg: 'Kata kunci kosong' })
      return json(res, 200, { status: true, ...(await search(apiFn, q.get('type'), query)) })
    }

    if (u.pathname === '/api/file') {
      const p = verify(secret, q.get('t'))
      if (!p) return json(res, 403, { status: false, msg: 'Link kedaluwarsa, ulangi proses.' })
      const range = req.headers.range
      // kandidat hitungan: unduhan asli saja (bukan preview, HEAD, atau lanjutan Range)
      const countable = !q.get('inline') && req.method === 'GET' && (!range || /^bytes=0-/.test(range))
      // mode redirect: selesai-tidaknya unduhan terjadi di server sumber dan tidak bisa dipantau, jadi dihitung saat diteruskan
      if (fileMode === 'redirect') { if (countable) await stats.hit('d'); res.writeHead(302, { location: p.u, 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer' }); return res.end() }
      const headers = { 'user-agent': 'Mozilla/5.0' }
      if (p.r) headers.referer = p.r
      if (req.headers.range) headers.range = req.headers.range
      const up = await fetchImpl(p.u, { headers, redirect: 'follow', signal: AbortSignal.timeout(30000) })
      if (!up.ok && up.status !== 206) return json(res, 502, { status: false, msg: `Sumber menolak (HTTP ${up.status})` })
      const out = { 'cache-control': 'private, no-store', 'content-disposition': `${q.get('inline') ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(p.n)}` }
      for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) if (up.headers.get(h)) out[h] = up.headers.get(h)
      res.writeHead(up.status, out)
      const stream = Readable.fromWeb(up.body)
      let complete = false, failed = false
      stream.on('end', () => { complete = true })
      res.on('close', () => stream.destroy())
      stream.on('error', () => { failed = true; res.end() })
      // download sukses = seluruh isi sudah terkirim; dibatalkan pengguna atau putus di tengah tidak dihitung
      if (countable) res.on('finish', () => { if (complete && !failed) stats.hit('d') })
      return stream.pipe(res)
    }
    return json(res, 404, { status: false, msg: 'Not found' })
  }

  function serveStatic(req, res, u) {
    let rel = decodeURIComponent(u.pathname)
    if (rel.endsWith('/')) rel += 'index.html'
    const file = path.normalize(path.join(ROOT, 'public', rel))
    if (!file.startsWith(path.join(ROOT, 'public'))) { res.writeHead(403); return res.end() }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Not found') }
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' })
      res.end(buf)
    })
  }

  return http.createServer(async (req, res) => {
    res.setHeader('x-content-type-options', 'nosniff')
    try {
      const u = new URL(req.url, 'http://x')
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end() }
      if (u.pathname.startsWith('/api/')) return await handleApi(req, res, u)
      serveStatic(req, res, u)
    } catch (e) {
      if (!e.code) console.error(e)
      if (res.headersSent) return res.end()
      json(res, Number.isInteger(e.code) ? e.code : 500, { status: false, msg: Number.isInteger(e.code) ? e.message : 'Terjadi kesalahan pada server' })
    }
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!process.env.API_KEY) console.warn('[!] API_KEY belum diisi di .env')
  if (SECRET.length < 16) console.warn('[!] SIGN_SECRET kosong/pendek — isi string acak panjang di .env')
  buildServer().listen(PORT, () => console.log(`Zeta Download jalan di http://localhost:${PORT}`))
}
