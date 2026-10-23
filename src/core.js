// Normalizer + pemanggil Neoxr API. Endpoint & field mengikuti plugins/download bot.
import crypto from 'node:crypto'

const str = v => (v === undefined || v === null ? '' : String(v))
const arr = v => (Array.isArray(v) ? v : [])
const kindOf = (t = '', url = '') => {
  const s = `${t} ${url}`.toLowerCase()
  if (/mp4|video|webm|mov/.test(s)) return 'video'
  if (/mp3|audio|m4a|aac|opus|flac/.test(s)) return 'audio'
  if (/jpe?g|png|webp|image|photo|gif/.test(s)) return 'image'
  return 'file'
}
const item = (o) => (o && o.url ? { kind: o.kind || kindOf(o.type, o.url), label: o.label || 'Download', url: o.url, filename: o.filename || '', size: o.size || '', referer: o.referer || '' } : null)
const clean = list => list.filter(Boolean)

// ---------- Layanan ----------
// detect: regex untuk auto-detect dari URL. call: fungsi yang memanggil API. map: json -> hasil seragam.
export const SERVICES = {
  tiktok: {
    name: 'TikTok', category: 'video', detect: /(^|[/.])(tiktok\.com|tt\.site)/i,
    call: (api, { url }) => [api('/tiktok', { url })],
    map: ([j]) => ({
      title: j.data?.caption, author: j.data?.author?.nickname && `${j.data.author.nickname} (@${j.data.author.uniqueId || ''})`,
      thumbnail: j.data?.cover || j.data?.thumbnail || arr(j.data?.photo)[0],
      items: clean([
        item({ kind: 'video', label: 'Video (tanpa WM)', url: j.data?.video, filename: 'tiktok.mp4' }),
        item({ kind: 'video', label: 'Video (WM)', url: j.data?.videoWM, filename: 'tiktok-wm.mp4' }),
        item({ kind: 'audio', label: 'Audio MP3', url: j.data?.audio, filename: 'tiktok.mp3' }),
        ...arr(j.data?.photo).map((u, i) => item({ kind: 'image', label: `Foto ${i + 1}`, url: u, filename: `tiktok-${i + 1}.jpg` }))
      ])
    })
  },
  douyin: {
    name: 'Douyin', category: 'video', detect: /(^|[/.])douyin\.com/i,
    call: (api, { url }) => [api('/douyin', { url })],
    map: ([j]) => ({
      title: j.data?.caption || j.data?.title, thumbnail: j.data?.cover || arr(j.data?.photo)[0],
      items: clean([
        item({ kind: 'video', label: 'Video', url: j.data?.video, filename: 'douyin.mp4' }),
        item({ kind: 'video', label: 'Video (WM)', url: j.data?.videoWM, filename: 'douyin-wm.mp4' }),
        item({ kind: 'audio', label: 'Audio MP3', url: j.data?.audio, filename: 'douyin.mp3' }),
        ...arr(j.data?.photo).map((u, i) => item({ kind: 'image', label: `Foto ${i + 1}`, url: u, filename: `douyin-${i + 1}.jpg` }))
      ])
    })
  },
  instagram: {
    name: 'Instagram', category: 'video', detect: /(^|[/.])instagram\.com/i,
    call: (api, { url }) => [api('/ig', { url })],
    map: ([j]) => ({
      title: j.caption || j.title || arr(j.data).find(v => v.caption)?.caption,
      thumbnail: arr(j.data).find(v => v.type !== 'mp4')?.url,
      items: arr(j.data).map((v, i) => item({ kind: v.type === 'mp4' ? 'video' : 'image', label: `${v.type === 'mp4' ? 'Video' : 'Foto'} ${i + 1}`, url: v.url, filename: `instagram-${i + 1}.${v.type === 'mp4' ? 'mp4' : 'jpg'}` }))
    })
  },
  facebook: {
    name: 'Facebook', category: 'video', detect: /(^|[/.])(facebook\.com|fb\.com|fb\.watch)/i,
    call: (api, { url }) => [api('/fb', { url })],
    map: ([j]) => ({
      items: arr(j.data).filter(v => v.response == 200 || v.response === undefined).map(v => item({ kind: 'video', label: `Video ${v.quality || ''}`.trim(), url: v.url, filename: `facebook-${v.quality || 'video'}.mp4` }))
    })
  },
  twitter: {
    name: 'Twitter / X', category: 'video', detect: /(^|[/.])(x|twitter)\.com/i,
    call: (api, { url }) => [api('/twitter', { url })],
    map: ([j]) => ({
      items: arr(j.data).map((v, i) => item({ kind: v.type === 'jpg' ? 'image' : 'video', label: `${v.type === 'jpg' ? 'Foto' : v.type === 'gif' ? 'GIF' : 'Video'} ${i + 1}`, url: v.url, filename: `twitter-${i + 1}.${v.type === 'jpg' ? 'jpg' : 'mp4'}` }))
    })
  },
  threads: {
    name: 'Threads', category: 'video', detect: /(^|[/.])threads\.(net|com)/i,
    call: (api, { url }) => [api('/threads', { url })],
    map: ([j]) => ({
      items: arr(j.data).map((v, i) => item({ kind: v.type === 'mp4' ? 'video' : 'image', label: `${v.type === 'mp4' ? 'Video' : 'Foto'} ${i + 1}`, url: v.url, filename: `threads-${i + 1}.${v.type === 'mp4' ? 'mp4' : 'jpg'}` }))
    })
  },
  capcut: {
    name: 'CapCut', category: 'video', detect: /(^|[/.])capcut\.com/i,
    call: (api, { url }) => [api('/capcut', { url })],
    map: ([j]) => ({ title: j.data?.caption, thumbnail: j.data?.thumbnail, items: clean([item({ kind: 'video', label: 'Video', url: j.data?.url, filename: 'capcut.mp4' })]) })
  },
  pinterest: {
    name: 'Pinterest', category: 'video', detect: /(^|[/.])(pinterest\.[a-z.]+|pin\.it)/i,
    call: (api, { url }) => [api('/pin', { url })],
    map: ([j]) => ({ items: arr(j.data).map((v, i) => item({ label: `Media ${i + 1}`, url: v.url, filename: `pinterest-${i + 1}` })) })
  },
  videy: {
    name: 'Videy', category: 'video', detect: /(^|[/.])videy\.co/i,
    call: (api, { url }) => [api('/videy', { url })],
    map: ([j]) => ({ items: clean([item({ kind: 'video', label: 'Video', url: j.data?.url, filename: 'videy.mp4' })]) })
  },
  snackvideo: {
    name: 'SnackVideo', category: 'video', detect: /(^|[/.])(snackvideo\.com|sck\.io|snackvideo\.in)/i,
    call: (api, { url }) => [api('/snackvid', { url })],
    map: ([j]) => ({ items: clean([item({ kind: 'video', label: 'Video', url: j.data?.url, filename: j.data?.filename || 'snackvideo.mp4' })]) })
  },
  ytpost: {
    name: 'YouTube Post', category: 'video', detect: /(^|[/.])youtube\.com\/(post|channel)/i, priority: 1,
    call: (api, { url }) => [api('/ytpost', { url })],
    map: ([j]) => ({
      title: j.data?.caption, author: j.data?.author?.name,
      items: arr(j.data?.medias).map((v, i) => item({ kind: 'image', label: `Media ${i + 1}`, url: v.url, filename: `ytpost-${i + 1}` }))
    })
  },
  youtube: {
    name: 'YouTube', category: 'video', detect: /(^|[/.])(youtube\.com|youtu\.be)/i,
    call: async (api, { url }) => {
      const video = api('/youtube', { url, type: 'video', quality: '720p' }).then(r => (r.status ? r : api('/youtube', { url, type: 'video', quality: '480p' })))
      const audio = api('/youtube', { url, type: 'audio', quality: '128kbps' })
      return Promise.allSettled([video, audio]).then(rs => rs.map(r => (r.status === 'fulfilled' ? r.value : { status: false })))
    },
    ok: rs => rs.some(r => r?.status),
    map: ([v, a]) => {
      const base = v?.status ? v : a
      return {
        title: base?.title, thumbnail: base?.thumbnail, meta: { Durasi: base?.duration },
        items: clean([
          v?.status && item({ kind: 'video', label: `MP4 ${v.data?.quality || ''}`.trim(), url: v.data?.url, filename: v.data?.filename || 'youtube.mp4', size: v.data?.size, referer: 'https://tomp3.cc/' }),
          a?.status && item({ kind: 'audio', label: `MP3 ${a.data?.quality || ''}`.trim(), url: a.data?.url, filename: a.data?.filename || 'youtube.mp3', size: a.data?.size, referer: 'https://tomp3.cc/' })
        ])
      }
    }
  },
  play: {
    name: 'YouTube (cari judul → MP3)', category: 'music', hidden: true,
    call: (api, { q }) => [api('/play', { q })],
    map: ([j]) => ({
      title: j.title, thumbnail: j.thumbnail, meta: { Durasi: j.duration },
      items: clean([item({ kind: 'audio', label: `MP3 ${j.data?.quality || ''}`.trim(), url: j.data?.url, filename: j.data?.filename || 'audio.mp3', size: j.data?.size, referer: 'https://tomp3.cc/' })])
    })
  },
  video: {
    name: 'YouTube (cari judul → MP4)', category: 'video', hidden: true,
    call: (api, { q }) => [api('/video', { q })],
    map: ([j]) => ({
      title: j.title, thumbnail: j.thumbnail, meta: { Durasi: j.duration },
      items: clean([item({ kind: 'video', label: `MP4 ${j.data?.quality || ''}`.trim(), url: j.data?.url, filename: j.data?.filename || 'video.mp4', size: j.data?.size, referer: 'https://tomp3.cc/' })])
    })
  },
  spotify: {
    name: 'Spotify', category: 'music', detect: /(^|[/.])open\.spotify\.com/i,
    call: (api, { url }) => [api('/spotify', { url })],
    map: ([j]) => ({
      title: j.data?.title, author: j.data?.artist?.name, thumbnail: j.data?.thumbnail, meta: { Durasi: j.data?.duration },
      items: clean([item({ kind: 'audio', label: 'MP3', url: j.data?.url, filename: `${j.data?.title || 'spotify'}.mp3` })])
    })
  },
  soundcloud: {
    name: 'SoundCloud', category: 'music', detect: /(^|[/.])soundcloud\.com/i,
    call: (api, { url }) => [api('/soundcloud', { url })],
    map: ([j]) => ({
      title: j.data?.title, author: j.data?.artist, thumbnail: j.data?.thumbnail,
      items: clean([item({ kind: 'audio', label: 'MP3', url: j.data?.url, filename: `${j.data?.title || 'soundcloud'}.mp3` })])
    })
  },
  applemusic: {
    name: 'Apple Music', category: 'music', detect: /(^|[/.])music\.apple\.com/i,
    call: (api, { url }) => [api('/applemusic', { url })],
    map: ([j]) => ({
      title: j.data?.title, author: j.data?.album, thumbnail: j.data?.thumbnail, meta: { Rilis: j.data?.published },
      items: clean([item({ kind: 'audio', label: 'Audio', url: j.data?.audio?.url, filename: j.data?.audio?.filename || 'applemusic.mp3' })])
    })
  },
  mediafire: {
    name: 'MediaFire', category: 'file', detect: /(^|[/.])mediafire\.com/i,
    call: (api, { url }) => [api('/mediafire', { url })],
    map: ([j]) => ({
      title: j.data?.title || j.data?.filename, meta: { Ukuran: j.data?.size, Ekstensi: j.data?.extension, Mime: j.data?.mime },
      items: clean([item({ kind: 'file', label: 'Download file', url: j.data?.url, filename: j.data?.filename || j.data?.title, size: j.data?.size })])
    })
  },
  gdrive: {
    name: 'Google Drive', category: 'file', detect: /(^|[/.])(drive|docs)\.google\.com/i,
    call: (api, { url }) => [api('/gdrive', { url })],
    map: ([j]) => ({ title: j.data?.filename, items: clean([item({ kind: 'file', label: 'Download file', url: j.data?.url, filename: j.data?.filename || 'gdrive-file' })]) })
  },
  terabox: {
    name: 'Terabox', category: 'file', detect: /(^|[/.])(tera(box|share)|1024tera|4funbox|mirrobox)[a-z.]*\//i,
    call: (api, { url }) => [api('/terabox', { url })],
    map: ([j]) => ({
      items: arr(j.data).map(v => item({ kind: 'file', label: v.server_filename || 'File', url: v.dlink, filename: v.server_filename, size: v.size }))
    })
  },
  pixeldrain: {
    name: 'Pixeldrain', category: 'file', detect: /(^|[/.])pixeldrain\.com/i,
    call: (api, { url }) => [api('/pixeldrain', { url })],
    map: ([j]) => ({ title: j.data?.filename, meta: { Ukuran: j.data?.size }, items: clean([item({ kind: 'file', label: 'Download file', url: j.data?.url, filename: j.data?.filename || 'pixeldrain', size: j.data?.size })]) })
  },
  sfile: {
    name: 'Sfile', category: 'file', detect: /(^|[/.])sfile\.mobi/i,
    call: (api, { url }) => [api('/sfile', { url })],
    map: ([j]) => ({ title: j.data?.filename, meta: { Ukuran: j.data?.size }, items: clean([item({ kind: 'file', label: 'Download file', url: j.data?.url, filename: j.data?.filename || 'sfile', size: j.data?.size })]) })
  },
  kraken: {
    name: 'KrakenFiles', category: 'file', detect: /(^|[/.])krakenfiles\.com/i,
    call: (api, { url }) => [api('/kraken', { url })],
    map: ([j]) => ({ title: j.data?.filename, meta: { Ukuran: j.data?.size }, items: clean([item({ kind: 'file', label: 'Download file', url: j.data?.url, filename: j.data?.filename || 'kraken', size: j.data?.size })]) })
  },
  apk: {
    name: 'APK (Play Store)', category: 'file', hidden: true,
    call: (api, { q, no }) => [api('/apk', { q, ...(no ? { no } : {}) })],
    map: ([j]) => ({
      title: j.data?.name, author: j.data?.developer, thumbnail: j.data?.thumbnail,
      meta: { Versi: j.data?.version, Rating: j.data?.rating, Kategori: j.data?.category, Update: j.data?.updated, Kebutuhan: j.data?.requirements },
      items: clean([item({ kind: 'file', label: 'Download APK', url: j.file?.url, filename: j.file?.filename || `${j.data?.name || 'app'}.apk`, size: j.file?.size })])
    })
  }
}

// Pencarian (list hasil → pilih salah satu → resolve)
export const SEARCHES = {
  play: { label: 'YouTube → MP3 (cari judul)', direct: 'play' },
  video: { label: 'YouTube → MP4 (cari judul)', direct: 'video' },
  spotify: {
    label: 'Spotify', endpoint: '/spotify-search',
    map: j => arr(j.data).map(v => ({ title: v.title, subtitle: [v.artist?.name || v.artist, v.duration].filter(Boolean).join(' • '), thumbnail: v.thumbnail, resolve: { service: 'spotify', url: v.url } }))
  },
  soundcloud: {
    label: 'SoundCloud', endpoint: '/soundcloud-search',
    map: j => arr(j.data).map(v => ({ title: v.title, subtitle: v.artist, thumbnail: v.thumbnail, resolve: { service: 'soundcloud', url: v.url } }))
  },
  applemusic: {
    label: 'Apple Music', endpoint: '/applemusic-search',
    map: j => arr(j.data).map(v => ({ title: v.title, subtitle: v.artist || v.album, thumbnail: v.thumbnail, resolve: { service: 'applemusic', url: v.url } }))
  },
  apk: {
    label: 'APK', endpoint: '/apk',
    map: (j, q) => arr(j.data).map((v, i) => ({ title: v.name, subtitle: [v.size, v.version && `v${v.version}`].filter(Boolean).join(' • '), thumbnail: v.thumbnail || v.icon, resolve: { service: 'apk', q, no: i + 1 } }))
  }
}

export function detectService(url) {
  try { const u = new URL(url); url = u.hostname + u.pathname } catch { return null }
  const hits = Object.entries(SERVICES).filter(([, s]) => s.detect && s.detect.test(url))
  hits.sort((a, b) => (b[1].priority || 0) - (a[1].priority || 0))
  return hits[0]?.[0] || null
}

// ---------- Neoxr client ----------
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
export function createApi({ base, fallback, key, fetchImpl = fetch, timeoutMs = 60000 }) {
  const bases = [base, fallback].filter(Boolean)
  return async function api(endpoint, params = {}) {
    if (!key || /^isi_apikey/i.test(key)) return { status: false, msg: 'API_KEY belum diisi. Isi di Vercel → Settings → Environment Variables, lalu redeploy.' }
    let last = { status: false, msg: 'Gagal menghubungi API' }
    for (const b of bases) {
      const u = new URL(b.replace(/\/$/, '') + endpoint)
      for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, v)
      u.searchParams.set('apikey', key)
      let res, text
      try {
        res = await fetchImpl(u, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: 'application/json', 'user-agent': UA } })
        text = await res.text()
      } catch (e) {
        console.error(`[neoxr] gagal konek ${u.origin}${u.pathname} :: ${e.name}: ${e.message}`)
        last = { status: false, msg: e.name === 'TimeoutError' ? 'API tidak merespons (timeout)' : 'Tidak bisa terhubung ke API' }
        continue
      }
      try { return JSON.parse(text) } catch {}
      // Bukan JSON: catat penyebabnya di log server (tanpa apikey), lalu coba base cadangan bila ada
      const type = (res.headers?.get?.('content-type') || '').split(';')[0].trim()
      console.error(`[neoxr] bukan JSON | HTTP ${res.status} | ${type || '-'} | ${u.origin}${u.pathname} | ${text.slice(0, 200).replace(/\s+/g, ' ')}`)
      const html = /html/i.test(type) || /^\s*<(!doctype|html)/i.test(text)
      last = { status: false, msg: `Respon API bukan JSON (HTTP ${res.status}${type ? `, ${type}` : ''}).${html ? ' API mengirim halaman HTML — biasanya NEOXR_BASE salah atau IP server diblokir.' : ''}` }
    }
    return last
  }
}

export async function resolve(api, service, params) {
  const svc = SERVICES[service]
  if (!svc) throw Object.assign(new Error('Layanan tidak dikenal'), { code: 400 })
  const raw = await svc.call(api, params)
  const rs = await Promise.all(await raw)
  const ok = svc.ok ? svc.ok(rs) : rs.every(r => r?.status)
  if (!ok) throw Object.assign(new Error(rs.find(r => r?.msg)?.msg || 'Gagal mengambil data dari API'), { code: 502 })
  const out = svc.map(rs)
  if (!out.items?.length) throw Object.assign(new Error('Tidak ada media yang bisa diunduh dari link ini'), { code: 404 })
  return { service, serviceName: svc.name, category: svc.category, title: str(out.title), author: str(out.author), thumbnail: str(out.thumbnail), meta: Object.fromEntries(Object.entries(out.meta || {}).filter(([, v]) => v)), items: out.items }
}

export async function search(api, type, q) {
  const s = SEARCHES[type]
  if (!s) throw Object.assign(new Error('Tipe pencarian tidak dikenal'), { code: 400 })
  if (s.direct) return { direct: { service: s.direct, q } }
  const j = await api(s.endpoint, { q })
  if (!j?.status) throw Object.assign(new Error(j?.msg || 'Pencarian gagal'), { code: 502 })
  return { results: s.map(j, q).slice(0, 15) }
}

// ---------- Link download bertanda tangan (agar /api/file bukan open proxy) ----------
export const sign = (secret, payload) => {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}
export const verify = (secret, token = '') => {
  const [body, sig] = String(token).split('.')
  if (!body || !sig) return null
  const exp = crypto.createHmac('sha256', secret).update(body).digest('base64url')
  const a = Buffer.from(sig), b = Buffer.from(exp)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString())
    return p.e > Date.now() ? p : null
  } catch { return null }
}
export const safeName = n => str(n).replace(/[\\/:*?"<>|\r\n]+/g, '_').slice(0, 150) || 'download'
