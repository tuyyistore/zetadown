const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const safeStore = { get: k => { try { return localStorage.getItem(k) } catch { return null } }, set: (k, v) => { try { localStorage.setItem(k, v) } catch {} } }

/* ---------- preloader ---------- */
{
  let p = 0
  const bar = $('#preBar'), pre = $('#preloader')
  document.body.style.overflow = 'hidden'
  const t = setInterval(() => {
    p = Math.min(p + Math.floor(Math.random() * 12) + 4, 100); bar.style.width = p + '%'
    if (p >= 100) { clearInterval(t); setTimeout(() => { pre.classList.add('hide'); document.body.style.overflow = ''; setTimeout(() => pre.remove(), 550) }, 200) }
  }, 50)
}

/* ---------- tema (dark/light seperti aslinya: body.light-mode) ---------- */
const themeSw = $('#themeSwitch'), themeLabel = $('#themeLabel')
const applyTheme = t => { document.body.classList.toggle('light-mode', t === 'light'); themeSw.checked = t === 'dark'; themeLabel.textContent = t === 'dark' ? 'Dark' : 'Light' }
applyTheme(safeStore.get('theme') || 'dark')
themeSw.addEventListener('change', () => { const t = themeSw.checked ? 'dark' : 'light'; safeStore.set('theme', t); applyTheme(t) })

/* ---------- navbar & sidebar ---------- */
const nav = $('#mainNavbar')
const onScroll = () => nav.classList.toggle('scrolled', scrollY > 10)
addEventListener('scroll', onScroll, { passive: true }); onScroll()

const sidebar = $('#mobileSidebar'), overlay = $('#overlay')
let off = null
const setMenu = open => {
  overlay.hidden = !open
  if (!off && window.bootstrap) off = new bootstrap.Offcanvas(sidebar, { backdrop: false, keyboard: true })
  if (off) open ? off.show() : off.hide()
}
$('#menuBtn').onclick = () => setMenu(overlay.hidden)
$('#closeMenu').onclick = overlay.onclick = () => setMenu(false)
$('#fsBtn').onclick = () => { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.() }
document.addEventListener('fullscreenchange', () => { $('#fsBtn i').className = document.fullscreenElement ? 'bi bi-fullscreen-exit' : 'bi bi-fullscreen' })

$$('[data-anchor]').forEach(a => a.addEventListener('click', e => {
  e.preventDefault(); setMenu(false)
  document.getElementById(a.dataset.anchor)?.scrollIntoView({ behavior: 'smooth' })
}))
const ids = ['download', 'features', 'faq']
const spy = () => {
  let cur = ids[0]; for (const id of ids) { const el = document.getElementById(id); if (el && !el.hidden && el.getBoundingClientRect().top < 140) cur = id }
  $$('[data-anchor]').forEach(a => a.classList.toggle('router-link-exact-active', a.dataset.anchor === cur))
}
addEventListener('scroll', spy, { passive: true }); spy()

/* ---------- FAQ (accordion gaya asli) ---------- */
const faq = [
  ['Platform apa saja yang didukung?', 'TikTok, Douyin, Instagram, Facebook, Twitter/X, Threads, CapCut, Pinterest, YouTube, Spotify, SoundCloud, Apple Music, MediaFire, Google Drive, Terabox, Pixeldrain, Sfile, KrakenFiles, Videy dan SnackVideo.'],
  ['Bagaimana cara download?', 'Tempel link di kolom, lalu tekan tombol panah. Platform dikenali otomatis. Pilih format/kualitas yang muncul lalu tekan <strong>Download</strong>.'],
  ['Bagaimana kalau hanya tahu judulnya?', 'Pindah ke tab <strong>Cari judul</strong>, pilih sumber (YouTube, Spotify, SoundCloud, Apple Music, atau APK), lalu ketik judulnya.'],
  ['Download gagal atau link tidak jalan?', 'Pastikan link publik (bukan akun private) dan masih aktif. Link hasil download berlaku sekitar 30 menit — ulangi prosesnya bila kedaluwarsa.'],
  ['Apakah legal?', 'Gunakan hanya untuk konten milikmu atau yang kamu punya izin untuk mengunduhnya. Hormati hak cipta pembuat konten.']
]
$('#faqAccordion').innerHTML = faq.map(([q, a], i) => `
  <div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button collapsed" type="button" data-i="${i}" aria-expanded="false">${q}</button></h2>
  <div class="accordion-collapse" style="height:0;overflow:hidden;transition:height .25s ease"><div class="accordion-body">${a}</div></div></div>`).join('')
$$('#faqAccordion .accordion-button').forEach(b => b.onclick = () => {
  const open = b.classList.contains('collapsed')
  $$('#faqAccordion .accordion-button').forEach(x => { x.classList.add('collapsed'); x.nextElementSibling; x.closest('.accordion-item').querySelector('.accordion-collapse').style.height = '0' })
  if (open) { b.classList.remove('collapsed'); const c = b.closest('.accordion-item').querySelector('.accordion-collapse'); c.style.height = c.scrollHeight + 'px' }
})
$('#year').textContent = new Date().getFullYear()

/* ---------- downloader ---------- */
const form = $('#form'), input = $('#input'), typeSel = $('#type'), go = $('#go'), statusEl = $('#status'), results = $('#results'), hint = $('#hint')
let mode = 'link'

const setStatus = (html, cls) => { statusEl.innerHTML = html ? (cls ? `<div class="alert alert-${cls} mt-3">${html}</div>` : html) : '' }
const loading = () => { go.disabled = true; results.innerHTML = ''; setStatus('<div class="content-card rounded-3 p-4 text-center mt-3"><div class="line-loader-wrapper"><div class="line-loader"></div></div><p class="mb-0 text-secondary">Mengambil data… (bisa 10–30 detik)</p></div>') }
const done = () => { go.disabled = false }

async function call(path) {
  const r = await fetch(path)
  const j = await r.json().catch(() => ({ status: false, msg: 'Respon server tidak valid' }))
  if (!j.status) throw new Error(j.msg || 'Gagal')
  return j
}

fetch('/api/services').then(r => r.json()).then(j => {
  $('#count').textContent = j.services.length
  const names = { video: [], music: [], file: [] }
  j.services.forEach(s => (names[s.category] || names.video).push(s.name))
  $$('[data-cat]').forEach(el => { el.innerHTML = (names[el.dataset.cat] || []).map(n => `<span class="platform-pill">${esc(n)}</span>`).join('') })
  typeSel.innerHTML = j.searches.map(s => `<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('')
}).catch(() => {})

$$('.dl-tab').forEach(b => b.onclick = () => {
  mode = b.dataset.mode
  $$('.dl-tab').forEach(x => x.classList.toggle('active', x === b))
  typeSel.hidden = mode !== 'search'
  input.placeholder = mode === 'link' ? 'https://vm.tiktok.com/...' : 'Judul lagu / video / aplikasi'
  input.inputMode = mode === 'link' ? 'url' : 'text'
  $('#inputIcon').className = mode === 'link' ? 'bi bi-link-45deg search-icon' : 'bi bi-search search-icon'
  hint.textContent = ''; setStatus(''); results.innerHTML = ''; input.focus()
})
input.addEventListener('input', () => {
  if (mode !== 'link') return
  const v = input.value.trim()
  hint.textContent = v && !/^https?:\/\//i.test(v) ? 'Link harus diawali https://' : ''
})

/* tombol hapus (x): muncul hanya jika kolom ada isinya */
const clearBtn = $('#clear')
const syncClear = () => { const has = input.value.length > 0; clearBtn.hidden = !has; form.classList.toggle('has-text', has) }
input.addEventListener('input', syncClear)
clearBtn.onclick = () => { input.value = ''; hint.textContent = ''; syncClear(); input.focus() }
syncClear()

form.addEventListener('submit', async e => {
  e.preventDefault()
  const v = input.value.trim(); if (!v) return
  input.blur() // tutup keyboard HP supaya layout tidak loncat
  loading()
  try {
    if (mode === 'link') return showResult(await call(`/api/resolve?url=${encodeURIComponent(v)}`))
    const s = await call(`/api/search?type=${encodeURIComponent(typeSel.value)}&q=${encodeURIComponent(v)}`)
    if (s.direct) return showResult(await call(`/api/resolve?service=${encodeURIComponent(s.direct.service)}&q=${encodeURIComponent(s.direct.q)}`))
    showList(s.results)
  } catch (err) { results.innerHTML = ''; setStatus(`<i class="bi bi-exclamation-triangle-fill me-2"></i>${esc(err.message)}`, 'danger') } finally { done() }
})

function showList(list) {
  if (!list.length) return setStatus('Tidak ada hasil.', 'warning')
  setStatus('')
  results.innerHTML = `<div class="content-card rounded-3 p-3 mt-3"><div class="d-flex flex-column gap-2">${list.map((r, i) => `
    <div class="song-card" data-i="${i}">
      <div class="thumbnail-wrapper">${r.thumbnail ? `<img class="song-thumbnail" src="${esc(r.thumbnail)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : '<i class="bi bi-music-note-beamed"></i>'}</div>
      <div class="song-info"><p class="song-title">${esc(r.title)}</p><div class="song-meta"><span>${esc(r.subtitle)}</span></div></div>
      <button class="btn btn-custom-accent btn-sm" type="button">Ambil</button>
    </div>`).join('')}</div></div>`
  $$('.song-card').forEach(c => c.onclick = async () => {
    const p = list[c.dataset.i].resolve
    loading()
    try { showResult(await call('/api/resolve?' + new URLSearchParams(Object.entries(p).filter(([, x]) => x != null)))) }
    catch (err) { results.innerHTML = ''; setStatus(`<i class="bi bi-exclamation-triangle-fill me-2"></i>${esc(err.message)}`, 'danger') } finally { done() }
  })
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true } catch {}
  try { // cadangan untuk browser/webview yang menolak Clipboard API
    const ta = document.createElement('textarea')
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy'); ta.remove(); return ok
  } catch { return false }
}

/* ---------- statistik: 2 garis (pengguna & download sukses) + angka total ---------- */
const nf = new Intl.NumberFormat('id-ID')
const dfShort = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const dfLong = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const utc = d => new Date(d + 'T00:00:00Z')
const compact = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 })
let statData = null

function drawChart(s) {
  const box = $('#statChart'), readout = $('#statReadout')
  const W = Math.max(box.clientWidth, 240), H = W < 420 ? 180 : 220
  const m = { l: 40, r: 14, t: 12, b: 24 }
  const pw = W - m.l - m.r, ph = H - m.t - m.b
  const ser = s.series, n = ser.length
  const maxV = Math.max(1, ...ser.map(d => Math.max(d.users, d.downloads)))
  // sumbu Y: 4 garis bantu dengan angka bulat
  const raw = maxV / 4, pow = 10 ** Math.floor(Math.log10(raw)), f = raw / pow
  const step = Math.max(1, (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow), top = step * 4 // langkah "bulat": 1, 2, 5 × 10^n
  const x = i => m.l + (n === 1 ? pw / 2 : (i / (n - 1)) * pw)
  const y = v => m.t + ph - (v / top) * ph
  const line = key => ser.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join('')
  const grid = [0, 1, 2, 3, 4].map(k => `<line class="sgrid" x1="${m.l}" x2="${W - m.r}" y1="${y(k * step)}" y2="${y(k * step)}"/><text class="stick" x="${m.l - 6}" y="${y(k * step) + 3.5}" text-anchor="end">${compact.format(k * step)}</text>`).join('')
  const xi = [0, Math.round((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i)
  const xl = xi.map(i => `<text class="stick" x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">${dfShort.format(utc(ser[i].date))}</text>`).join('')
  const last = ser[n - 1]
  box.innerHTML = `<svg class="schart" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Grafik pengguna dan download sukses ${n} hari terakhir">
    ${grid}${xl}
    <path class="sline d" d="${line('downloads')}"/><path class="sline u" d="${line('users')}"/>
    <circle class="sdot d" cx="${x(n - 1)}" cy="${y(last.downloads)}" r="4"/><circle class="sdot u" cx="${x(n - 1)}" cy="${y(last.users)}" r="4"/>
    <g id="sHover" visibility="hidden"><line class="sguide" y1="${m.t}" y2="${m.t + ph}"/><circle class="sdot d" r="4"/><circle class="sdot u" r="4"/></g>
    <rect id="sHit" x="${m.l}" y="${m.t}" width="${pw}" height="${ph}" fill="transparent"/>
  </svg>`
  const hov = $('#sHover'), [dotD, dotU] = hov.querySelectorAll('circle'), guide = hov.querySelector('line')
  const idle = () => { hov.setAttribute('visibility', 'hidden'); readout.innerHTML = `${esc(dfShort.format(utc(last.date)))} (hari ini): <b>${nf.format(last.users)}</b> pengguna · <b>${nf.format(last.downloads)}</b> download sukses` }
  const point = e => {
    const r = $('#sHit').getBoundingClientRect()
    const i = Math.min(n - 1, Math.max(0, Math.round(((e.clientX - r.left) / r.width) * (n - 1))))
    const d = ser[i]
    hov.setAttribute('visibility', 'visible'); guide.setAttribute('x1', x(i)); guide.setAttribute('x2', x(i))
    dotU.setAttribute('cx', x(i)); dotU.setAttribute('cy', y(d.users)); dotD.setAttribute('cx', x(i)); dotD.setAttribute('cy', y(d.downloads))
    readout.innerHTML = `${esc(dfShort.format(utc(d.date)))}: <b>${nf.format(d.users)}</b> pengguna · <b>${nf.format(d.downloads)}</b> download sukses`
  }
  const hit = $('#sHit')
  hit.addEventListener('pointermove', point); hit.addEventListener('pointerdown', point)
  hit.addEventListener('pointerleave', idle); hit.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') setTimeout(idle, 1800) })
  idle()
}

function renderStats(s) {
  statData = s
  $('#statUsers').textContent = nf.format(s.users)
  $('#statDl').textContent = nf.format(s.downloads)
  $('#statNote').innerHTML = `${s.since ? `Dihitung sejak ${esc(dfLong.format(utc(s.since)))} · ` : ''}Garis menunjukkan total ${s.series.length} hari terakhir.`
    + (s.persistent ? '' : '<span class="stat-warn">Data masih disimpan di memori server dan akan hilang saat server restart. Hubungkan Upstash Redis agar statistik permanen.</span>')
  $('#stats').hidden = false // tampil dulu agar lebar kotak grafik terukur
  drawChart(s)
}
async function loadStats() {
  try { const j = await (await fetch('/api/stats')).json(); if (j.status) renderStats(j) } catch {}
}
loadStats()
{ let w = 0; addEventListener('resize', () => { const el = $('#statChart'); if (statData && el.clientWidth !== w) { w = el.clientWidth; drawChart(statData) } }, { passive: true }) }

const ICON = { video: 'bi-film', audio: 'bi-music-note-beamed', image: 'bi-image', file: 'bi-file-earmark-arrow-down' }

function showResult({ data: d }) {
  setStatus('')
  const meta = Object.entries(d.meta || {}).map(([k, v]) => `<span>${esc(k)}: ${esc(v)}</span>`).join('')
  results.innerHTML = `<div class="content-card result-card rounded-3 p-4 mt-3"><div class="row g-3">
    ${d.thumbnail ? `<div class="col-5 col-sm-4 col-md-3 mx-auto"><img class="cover" src="${esc(d.thumbnail)}" alt="" referrerpolicy="no-referrer" onerror="this.closest('.col-5').remove()"></div>` : ''}
    <div class="col">
      <span class="hero-tagline badge rounded-pill mb-2">${esc(d.serviceName)}</span>
      <div class="result-title">${esc(d.title || 'Hasil download')}</div>
      ${d.author ? `<div class="text-secondary mb-2">${esc(d.author)}</div>` : ''}
      ${d.title ? `<button class="btn btn-ghost btn-sm-custom btn-copy" type="button" data-copy><i class="bi bi-clipboard me-1"></i><span>Salin deskripsi</span></button>` : ''}
      ${meta ? `<div class="result-meta">${meta}</div>` : ''}
      <div class="d-flex flex-column gap-2">${d.items.map((it, i) => `
        <div><div class="file-row"><i class="bi ${ICON[it.kind] || ICON.file}"></i>
          <div class="lbl">${esc(it.label)}${it.size ? `<small>${esc(it.size)}</small>` : ''}</div>
          ${['video', 'audio', 'image'].includes(it.kind) ? `<button class="btn btn-ghost btn-sm-custom" type="button" data-p="${i}">${it.kind === 'image' ? 'Lihat' : 'Putar'}</button>` : ''}
          <a class="btn btn-custom-accent btn-sm-custom" href="${esc(it.download)}" download="${esc(it.filename)}"><i class="bi bi-download me-1"></i>Download</a>
        </div><div data-slot="${i}"></div></div>`).join('')}</div>
    </div></div></div>`
  $$('button[data-p]').forEach(b => b.onclick = () => {
    const it = d.items[b.dataset.p], slot = results.querySelector(`[data-slot="${b.dataset.p}"]`)
    if (slot.firstChild) { slot.innerHTML = ''; return }
    slot.innerHTML = it.kind === 'video' ? `<video class="player" controls autoplay playsinline src="${esc(it.preview)}"></video>`
      : it.kind === 'audio' ? `<audio class="player" controls autoplay src="${esc(it.preview)}"></audio>`
      : `<img class="player" style="object-fit:contain" src="${esc(it.preview)}" alt="">`
  })
  const cb = results.querySelector('[data-copy]')
  if (cb) cb.onclick = async () => {
    const ok = await copyText(d.title), lbl = cb.querySelector('span'), ic = cb.querySelector('i')
    lbl.textContent = ok ? 'Tersalin!' : 'Gagal menyalin'
    ic.className = (ok ? 'bi bi-clipboard-check' : 'bi bi-clipboard-x') + ' me-1'
    cb.classList.toggle('copied', ok)
    clearTimeout(cb._t)
    cb._t = setTimeout(() => { lbl.textContent = 'Salin deskripsi'; ic.className = 'bi bi-clipboard me-1'; cb.classList.remove('copied') }, 1800)
  }
  $$('#results a[download]').forEach(x => x.addEventListener('click', () => setTimeout(loadStats, 6000)))
  loadStats()
  results.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
