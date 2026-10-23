# Zeta Download

Website downloader (video, musik, foto, file) yang memakai Neoxr API — logika & endpoint diambil dari kategori `download` bot Vestia.
Tanpa dependensi npm, cukup Node >= 18.

## Jalankan
```bash
cp .env.example .env     # isi API_KEY dan SIGN_SECRET
node src/zeta.js           # http://localhost:3000
node test/run.js         # tes (pakai API tiruan, tidak memakai kuota)
```
pm2: `pm2 start src/zeta.js --name zeta-download`

## Deploy ke Vercel
1. Push folder ini ke GitHub → Vercel → *Add New Project* → import (Framework: Other, tanpa build command).
2. *Settings → Environment Variables*: `API_KEY`, `SIGN_SECRET`, `NEOXR_BASE` (opsional).
3. Deploy. `public/` jadi file statis, `api/[...path].js` jadi serverless function (maxDuration 60 dtk di `vercel.json`).
CLI: `npx vercel --prod`.

Perbedaan di Vercel: unduhan memakai mode `redirect` (302 langsung ke server sumber) karena function tidak cocok untuk stream file besar. Akibatnya nama file bergantung sumber, dan sumber yang butuh Referer (YouTube/tomp3) bisa menolak — di VPS mode `proxy` menangani itu. Rate limit tersimpan di memori per instance, jadi hanya perlindungan kasar di serverless.

## Cara kerja
- Browser → `GET /api/resolve?url=…` → server memanggil `NEOXR_BASE/<endpoint>?…&apikey=…` → hasil dinormalisasi.
- API key hanya ada di server. Link sumber tidak dikirim ke browser; browser menerima link `/api/file?t=…` (bertanda tangan HMAC, berlaku 30 menit) yang di-stream lewat server (mendukung Range untuk preview).
- Rate limit per IP (`RATE_LIMIT`/menit). Di belakang nginx/Cloudflare isi `TRUST_PROXY=1`.

## Endpoint
| Route | Fungsi |
|---|---|
| `/api/services` | daftar platform & tipe pencarian |
| `/api/resolve?url=` | auto-detect platform dari link |
| `/api/resolve?service=play&q=` | cari judul → MP3 (`video` → MP4) |
| `/api/search?type=spotify\|soundcloud\|applemusic\|apk&q=` | daftar hasil; pilih → `/api/resolve?service=…` |
| `/api/file?t=` | stream/unduh file |

## Menambah platform
Tambah entri di `SERVICES` pada `src/core.js` (`detect`, `call`, `map`).

## Catatan
- Bot memakai base `https://api.neoxr.my.id/api`; default di sini `https://api.neoxr.eu/api`. Ubah lewat `NEOXR_BASE` bila path-nya beda.
- Field respons mengikuti yang dipakai plugin bot; belum diuji ke API asli (sandbox tidak bisa akses neoxr).

## Troubleshooting
- **"Respon API bukan JSON (HTTP 200)"** — API membalas halaman HTML, bukan JSON. Penyebab umum: `NEOXR_BASE` salah, IP server (Vercel) diblokir/ditantang Cloudflare, atau `API_KEY` salah. Cek **Vercel → Deployments → Functions/Logs**, baris `[neoxr] bukan JSON | HTTP … | content-type | host/path | cuplikan isi` menunjukkan isi balasan sebenarnya (apikey tidak ikut dicatat). Server otomatis mencoba `NEOXR_FALLBACK` (default `api.neoxr.my.id`) bila base utama gagal.
- **"API_KEY belum diisi"** — isi `API_KEY` di *Settings → Environment Variables* lalu **redeploy** (perubahan env tidak berlaku ke deployment lama).
