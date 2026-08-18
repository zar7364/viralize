<div align="left">


## Ujian Tengah Semester (UTS)
### Inovasi dan Entrepreneurship Kecerdasan Artifisial (IEKA)
**Merancang Solusi Agentic AI**

### Nezar Abdilah Prakasa (**563414**)
<br>

# Viralize

### Tren Jadi Hook, dari Hook Jadi Script Viral
**Platform Agentic AI untuk Pembuatan Script dan Manajemen Konten Kreator**
</div>


AI content orchestrator untuk TikTok/Reels/Shorts. 
Agent untuk membantu riset topik rending hook, script,dan scheduling:




 ## 1. Agent Hook (Trend Agent): riset tren dan keyword menghasilkan 10 kandidat topik.
  <img width="1357" height="923" alt="image" src="https://github.com/user-attachments/assets/ae2220cc-0347-4546-8693-3514cba418f6" />
  
 ## 2. Agent Director (Script Writer): menyusun outline script lengkap, catatan untuk bagian visual, dan caption dari topik yang dipilih.
  <img width="1458" height="406" alt="image" src="https://github.com/user-attachments/assets/5ea6608b-9def-44eb-9001-69d3fcc62e9f" />

  ## 3. Agent Scheduler: penjadwalan untuk post, opsional bisa schedule di app atau di Google Calendar.
  <img width="1373" height="494" alt="image" src="https://github.com/user-attachments/assets/f8bb82d0-c4d3-4841-aba6-e195cf21e8a9" />


# Go Live

<img width="1253" height="871" alt="image" src="https://github.com/user-attachments/assets/0940c939-de5e-4a1e-87b2-405c67970537" />
<img width="1805" height="595" alt="image" src="https://github.com/user-attachments/assets/d99d3fd6-6f03-4004-940f-43569897b07f" />
<img width="1350" height="825" alt="image" src="https://github.com/user-attachments/assets/5b66c6d9-440e-46f6-9f0f-8935c1580593" />

## Struktur folder

```
content-agent-uts/
  app.py              backend FastAPI, tiga agent jadi REST API
  main.py              definisi agent, konfigurasi model, dan guardrail app.py
  requirements.txt
  .env.example          bisa di copy paste jadi .env dan isi kode atau key asli
  Viralist/              frontend, React + Vite + TypeScript
    src/
    supabase/schema.sql
    .env.local.example    salin jadi .env.local dan isi dengan kode atau key asli
```

-Frontend
login dan data (brief, jadwal, profil user) lewat Supabase (Auth + Postgres).

-Backend 
FastAPI yang membungkus agent yang dibangun pakai **Agno**. 
Backend hanya memverifikasi token Supabase yang dikirim tiap request untuk akses

MCP (Model Context Protocol )

1. Firecrawl MCP (mcp.firecrawl.dev, streamable-http) untuk riset Agent Hook.
2. Google Calendar MCP (@cocal/google-calendar-mcp, dijalankan lokal lewat npx), saat ini mash dibatasi hanya pakai tool create-event dan delete-event untuk Agent Scheduler.

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

Database: buat project baru di Supabase, lalu jalankan seluruh isi `Viralist/supabase/schema.sql` di SQL editor-nya. 

## Deploy

Frontend sudah siap deploy ke Netlify (`Viralist/netlify.toml` sudah disediakan, build command `npm run build`, publish directory `dist`). 
Backend perlu di hosting terpisah karena running proses Python jangka panjang dan spawn subprocess npx.
