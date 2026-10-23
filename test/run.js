import assert from 'node:assert/strict'
import http from 'node:http'
import { buildServer } from '../src/zeta.js'
import { detectService, createApi, resolve, sign, verify } from '../src/core.js'

// --- file host tiruan (mendukung Range) ---
const BODY = Buffer.from('0123456789'.repeat(100))
let lastRef = ''
const fileHost = http.createServer((req, res) => {
  lastRef = req.headers.referer || ''
  if (req.url.startsWith('/deny')) { res.writeHead(403); return res.end() }
  const r = req.headers.range?.match(/bytes=(\d+)-(\d*)/)
  if (r) { const s = +r[1], e = r[2] ? +r[2] : BODY.length - 1; res.writeHead(206, { 'content-type': 'video/mp4', 'content-range': `bytes ${s}-${e}/${BODY.length}`, 'content-length': e - s + 1, 'x-ref': req.headers.referer || '' }); return res.end(BODY.subarray(s, e + 1)) }
  res.writeHead(200, { 'content-type': 'video/mp4', 'content-length': BODY.length, 'x-ref': req.headers.referer || '' }); res.end(BODY)
})
await new Promise(r => fileHost.listen(0, r))
const F = `http://127.0.0.1:${fileHost.address().port}`

// --- Neoxr tiruan: mencatat panggilan, mengembalikan bentuk respons seperti plugin bot ---
const calls = []
const fx = {
  '/tiktok': () => ({ status: true, data: { caption: 'cap', author: { nickname: 'Nick', uniqueId: 'nick' }, video: `${F}/v.mp4`, videoWM: `${F}/wm.mp4`, audio: `${F}/a.mp3` } }),
  '/tiktok-photo': () => ({ status: true, data: { photo: [`${F}/1.jpg`, `${F}/2.jpg`] } }),
  '/fb': () => ({ status: true, data: [{ quality: 'HD', response: 200, url: `${F}/hd.mp4` }, { quality: 'SD', response: 404, url: `${F}/sd.mp4` }] }),
  '/ig': () => ({ status: true, data: [{ type: 'mp4', url: `${F}/r.mp4` }, { type: 'jpg', url: `${F}/p.jpg` }] }),
  '/twitter': () => ({ status: true, data: [{ type: 'mp4', url: `${F}/t.mp4` }, { type: 'jpg', url: `${F}/t.jpg` }] }),
  '/mediafire': () => ({ status: true, data: { title: 'file.zip', filename: 'file.zip', size: '10 MB', extension: 'zip', mime: 'application/zip', url: `${F}/f.zip` } }),
  '/terabox': () => ({ status: true, data: [{ server_filename: 'x.mp4', size: '5 MB', dlink: `${F}/x.mp4` }] }),
  '/spotify': () => ({ status: true, data: { title: 'Song', artist: { name: 'Art' }, duration: '3:00', thumbnail: `${F}/c.jpg`, url: `${F}/s.mp3` } }),
  '/spotify-search': () => ({ status: true, data: [{ title: 'Song', artist: 'Art', duration: '3:00', url: 'https://open.spotify.com/track/1' }] }),
  '/play': () => ({ status: true, title: 'Judul', duration: '3:10', thumbnail: `${F}/t.jpg`, data: { url: `${F}/p.mp3`, size: '3 MB', quality: '128kbps', filename: 'judul.mp3' } }),
  '/apk': (p) => p.no ? ({ status: true, data: { name: 'App', version: '1', developer: 'Dev', thumbnail: `${F}/i.png` }, file: { url: `${F}/a.apk`, size: '9 MB', filename: 'app.apk' } }) : ({ status: true, data: [{ name: 'App', size: '9 MB', version: '1', url: 'u' }] }),
  '/youtube': (p) => p.type === 'video' && p.quality === '720p' ? ({ status: false, msg: 'no 720' }) : ({ status: true, title: 'YT', duration: '1:00', thumbnail: `${F}/y.jpg`, data: { url: `${F}/y.${p.type === 'video' ? 'mp4' : 'mp3'}`, size: '2 MB', quality: p.quality, filename: `yt.${p.type === 'video' ? 'mp4' : 'mp3'}` } }),
  '/gdrive': () => ({ status: false, msg: 'File private' })
}
const apiFn = async (ep, p) => { calls.push([ep, p]); return fx[ep](p) }

const SECRET = 'test-secret-test-secret'
const srv = buildServer({ apiFn, secret: SECRET, limit: 1000 })
await new Promise(r => srv.listen(0, r))
const B = `http://127.0.0.1:${srv.address().port}`
const get = async (p, init) => { const r = await fetch(B + p, init); const t = await r.text(); let j; try { j = JSON.parse(t) } catch {} return { r, j, t } }
const ok = (n) => console.log('  ✓', n)

// detect
assert.equal(detectService('https://vm.tiktok.com/ZS/'), 'tiktok')
assert.equal(detectService('https://www.instagram.com/reel/x/'), 'instagram')
assert.equal(detectService('https://youtu.be/abc'), 'youtube')
assert.equal(detectService('https://www.youtube.com/post/abc'), 'ytpost')
assert.equal(detectService('https://x.com/a/status/1'), 'twitter')
assert.equal(detectService('https://open.spotify.com/track/1'), 'spotify')
assert.equal(detectService('https://www.mediafire.com/file/x'), 'mediafire')
assert.equal(detectService('https://example.com'), null)
assert.equal(detectService('https://terabox.com/s/x'), 'terabox')
assert.equal(detectService('https://example.com/?u=https://tiktok.com'), null)
assert.equal(detectService('https://www.youtube.com/watch?v=1'), 'youtube')
assert.equal(detectService('https://www.facebook.com/watch?v=1'), 'facebook')
assert.equal(detectService('https://id.pinterest.com/pin/1'), 'pinterest')
assert.equal(detectService('notaurl'), null)
ok('auto-detect platform')

// resolve tiktok
let { j } = await get('/api/resolve?url=' + encodeURIComponent('https://vm.tiktok.com/ZS/'))
assert.equal(j.status, true); assert.equal(j.data.serviceName, 'TikTok'); assert.equal(j.data.items.length, 3)
assert.ok(!JSON.stringify(j).includes(F), 'URL asli sumber tidak boleh bocor ke klien')
assert.ok(!JSON.stringify(j).includes('apikey'))
ok('tiktok: 3 item, URL sumber tidak bocor')

;({ j } = await get('/api/resolve?url=' + encodeURIComponent('https://fb.watch/x')))
assert.equal(j.data.items.length, 1); assert.match(j.data.items[0].label, /HD/); ok('facebook: filter response 200')
;({ j } = await get('/api/resolve?url=' + encodeURIComponent('https://www.instagram.com/reel/x/')))
assert.deepEqual(j.data.items.map(i => i.kind), ['video', 'image']); ok('instagram: video + foto')
;({ j } = await get('/api/resolve?url=' + encodeURIComponent('https://x.com/a/status/1')))
assert.equal(j.data.items.length, 2); ok('twitter')
;({ j } = await get('/api/resolve?url=' + encodeURIComponent('https://www.mediafire.com/file/x')))
assert.equal(j.data.meta.Ukuran, '10 MB'); ok('mediafire')
;({ j } = await get('/api/resolve?url=' + encodeURIComponent('https://terabox.com/s/x')))
assert.equal(j.data.items[0].kind, 'file'); ok('terabox')
;({ j } = await get('/api/resolve?url=' + encodeURIComponent('https://open.spotify.com/track/1')))
assert.equal(j.data.author, 'Art'); ok('spotify')

// youtube: video 720p gagal → fallback 480p, audio paralel
calls.length = 0
;({ j } = await get('/api/resolve?url=' + encodeURIComponent('https://youtu.be/abc')))
assert.deepEqual(j.data.items.map(i => i.label), ['MP4 480p', 'MP3 128kbps'])
assert.ok(calls.some(([, p]) => p.quality === '480p')); ok('youtube: fallback 480p + audio')

// play (cari → langsung)
;({ j } = await get('/api/search?type=play&q=halo'))
assert.deepEqual(j.direct, { service: 'play', q: 'halo' })
;({ j } = await get('/api/resolve?service=play&q=halo'))
assert.equal(j.data.items[0].kind, 'audio'); ok('play: search → resolve')

// spotify search → resolve
;({ j } = await get('/api/search?type=spotify&q=x'))
assert.equal(j.results[0].resolve.service, 'spotify'); ok('spotify search')

// apk search → resolve dengan no
;({ j } = await get('/api/search?type=apk&q=whatsapp'))
assert.deepEqual(j.results[0].resolve, { service: 'apk', q: 'whatsapp', no: 1 })
;({ j } = await get('/api/resolve?service=apk&q=whatsapp&no=1'))
assert.equal(j.data.items[0].filename, 'app.apk'); ok('apk search → download')

// error dari API
let r2 = await get('/api/resolve?url=' + encodeURIComponent('https://drive.google.com/file/d/1/view'))
assert.equal(r2.r.status, 502); assert.equal(r2.j.msg, 'File private'); ok('error API diteruskan (502)')

// validasi input
assert.equal((await get('/api/resolve')).r.status, 400)
assert.equal((await get('/api/resolve?url=javascript:alert(1)')).r.status, 400)
assert.equal((await get('/api/resolve?url=https://example.com')).r.status, 400)
assert.equal((await get('/api/resolve?service=nope&url=https://a.b')).r.status, 400)
assert.equal((await get('/api/search?type=spotify')).r.status, 400)
ok('validasi input')

// proxy file
;({ j } = await get('/api/resolve?url=' + encodeURIComponent('https://vm.tiktok.com/ZS/')))
const dl = j.data.items[0]
let f = await fetch(B + dl.download)
assert.equal(f.status, 200); assert.match(f.headers.get('content-disposition'), /^attachment; filename\*=UTF-8''/)
assert.equal((await f.arrayBuffer()).byteLength, BODY.length)
f = await fetch(B + dl.preview, { headers: { range: 'bytes=10-19' } })
assert.equal(f.status, 206); assert.equal(Buffer.from(await f.arrayBuffer()).toString(), '0123456789'); assert.match(f.headers.get('content-disposition'), /^inline/)
ok('file proxy: download + Range (preview)')

// referer youtube diteruskan
;({ j } = await get('/api/resolve?url=' + encodeURIComponent('https://youtu.be/abc')))
f = await fetch(B + j.data.items[0].download); assert.equal(lastRef, 'https://tomp3.cc/'); await f.arrayBuffer(); ok('referer tomp3.cc diteruskan')

// token: dirusak / kedaluwarsa / bukan buatan server
const [body] = dl.download.split('t=')[1].split('.')
assert.equal((await get(`/api/file?t=${body}.AAAA`)).r.status, 403)
assert.equal((await get('/api/file?t=garbage')).r.status, 403)
assert.equal((await get('/api/file')).r.status, 403)
const expired = sign(SECRET, { u: `${F}/v.mp4`, n: 'x', e: Date.now() - 1 })
assert.equal((await get(`/api/file?t=${expired}`)).r.status, 403)
const forged = sign('other-secret-other-secret', { u: 'http://169.254.169.254/', n: 'x', e: Date.now() + 1e6 })
assert.equal((await get(`/api/file?t=${forged}`)).r.status, 403)
assert.equal(verify(SECRET, sign(SECRET, { u: 'u', e: Date.now() + 1000 })).u, 'u')
ok('token: rusak/kedaluwarsa/palsu ditolak (bukan open proxy)')

// sumber menolak
const denied = sign(SECRET, { u: `${F}/deny`, n: 'x', e: Date.now() + 1e5 })
assert.equal((await get(`/api/file?t=${denied}`)).r.status, 502); ok('sumber 403 → 502')

// static + traversal
let s = await get('/'); assert.equal(s.r.status, 200); assert.match(s.t, /Zeta Download/)
assert.equal((await get('/app.js')).r.status, 200); assert.equal((await get('/css/style.min.css')).r.status, 200); assert.equal((await get('/css/site.css')).r.status, 200); assert.equal((await get('/favicon.ico')).r.status, 200)
const trav = await new Promise(res => { const q = http.request({ host: '127.0.0.1', port: srv.address().port, path: '/..%2f..%2fserver.js' }, r => res(r.statusCode)); q.end() })
assert.ok([403, 404].includes(trav)); assert.equal((await get('/server.js')).r.status, 404); assert.equal((await get('/.env')).r.status, 404)
ok('static + path traversal diblok')

// services
;({ j } = await get('/api/services')); assert.ok(j.services.length >= 20); assert.ok(!j.services.some(s => s.id === 'play')); ok(`/api/services (${j.services.length} platform)`)

// rate limit
const rl = buildServer({ apiFn, secret: SECRET, limit: 3 }); await new Promise(r => rl.listen(0, r))
const codes = []; for (let i = 0; i < 5; i++) codes.push((await fetch(`http://127.0.0.1:${rl.address().port}/api/search?type=play&q=a`)).status)
assert.deepEqual(codes, [200, 200, 200, 429, 429]); ok('rate limit 429')

// createApi: URL & apikey sesuai
let seen; const real = createApi({ base: 'https://api.neoxr.eu/api/', key: 'KEY', fetchImpl: async u => { seen = String(u); return { status: 200, text: async () => '{"status":true}' } } })
await real('/tiktok', { url: 'https://x/?a=1&b=2', skip: undefined })
assert.equal(seen, 'https://api.neoxr.eu/api/tiktok?url=https%3A%2F%2Fx%2F%3Fa%3D1%26b%3D2&apikey=KEY'); ok('createApi: query & apikey benar')

// createApi: respons HTML (HTTP 200) → pesan jelas + fallback ke base cadangan
{
  const origErr = console.error; console.error = () => {}
  const hosts = []
  const mk = (map) => async u => { hosts.push(new URL(u).host); const r = map(new URL(u).host); return { status: 200, headers: new Headers({ 'content-type': r.type }), text: async () => r.body } }
  const html = { type: 'text/html; charset=utf-8', body: '<!doctype html><html><body>x</body></html>' }
  const okj = { type: 'application/json', body: '{"status":true,"data":{}}' }
  const a1 = createApi({ base: 'https://a.test/api', fallback: 'https://b.test/api', key: 'K', fetchImpl: mk(h => (h === 'a.test' ? html : okj)) })
  assert.equal((await a1('/tiktok', { url: 'x' })).status, true); assert.deepEqual(hosts, ['a.test', 'b.test'])
  const a2 = createApi({ base: 'https://a.test/api', key: 'K', fetchImpl: mk(() => html) })
  const e2 = await a2('/tiktok', { url: 'x' })
  assert.equal(e2.status, false); assert.match(e2.msg, /bukan JSON \(HTTP 200, text\/html\)/); assert.match(e2.msg, /NEOXR_BASE/)
  assert.ok(!JSON.stringify(e2).includes('apikey') && !e2.msg.includes('K&'))
  const a3 = createApi({ base: 'https://a.test/api', key: '', fetchImpl: async () => { throw new Error('tidak boleh dipanggil') } })
  assert.match((await a3('/tiktok')).msg, /API_KEY belum diisi/)
  const a4 = createApi({ base: 'https://a.test/api', key: 'K', fetchImpl: async () => { throw Object.assign(new Error('boom'), { name: 'TypeError' }) } })
  assert.match((await a4('/tiktok')).msg, /Tidak bisa terhubung/)
  console.error = origErr; ok('createApi: HTML 200 → pesan jelas, fallback base, API_KEY kosong, error jaringan')
}

// Instagram: caption ikut terbawa bila API mengirimnya, dan tidak error bila tidak ada
{
  const igOk = await resolve(async () => ({ status: true, caption: 'hai #ig', data: [{ type: 'mp4', url: 'http://x/v.mp4' }] }), 'instagram', { url: 'https://instagram.com/reel/x' })
  assert.equal(igOk.title, 'hai #ig')
  const igNo = await resolve(async () => ({ status: true, data: [{ type: 'mp4', url: 'http://x/v.mp4' }] }), 'instagram', { url: 'https://instagram.com/reel/x' })
  assert.equal(igNo.title, ''); ok('instagram: caption dipetakan (kosong jika API tidak mengirim)')
}

// mode redirect (Vercel)
const rd = buildServer({ apiFn, secret: SECRET, limit: 1000, fileMode: 'redirect' }); await new Promise(r => rd.listen(0, r))
const RB = `http://127.0.0.1:${rd.address().port}`
const rj = await (await fetch(RB + '/api/resolve?url=' + encodeURIComponent('https://vm.tiktok.com/ZS/'))).json()
const rr = await fetch(RB + rj.data.items[0].download, { redirect: 'manual' })
assert.equal(rr.status, 302); assert.equal(rr.headers.get('location'), `${F}/v.mp4`)
assert.equal((await fetch(RB + '/api/file?t=bad', { redirect: 'manual' })).status, 403); ok('mode redirect (Vercel): 302 ke sumber, token tetap divalidasi')

console.log('\nSemua tes lulus'); process.exit(0)
