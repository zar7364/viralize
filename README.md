# Viralize

AI content orchestrator untuk TikTok/Reels/Shorts. Tiga agent berjalan berurutan untuk membantu riset topik, menulis naskah, sampai penjadwalan:

- Agent Hook (Trend Agent): riset tren dan keyword, hasilkan 10 kandidat topik dan 3 varian hook.
- Agent Director (Script Writer): susun outline naskah, script lengkap, catatan visual, dan caption dari topik yang dipilih.
- Agent Scheduler: jadwalkan publikasi, opsional langsung buat event asli di Google Calendar (khusus akun Agency).

<img width="1253" height="871" alt="image" src="https://github.com/user-attachments/assets/0940c939-de5e-4a1e-87b2-405c67970537" />
<img width="1805" height="595" alt="image" src="https://github.com/user-attachments/assets/d99d3fd6-6f03-4004-940f-43569897b07f" />
<img width="1350" height="825" alt="image" src="https://github.com/user-attachments/assets/5b66c6d9-440e-46f6-9f0f-8935c1580593" />

## Struktur folder

```
content-agent-uts/
  app.py              backend FastAPI, membungkus tiga agent di atas jadi REST API
  main.py              definisi agent, konfigurasi model, dan guardrail yang dipakai app.py
  requirements.txt
  .env.example          salin jadi .env, isi dengan nilai asli
  Viralist/              frontend, React + Vite + TypeScript
    src/
    supabase/schema.sql
    .env.local.example    salin jadi .env.local, isi dengan nilai asli
```

Frontend menangani login dan data (brief, jadwal, profil user) lewat Supabase (Auth + Postgres). Backend adalah FastAPI yang membungkus agent yang dibangun pakai Agno (https://github.com/agno-agi/agno). Backend hanya memverifikasi token Supabase yang dikirim tiap request sebagai gerbang akses, bukan pemilik proses login itu sendiri.

Ada dua MCP server yang dipakai backend:

- Firecrawl MCP (mcp.firecrawl.dev, streamable-http) untuk riset Agent Hook.
- Google Calendar MCP (@cocal/google-calendar-mcp, dijalankan lokal lewat npx), dibatasi cuma boleh pakai tool create-event dan delete-event untuk Agent Scheduler.

Satu hal yang perlu diketahui: otorisasi Google Calendar itu satu akun untuk semua user (dipegang oleh kredensial gcp-oauth-keys.json di server), bukan koneksi per-user. Semua event yang dibuat lewat aplikasi akan masuk ke Calendar akun yang sama, siapapun yang login.

Frontend dan backend di-deploy terpisah. Frontend bisa naik ke Netlify. Backend butuh hosting sendiri yang bisa menjalankan proses Python jangka panjang (VPS, Render, Railway, dan sejenisnya), karena Netlify cuma bisa melayani frontend statis.

## Setup

Backend:

```
cd content-agent-uts
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Isi `.env` dengan nilai asli. Letakkan juga `gcp-oauth-keys.json` (OAuth client tipe "Desktop app" dari Google Cloud Console) di root `content-agent-uts`. File ini sudah di-gitignore, tidak ikut ter-commit.

Jalankan dengan:

```
uvicorn app:app --reload --port 8001
```

Frontend:

```
cd content-agent-uts/Viralist
npm install
cp .env.local.example .env.local
npm run dev
```

Database: buat project baru di Supabase, lalu jalankan seluruh isi `Viralist/supabase/schema.sql` di SQL editor-nya. Google Sign-In juga perlu dikonfigurasi di Authentication > Providers > Google, pakai OAuth client tipe "Web application".

## Deploy

Frontend sudah siap deploy ke Netlify (`Viralist/netlify.toml` sudah disediakan, build command `npm run build`, publish directory `dist`). Backend perlu di-hosting terpisah karena menjalankan proses Python jangka panjang dan spawn subprocess npx.
