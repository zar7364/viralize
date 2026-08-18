from __future__ import annotations
from agno.agent import Agent
from agno.tools.mcp import MCPTools
import os
import re
import json
import secrets
import platform
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, AsyncIterator
from urllib.parse import urlencode

import httpx
from dotenv import load_dotenv

load_dotenv()

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, StreamingResponse
from pydantic import BaseModel, Field

# Reuse guardrails & model config yang sudah ada di main.py, bukan duplikasi.
from main import get_model, validasi_konten_topik, validasi_jam, validasi_pilihan_topik

BASE_DIR = Path(__file__).resolve().parent

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "").strip()
ALLOWED_EMAILS = {
    e.strip().lower() for e in os.getenv("ALLOWED_EMAILS", "").split(",") if e.strip()
}
FRONTEND_ORIGINS = [
    o.strip()
    for o in os.getenv("FRONTEND_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if o.strip()
]
# "*" (mis. untuk demo/presentasi, karena origin Netlify-nya bisa berubah-ubah
# tergantung nama site) berarti izinkan semua origin. Aman dipakai bareng
# allow_credentials=False di bawah (auth pakai Bearer token, bukan cookie).
ALLOW_ALL_ORIGINS = FRONTEND_ORIGINS == ["*"]

# --- Google Calendar per-user (OAuth "Web application" client) ---
GOOGLE_CALENDAR_OAUTH_CLIENT_ID = os.getenv("GOOGLE_CALENDAR_OAUTH_CLIENT_ID", "").strip()
GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET = os.getenv("GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET", "").strip()
GOOGLE_CALENDAR_OAUTH_REDIRECT_URI = os.getenv("GOOGLE_CALENDAR_OAUTH_REDIRECT_URI", "").strip()
GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events"
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").strip().rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()

# --- Voucher promo: upgrade instan ke Agency 1 bulan, dibatasi jumlah
# penukaran totalnya (bukan per user - begitu kuotanya habis, sudah habis
# untuk semua orang). Dicek/dicatat di tabel voucher_redemptions.
VOUCHER_CODE = "GOMKA"
VOUCHER_MAX_REDEMPTIONS = 10

# State per-user (topics, chosen topic, script, jadwal pending) disimpan di
# memori server, diindeks oleh user id dari Supabase (bukan cookie session -
# frontend memanggil API ini dengan Bearer token, bukan cookie).
SESSION_STATE: dict[str, dict[str, Any]] = {}

# Menghubungkan state OAuth (dikirim balik oleh Google saat redirect ke
# /api/calendar/oauth/callback, request browser biasa tanpa Bearer token)
# ke user id yang memintanya - short-lived, cukup di memori.
OAUTH_STATE_MAP: dict[str, str] = {}


def get_state(user_id: str) -> dict[str, Any]:
    return SESSION_STATE.setdefault(user_id, {})


async def require_supabase_user(request: Request) -> dict[str, str]:
    """Verifikasi access token Supabase lalu cek whitelist ALLOWED_EMAILS.

    Ini gerbang akses (siapa boleh pakai aplikasi), bukan otorisasi Calendar.
    """
    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        raise HTTPException(401, "Belum login. Sertakan Supabase access token di header Authorization.")
    token = auth_header.split(" ", 1)[1].strip()

    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(500, "SUPABASE_URL / SUPABASE_ANON_KEY belum dikonfigurasi di .env server.")

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_ANON_KEY},
            )
        except httpx.HTTPError as e:
            raise HTTPException(502, f"Gagal menghubungi Supabase untuk verifikasi login: {e}")

    if resp.status_code != 200:
        raise HTTPException(401, "Token tidak valid atau sudah kedaluwarsa. Silakan login ulang.")

    data = resp.json()
    email = (data.get("email") or "").strip().lower()
    user_id = data.get("id")
    if not email or not user_id:
        raise HTTPException(401, "Gagal membaca info user dari Supabase.")
    # ALLOWED_EMAILS kosong (mis. untuk demo/presentasi) berarti semua akun
    # yang berhasil login lewat Supabase diizinkan. Isi lagi env var ini
    # dengan daftar email untuk mengaktifkan whitelist seperti biasa.
    if ALLOWED_EMAILS and email not in ALLOWED_EMAILS:
        raise HTTPException(403, "Email ini tidak diizinkan mengakses aplikasi.")

    return {"id": user_id, "email": email}


def parse_topics(text: str) -> dict[int, str]:
    """Parse baris '1. judul topik' / '1) judul topik' jadi {nomor: judul}."""
    topics: dict[int, str] = {}
    for line in text.splitlines():
        m = re.match(r"^\s*(\d{1,2})[.)]\s*(.+?)\s*$", line)
        if m:
            n = int(m.group(1))
            if 1 <= n <= 10:
                topics[n] = m.group(2).strip()
    return topics


async def connect_once(mcp: MCPTools, label: str) -> bool:
    """MCPTools.connect() menelan exception-nya sendiri (cuma log_error,
    tidak raise), jadi status koneksi dicek lewat properti .initialized.

    Sengaja TIDAK retry di sini: memanggil connect() lagi pada instance yang
    sama setelah percobaan pertama gagal membuat anyio task group/cancel
    scope milik MCP jadi tidak konsisten di Windows (crash saat startup).
    Kalau gagal, endpoint yang butuh tool ini akan balas 503 apa adanya."""
    try:
        await mcp.connect()
    except Exception as e:
        print(f"[WARN] {label} MCP gagal connect: {type(e).__name__}: {e}")
    return mcp.initialized


def sse_event(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


async def run_agent_streamed(agent: Agent, prompt: str, lock: asyncio.Lock) -> AsyncIterator[str]:
    """Jalankan agent dengan stream_events=True dan pancarkan progres asli
    (tool call, isi jawaban yang lagi diketik) sebagai SSE - ini yang biasanya
    muncul di terminal saat agent jalan, bukan teks simulasi di frontend."""
    final_content = None
    tools_called: list[str] = []
    async with lock:
        async for event in agent.arun(prompt, stream=True, stream_events=True):
            cls = type(event).__name__
            if cls == "ToolCallStartedEvent" and getattr(event, "tool", None):
                args = event.tool.tool_args or {}
                args_str = ", ".join(f"{k}={v}" for k, v in args.items())
                tools_called.append(event.tool.tool_name)
                yield sse_event({"type": "tool_call_started", "text": f"{event.tool.tool_name}({args_str})"})
            elif cls == "ToolCallCompletedEvent":
                tool = getattr(event, "tool", None)
                text = event.content or (f"{tool.tool_name} selesai." if tool else "Tool selesai.")
                # tool_name/tool_result disertakan untuk dipakai route (misalnya
                # ekstrak event id asli dari hasil create-event) - bukan untuk
                # ditampilkan apa adanya di frontend.
                yield sse_event({
                    "type": "tool_call_completed",
                    "text": text,
                    "tool_name": tool.tool_name if tool else None,
                    "tool_result": tool.result if tool else None,
                })
            elif cls == "RunContentEvent" and event.content:
                yield sse_event({"type": "content_delta", "text": event.content})
            elif cls == "RunCompletedEvent":
                final_content = event.content
            elif cls == "RunErrorEvent":
                yield sse_event({"type": "error", "text": event.content or "Agent mengalami error."})
                return
    # Sentinel internal - ditangkap & dilepas oleh route, tidak diteruskan apa
    # adanya ke frontend (route yang menentukan format 'done' final).
    yield sse_event({"type": "_final", "text": final_content, "tools_called": tools_called})


def extract_hook(script: str) -> str:
    """Ambil baris HOOK dari full script (format main.py: '[0-3 detik] HOOK: ...')."""
    for line in script.splitlines():
        m = re.search(r"HOOK\s*[:\-]?\s*(.+)", line, re.IGNORECASE)
        if m:
            return m.group(1).strip()
    for line in script.splitlines():
        if line.strip():
            return line.strip()
    return ""


def extract_event_from_tool_result(tool_result: str | None) -> tuple[str | None, str | None]:
    """Parse hasil mentah tool 'create-event' (JSON, format {"event": {"id":
    ..., "htmlLink": ...}}) jadi (event_id, event_link). Ini data asli dari
    Google Calendar API, bukan hasil parafrase teks dari model."""
    if not tool_result:
        return None, None
    try:
        parsed = json.loads(tool_result)
    except (TypeError, ValueError):
        return None, None
    ev = parsed.get("event", parsed) if isinstance(parsed, dict) else {}
    if not isinstance(ev, dict):
        return None, None
    return ev.get("id"), ev.get("htmlLink")


def require_service_role() -> None:
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(500, "SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di .env server.")


async def get_calendar_connection(user_id: str) -> dict | None:
    """Baca koneksi Calendar milik user (kalau ada) lewat service_role key -
    tabel ini tidak punya RLS policy sama sekali, jadi cuma bisa diakses
    dari sini, bukan langsung dari frontend."""
    require_service_role()
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/google_calendar_connections",
            headers={
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            },
            params={"user_id": f"eq.{user_id}", "select": "refresh_token,connected_email"},
        )
        resp.raise_for_status()
        rows = resp.json()
        return rows[0] if rows else None


async def save_calendar_connection(user_id: str, refresh_token: str, connected_email: str | None) -> None:
    require_service_role()
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{SUPABASE_URL}/rest/v1/google_calendar_connections?on_conflict=user_id",
            headers={
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates,return=minimal",
            },
            json={"user_id": user_id, "refresh_token": refresh_token, "connected_email": connected_email},
        )
        resp.raise_for_status()


async def delete_calendar_connection(user_id: str) -> None:
    require_service_role()
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.delete(
            f"{SUPABASE_URL}/rest/v1/google_calendar_connections",
            headers={
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            },
            params={"user_id": f"eq.{user_id}"},
        )
        resp.raise_for_status()


async def get_fresh_access_token(refresh_token: str) -> str:
    """Tukar refresh_token yang tersimpan jadi access_token baru (berumur
    pendek) tiap kali mau panggil Google Calendar API - refresh_token sendiri
    tidak pernah dipakai langsung ke Calendar API."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "refresh_token": refresh_token,
                "client_id": GOOGLE_CALENDAR_OAUTH_CLIENT_ID,
                "client_secret": GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET,
                "grant_type": "refresh_token",
            },
        )
    if resp.status_code != 200:
        raise HTTPException(502, "Gagal refresh token Google Calendar. Coba connect ulang lewat Settings.")
    return resp.json()["access_token"]


async def has_redeemed_voucher(user_id: str, code: str) -> bool:
    require_service_role()
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/voucher_redemptions",
            headers={"apikey": SUPABASE_SERVICE_ROLE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"},
            params={"user_id": f"eq.{user_id}", "code": f"eq.{code}", "select": "id"},
        )
        resp.raise_for_status()
        return len(resp.json()) > 0


async def count_voucher_redemptions(code: str) -> int:
    require_service_role()
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/voucher_redemptions",
            headers={
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "Prefer": "count=exact",
            },
            params={"code": f"eq.{code}", "select": "id"},
        )
        resp.raise_for_status()
        content_range = resp.headers.get("content-range", "")
        if "/" in content_range:
            total = content_range.rsplit("/", 1)[-1]
            if total.isdigit():
                return int(total)
        return len(resp.json())


@asynccontextmanager
async def lifespan(app: FastAPI):
    firecrawl_key = os.getenv("FIRECRAWL_API_KEY")
    firecrawl_mcp = MCPTools(
        transport="streamable-http",
        url=f"https://mcp.firecrawl.dev/{firecrawl_key}/v2/mcp",
        # Sama seperti gcal_mcp di bawah - default 10s kadang kurang di
        # lingkungan ini.
        timeout_seconds=30,
    )
    firecrawl_ok = await connect_once(firecrawl_mcp, "Firecrawl")
    if not firecrawl_ok:
        print("[WARN] Firecrawl MCP tidak berhasil initialize.")

    npx_command = "npx.cmd" if platform.system() == "Windows" else "npx"
    gcal_credentials_path = str(BASE_DIR / "gcp-oauth-keys.json")

    # ============================================================
    # GUARDRAIL: Pembatasan scope tool di level kode. Scheduler HANYA
    # diizinkan memanggil 'create-event' dan 'delete-event' - tidak ada
    # tool lain (list-events, update-event, dll) yang di-expose ke agent,
    # meskipun tersedia di MCP server.
    # ============================================================
    gcal_mcp = MCPTools(
        command=f"{npx_command} @cocal/google-calendar-mcp",
        env={**os.environ, "GOOGLE_OAUTH_CREDENTIALS": gcal_credentials_path},
        include_tools=["create-event", "delete-event"],
        # Default 10s kadang kurang di lingkungan ini (npx cold-start +
        # kadang ada refresh token Google over network saat handshake).
        timeout_seconds=30,
    )
    gcal_ok = await connect_once(gcal_mcp, "Google Calendar")
    if not gcal_ok:
        print("[WARN] Google Calendar MCP tidak berhasil initialize.")

    app.state.firecrawl_mcp = firecrawl_mcp
    app.state.gcal_mcp = gcal_mcp
    app.state.firecrawl_ok = firecrawl_ok
    app.state.gcal_ok = gcal_ok

    app.state.trend_scout = Agent(
        name="Trend Scout",
        model=get_model(),
        tools=[firecrawl_mcp],
        instructions=[
            "WAJIB gunakan tool search dari Firecrawl untuk mencari topik yang benar-benar sedang dibahas di web.",
            "Berikan PERSIS 10 topik/ide konten, diberi nomor 1-10, masing-masing 1 baris singkat (judul saja, tanpa penjelasan panjang, tanpa URL).",
            "Jangan menjawab dari asumsi/pengetahuan umum.",
            "DILARANG memberikan topik yang mengandung kekerasan, konten dewasa, judi, narkoba, atau self-harm.",
        ],
    )

    app.state.script_writer = Agent(
        name="Script Writer",
        model=get_model(),
        instructions=[
            "Tulis FULL SCRIPT video pendek (format Reels/TikTok/Shorts) untuk topik yang diberikan.",
            "Pecah jadi segmen waktu, contoh:",
            "[0-3 detik] HOOK: <narasi persis>",
            "[3-10 detik] <isi 1>: <narasi persis>",
            "[10-20 detik] <isi 2>: <narasi persis>",
            "[20-30 detik] CTA/PENUTUP: <narasi persis>",
            "Setiap segmen berisi narasi/dialog konkret, bukan deskripsi umum.",
            "Jangan mengarang klaim yang tidak berdasar.",
            "DILARANG membuat script yang mengandung ujaran kebencian, misinformasi kesehatan, atau konten menyesatkan.",
        ],
    )

    app.state.scheduler = Agent(
        name="Scheduler",
        model=get_model(),
        tools=[gcal_mcp],
        instructions=[
            "Tugasmu HANYA membuat atau menghapus event di Google Calendar sesuai instruksi yang diberikan - tidak ada tugas lain.",
            "Kalau diminta MEMBUAT event: WAJIB panggil tool 'create-event' saat ini juga sesuai judul, tanggal, dan jam yang diberikan, jangan hanya menjelaskan rencana.",
            "Kalau diminta MENGHAPUS event: WAJIB panggil tool 'delete-event' saat ini juga sesuai eventId dan calendarId yang diberikan, jangan hanya menjelaskan rencana.",
            "Setelah tool dipanggil, laporkan hasil APA ADANYA: jika sukses sebutkan detail event, jika gagal sebutkan pesan error persis dari tool.",
            "DILARANG KERAS mengklaim 'berhasil dibuat' atau 'berhasil dihapus' kecuali tool yang bersangkutan benar-benar mengembalikan hasil sukses.",
        ],
    )

    # Serialize pemanggilan tiap agent: sesi MCP (stdio/http) dipakai bersama
    # lintas request, jadi tidak dirancang untuk dipanggil konkuren.
    app.state.trend_lock = asyncio.Lock()
    app.state.writer_lock = asyncio.Lock()
    app.state.scheduler_lock = asyncio.Lock()

    yield

    if firecrawl_ok:
        await firecrawl_mcp.close()
    if gcal_ok:
        await gcal_mcp.close()


app = FastAPI(title="Viralist+ Content Agent", lifespan=lifespan)

# Frontend (Vite dev server) dan backend ini berjalan di origin berbeda saat
# development, jadi butuh CORS. Auth pakai Bearer token (bukan cookie), jadi
# allow_credentials tidak perlu True.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if ALLOW_ALL_ORIGINS else FRONTEND_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"service": "Viralist+ Content Agent API", "status": "ok"}


@app.get("/api/health")
def health():
    return {"firecrawl_ok": app.state.firecrawl_ok, "gcal_ok": app.state.gcal_ok}


# ============================================================
# Step 1: Trend Scout
# ============================================================

class NicheIn(BaseModel):
    niche: str = Field(min_length=1, max_length=200)


@app.post("/api/topics")
async def api_topics(body: NicheIn, user: dict = Depends(require_supabase_user)):
    niche = body.niche.strip()
    if not niche:
        raise HTTPException(422, "[GUARDRAIL] Niche tidak boleh kosong.")
    if not validasi_konten_topik(niche):
        raise HTTPException(422, "[GUARDRAIL] Niche mengandung kata yang tidak diizinkan.")
    if not app.state.firecrawl_ok:
        raise HTTPException(503, "Firecrawl MCP tidak tersedia di server saat ini.")

    async with app.state.trend_lock:
        result = await app.state.trend_scout.arun(f"Cari topik trending untuk niche '{niche}'")

    if not validasi_konten_topik(result.content):
        raise HTTPException(422, "[GUARDRAIL] Hasil topik mengandung konten yang tidak diizinkan.")

    topics = parse_topics(result.content)
    if not topics:
        raise HTTPException(502, "Gagal mem-parsing daftar topik dari hasil agent. Coba lagi.")

    state = get_state(user["id"])
    state["niche"] = niche
    state["topics_raw"] = result.content
    state["topics"] = topics

    return {
        "niche": niche,
        "topics": [{"number": n, "title": topics[n]} for n in sorted(topics)],
    }


@app.post("/api/topics/stream")
async def api_topics_stream(body: NicheIn, user: dict = Depends(require_supabase_user)):
    niche = body.niche.strip()
    if not niche:
        raise HTTPException(422, "[GUARDRAIL] Niche tidak boleh kosong.")
    if not validasi_konten_topik(niche):
        raise HTTPException(422, "[GUARDRAIL] Niche mengandung kata yang tidak diizinkan.")
    if not app.state.firecrawl_ok:
        raise HTTPException(503, "Firecrawl MCP tidak tersedia di server saat ini.")

    async def gen() -> AsyncIterator[str]:
        final_content = None
        try:
            async for chunk in run_agent_streamed(
                app.state.trend_scout,
                f"Cari topik trending untuk niche '{niche}'",
                app.state.trend_lock,
            ):
                event = json.loads(chunk[len("data: "):])
                if event["type"] == "_final":
                    final_content = event["text"]
                    continue
                yield chunk
        except Exception as e:
            yield sse_event({"type": "error", "text": f"{type(e).__name__}: {e}"})
            return

        if not final_content:
            yield sse_event({"type": "error", "text": "Agent tidak mengembalikan hasil."})
            return
        if not validasi_konten_topik(final_content):
            yield sse_event({"type": "error", "text": "[GUARDRAIL] Hasil topik mengandung konten yang tidak diizinkan."})
            return

        topics = parse_topics(final_content)
        if not topics:
            yield sse_event({"type": "error", "text": "Gagal mem-parsing daftar topik dari hasil agent. Coba lagi."})
            return

        state = get_state(user["id"])
        state["niche"] = niche
        state["topics_raw"] = final_content
        state["topics"] = topics

        yield sse_event({
            "type": "done",
            "result": {
                "niche": niche,
                "topics": [{"number": n, "title": topics[n]} for n in sorted(topics)],
            },
        })

    return StreamingResponse(gen(), media_type="text/event-stream")


# ============================================================
# Step 2: Script Writer
# ============================================================

class TopicIn(BaseModel):
    topic_index: int
    platform: str | None = None
    tone: str | None = None
    duration: str | None = None


@app.post("/api/script")
async def api_script(body: TopicIn, user: dict = Depends(require_supabase_user)):
    state = get_state(user["id"])
    if "topics" not in state:
        raise HTTPException(400, "Belum ada daftar topik. Panggil /api/topics dulu.")

    # --- Guardrail 1 dari main.py: validasi pilihan topik ---
    pilihan = validasi_pilihan_topik(str(body.topic_index))
    if pilihan is None:
        raise HTTPException(422, "[GUARDRAIL] Pilihan topik harus angka 1-10.")
    if pilihan not in state["topics"]:
        raise HTTPException(422, f"[GUARDRAIL] Topik nomor {pilihan} tidak ditemukan di hasil scout.")

    context_bits = []
    if body.platform:
        context_bits.append(f"Platform: {body.platform}")
    if body.tone:
        context_bits.append(f"Tone/gaya: {body.tone}")
    if body.duration:
        context_bits.append(f"Target durasi: {body.duration}")
    context_str = ("\n" + "\n".join(context_bits)) if context_bits else ""

    async with app.state.writer_lock:
        result = await app.state.script_writer.arun(
            f"Berikut daftar topik:\n{state['topics_raw']}\n\n"
            f"Tulis full script untuk topik nomor {pilihan}.{context_str}"
        )

    # --- Guardrail: content filter pada hasil script ---
    if not validasi_konten_topik(result.content):
        raise HTTPException(422, "[GUARDRAIL] Script mengandung konten yang tidak diizinkan. Proses dihentikan.")

    state["chosen_index"] = pilihan
    state["chosen_topic"] = state["topics"][pilihan]
    state["script"] = result.content
    state.pop("schedule_pending", None)

    return {
        "topic_index": pilihan,
        "topic": state["chosen_topic"],
        "script": result.content,
        "hook": extract_hook(result.content),
    }


@app.post("/api/script/stream")
async def api_script_stream(body: TopicIn, user: dict = Depends(require_supabase_user)):
    state = get_state(user["id"])
    if "topics" not in state:
        raise HTTPException(400, "Belum ada daftar topik. Panggil /api/topics dulu.")

    # --- Guardrail 1 dari main.py: validasi pilihan topik ---
    pilihan = validasi_pilihan_topik(str(body.topic_index))
    if pilihan is None:
        raise HTTPException(422, "[GUARDRAIL] Pilihan topik harus angka 1-10.")
    if pilihan not in state["topics"]:
        raise HTTPException(422, f"[GUARDRAIL] Topik nomor {pilihan} tidak ditemukan di hasil scout.")

    context_bits = []
    if body.platform:
        context_bits.append(f"Platform: {body.platform}")
    if body.tone:
        context_bits.append(f"Tone/gaya: {body.tone}")
    if body.duration:
        context_bits.append(f"Target durasi: {body.duration}")
    context_str = ("\n" + "\n".join(context_bits)) if context_bits else ""

    prompt = (
        f"Berikut daftar topik:\n{state['topics_raw']}\n\n"
        f"Tulis full script untuk topik nomor {pilihan}.{context_str}"
    )

    async def gen() -> AsyncIterator[str]:
        final_content = None
        try:
            async for chunk in run_agent_streamed(app.state.script_writer, prompt, app.state.writer_lock):
                event = json.loads(chunk[len("data: "):])
                if event["type"] == "_final":
                    final_content = event["text"]
                    continue
                yield chunk
        except Exception as e:
            yield sse_event({"type": "error", "text": f"{type(e).__name__}: {e}"})
            return

        if not final_content:
            yield sse_event({"type": "error", "text": "Agent tidak mengembalikan hasil."})
            return

        # --- Guardrail: content filter pada hasil script ---
        if not validasi_konten_topik(final_content):
            yield sse_event({"type": "error", "text": "[GUARDRAIL] Script mengandung konten yang tidak diizinkan. Proses dihentikan."})
            return

        state["chosen_index"] = pilihan
        state["chosen_topic"] = state["topics"][pilihan]
        state["script"] = final_content
        state.pop("schedule_pending", None)

        yield sse_event({
            "type": "done",
            "result": {
                "topic_index": pilihan,
                "topic": state["chosen_topic"],
                "script": final_content,
                "hook": extract_hook(final_content),
            },
        })

    return StreamingResponse(gen(), media_type="text/event-stream")


# ============================================================
# Step 3/4: Scheduler (preview lalu confirm)
# ============================================================
# Preview & confirm sengaja menerima judul/topik langsung dari body (bukan
# bergantung ke state /api/topics-/api/script), karena Scheduler di frontend
# bisa menjadwalkan brief lama dari backlog Supabase, bukan cuma brief yang
# baru saja dibuat di sesi yang sama.

class SchedulePreviewIn(BaseModel):
    judul: str = Field(min_length=1, max_length=200)
    topik: str = Field(default="", max_length=300)
    tanggal: str = Field(min_length=1, max_length=100)
    jam: str


@app.post("/api/schedule/preview")
async def api_schedule_preview(body: SchedulePreviewIn, user: dict = Depends(require_supabase_user)):
    judul = body.judul.strip()
    if not judul:
        raise HTTPException(422, "[GUARDRAIL] Judul tidak boleh kosong.")
    if not validasi_konten_topik(judul):
        raise HTTPException(422, "[GUARDRAIL] Judul mengandung kata yang tidak diizinkan.")

    tanggal = body.tanggal.strip()
    if not tanggal:
        raise HTTPException(422, "[GUARDRAIL] Tanggal tidak boleh kosong.")

    # --- Guardrail 1 dari main.py: validasi format jam ---
    jam = body.jam.strip()
    if not validasi_jam(jam):
        raise HTTPException(422, "[GUARDRAIL] Format jam tidak valid. Gunakan format HH:MM (contoh: 15:00).")

    topik = body.topik.strip()

    state = get_state(user["id"])
    state["schedule_pending"] = {"judul": judul, "tanggal": tanggal, "jam": jam}

    return {
        "judul": judul,
        "topik": topik,
        "tanggal": tanggal,
        "jam": jam,
        "durasi": "1 jam",
        "timezone": "Asia/Jakarta",
        "calendar": "primary",
    }


@app.post("/api/schedule/confirm")
async def api_schedule_confirm(user: dict = Depends(require_supabase_user)):
    state = get_state(user["id"])
    pending = state.get("schedule_pending")
    if not pending:
        raise HTTPException(400, "Belum ada preview jadwal. Panggil /api/schedule/preview dulu.")

    if not app.state.gcal_ok:
        raise HTTPException(503, "Google Calendar MCP tidak tersedia di server. Event tidak dibuat.")

    async with app.state.scheduler_lock:
        result = await app.state.scheduler.arun(
            f"Buat event Google Calendar dengan judul '{pending['judul']}', "
            f"tanggal {pending['tanggal']}, jam mulai {pending['jam']}, durasi 1 jam, "
            f"timezone Asia/Jakarta, calendarId primary."
        )

    # Sama seperti main.py: sukses hanya diklaim kalau tool create-event
    # benar-benar terpanggil, bukan berdasarkan klaim teks dari model.
    tool_dipanggil = any(
        "create-event" in str(getattr(msg, "tool_calls", "") or "")
        for msg in (result.messages or [])
    )

    # Konsumsi preview yang pending supaya konfirmasi berikutnya butuh
    # preview baru (mencegah double-create tanpa sengaja).
    state.pop("schedule_pending", None)

    link_match = re.search(r"https://\S+", result.content or "")
    event_link = link_match.group(0).rstrip(").,") if (tool_dipanggil and link_match) else None

    return {
        "success": bool(tool_dipanggil),
        "message": result.content,
        "event_link": event_link,
        # event_id asli cuma bisa diambil dari hasil mentah tool call, yang
        # cuma diekspos lewat varian /stream (lihat run_agent_streamed).
        "event_id": None,
    }


@app.post("/api/schedule/confirm/stream")
async def api_schedule_confirm_stream(user: dict = Depends(require_supabase_user)):
    state = get_state(user["id"])
    pending = state.get("schedule_pending")
    if not pending:
        raise HTTPException(400, "Belum ada preview jadwal. Panggil /api/schedule/preview dulu.")

    if not app.state.gcal_ok:
        raise HTTPException(503, "Google Calendar MCP tidak tersedia di server. Event tidak dibuat.")

    prompt = (
        f"Buat event Google Calendar dengan judul '{pending['judul']}', "
        f"tanggal {pending['tanggal']}, jam mulai {pending['jam']}, durasi 1 jam, "
        f"timezone Asia/Jakarta, calendarId primary."
    )

    async def gen() -> AsyncIterator[str]:
        final_content = None
        tools_called: list[str] = []
        event_id: str | None = None
        event_link: str | None = None
        try:
            async for chunk in run_agent_streamed(app.state.scheduler, prompt, app.state.scheduler_lock):
                event = json.loads(chunk[len("data: "):])
                if event["type"] == "_final":
                    final_content = event["text"]
                    tools_called = event.get("tools_called") or []
                    continue
                if event["type"] == "tool_call_completed" and event.get("tool_name") == "create-event":
                    event_id, event_link = extract_event_from_tool_result(event.get("tool_result"))
                yield chunk
        except Exception as e:
            yield sse_event({"type": "error", "text": f"{type(e).__name__}: {e}"})
            return

        # Sama seperti main.py: sukses hanya diklaim kalau tool create-event
        # benar-benar terpanggil, bukan berdasarkan klaim teks dari model.
        tool_dipanggil = "create-event" in tools_called

        # Konsumsi preview yang pending supaya konfirmasi berikutnya butuh
        # preview baru (mencegah double-create tanpa sengaja).
        state.pop("schedule_pending", None)

        if not tool_dipanggil:
            event_id, event_link = None, None
        elif not event_link:
            # Fallback kalau parsing JSON hasil tool gagal - cari link di teks.
            link_match = re.search(r"https://\S+", final_content or "")
            event_link = link_match.group(0).rstrip(").,") if link_match else None

        yield sse_event({
            "type": "done",
            "result": {
                "success": tool_dipanggil,
                "message": final_content or "",
                "event_link": event_link,
                "event_id": event_id,
            },
        })

    return StreamingResponse(gen(), media_type="text/event-stream")


# ============================================================
# Hapus post: benar-benar menghapus event asli di Google Calendar
# (bukan cuma dihapus dari daftar di aplikasi).
# ============================================================

class ScheduleDeleteIn(BaseModel):
    event_id: str = Field(min_length=1, max_length=500)
    calendar_id: str = Field(default="primary", max_length=200)


@app.post("/api/schedule/delete")
async def api_schedule_delete(body: ScheduleDeleteIn, user: dict = Depends(require_supabase_user)):
    if not app.state.gcal_ok:
        raise HTTPException(503, "Google Calendar MCP tidak tersedia di server. Event tidak dihapus.")

    async with app.state.scheduler_lock:
        result = await app.state.scheduler.arun(
            f"Hapus event Google Calendar dengan eventId '{body.event_id}', calendarId {body.calendar_id}."
        )

    # Sama seperti create: sukses hanya diklaim kalau tool delete-event
    # benar-benar terpanggil, bukan berdasarkan klaim teks dari model.
    tool_dipanggil = any(
        "delete-event" in str(getattr(msg, "tool_calls", "") or "")
        for msg in (result.messages or [])
    )

    return {"success": bool(tool_dipanggil), "message": result.content}


@app.post("/api/schedule/delete/stream")
async def api_schedule_delete_stream(body: ScheduleDeleteIn, user: dict = Depends(require_supabase_user)):
    if not app.state.gcal_ok:
        raise HTTPException(503, "Google Calendar MCP tidak tersedia di server. Event tidak dihapus.")

    prompt = f"Hapus event Google Calendar dengan eventId '{body.event_id}', calendarId {body.calendar_id}."

    async def gen() -> AsyncIterator[str]:
        final_content = None
        tools_called: list[str] = []
        try:
            async for chunk in run_agent_streamed(app.state.scheduler, prompt, app.state.scheduler_lock):
                event = json.loads(chunk[len("data: "):])
                if event["type"] == "_final":
                    final_content = event["text"]
                    tools_called = event.get("tools_called") or []
                    continue
                yield chunk
        except Exception as e:
            yield sse_event({"type": "error", "text": f"{type(e).__name__}: {e}"})
            return

        tool_dipanggil = "delete-event" in tools_called
        yield sse_event({
            "type": "done",
            "result": {"success": tool_dipanggil, "message": final_content or ""},
        })

    return StreamingResponse(gen(), media_type="text/event-stream")


# ============================================================
# Google Calendar per-user: tiap user connect Calendar-nya sendiri lewat
# OAuth, bukan pakai satu koneksi bersama seperti Scheduler agent di atas.
# Create/delete event di sini manggil Google Calendar API langsung (bukan
# lewat MCP/agent) karena tokennya beda-beda tiap request tergantung siapa
# yang login - MCP didesain untuk satu kredensial statis per proses.
# ============================================================

def calendar_oauth_configured() -> bool:
    return bool(GOOGLE_CALENDAR_OAUTH_CLIENT_ID and GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET and GOOGLE_CALENDAR_OAUTH_REDIRECT_URI)


@app.get("/api/calendar/oauth/start")
async def calendar_oauth_start(user: dict = Depends(require_supabase_user)):
    if not calendar_oauth_configured():
        raise HTTPException(500, "Google Calendar OAuth belum dikonfigurasi di .env server.")

    state_token = secrets.token_urlsafe(24)
    OAUTH_STATE_MAP[state_token] = user["id"]

    params = {
        "client_id": GOOGLE_CALENDAR_OAUTH_CLIENT_ID,
        "redirect_uri": GOOGLE_CALENDAR_OAUTH_REDIRECT_URI,
        "response_type": "code",
        "scope": GOOGLE_CALENDAR_SCOPE,
        "access_type": "offline",
        # "consent" dipaksa supaya Google selalu kasih refresh_token baru,
        # termasuk kalau user ini sudah pernah connect sebelumnya.
        "prompt": "consent",
        "state": state_token,
    }
    return {"url": "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)}


@app.get("/api/calendar/oauth/callback")
async def calendar_oauth_callback(code: str | None = None, state: str | None = None, error: str | None = None):
    # Ini dipanggil lewat redirect browser dari Google (bukan fetch dari
    # frontend), jadi hasilnya juga berupa redirect balik ke frontend -
    # bukan JSON - dengan query param buat kasih tahu berhasil/gagal.
    if error:
        return RedirectResponse(f"{FRONTEND_URL}/?calendar_connected=0&error={error}")
    if not code or not state or state not in OAUTH_STATE_MAP:
        return RedirectResponse(f"{FRONTEND_URL}/?calendar_connected=0&error=invalid_state")

    user_id = OAUTH_STATE_MAP.pop(state)

    async with httpx.AsyncClient(timeout=15) as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CALENDAR_OAUTH_CLIENT_ID,
                "client_secret": GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET,
                "redirect_uri": GOOGLE_CALENDAR_OAUTH_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
    if token_resp.status_code != 200:
        return RedirectResponse(f"{FRONTEND_URL}/?calendar_connected=0&error=token_exchange_failed")

    tokens = token_resp.json()
    refresh_token = tokens.get("refresh_token")
    access_token = tokens.get("access_token")
    if not refresh_token:
        return RedirectResponse(f"{FRONTEND_URL}/?calendar_connected=0&error=no_refresh_token")

    connected_email = None
    async with httpx.AsyncClient(timeout=15) as client:
        uresp = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if uresp.status_code == 200:
            connected_email = uresp.json().get("email")

    try:
        await save_calendar_connection(user_id, refresh_token, connected_email)
    except Exception:
        return RedirectResponse(f"{FRONTEND_URL}/?calendar_connected=0&error=save_failed")

    return RedirectResponse(f"{FRONTEND_URL}/?calendar_connected=1")


@app.get("/api/calendar/status")
async def calendar_status(user: dict = Depends(require_supabase_user)):
    conn = await get_calendar_connection(user["id"])
    return {"connected": conn is not None, "email": conn["connected_email"] if conn else None}


@app.post("/api/calendar/disconnect")
async def calendar_disconnect(user: dict = Depends(require_supabase_user)):
    await delete_calendar_connection(user["id"])
    return {"success": True}


class CalendarEventIn(BaseModel):
    judul: str = Field(min_length=1, max_length=200)
    tanggal: str = Field(min_length=1, max_length=20)  # YYYY-MM-DD
    jam: str  # HH:MM
    durasi_menit: int = 60


@app.post("/api/calendar/create-event")
async def calendar_create_event(body: CalendarEventIn, user: dict = Depends(require_supabase_user)):
    if not validasi_konten_topik(body.judul):
        raise HTTPException(422, "[GUARDRAIL] Judul mengandung kata yang tidak diizinkan.")
    if not validasi_jam(body.jam):
        raise HTTPException(422, "[GUARDRAIL] Format jam tidak valid. Gunakan format HH:MM (contoh: 15:00).")

    conn = await get_calendar_connection(user["id"])
    if not conn:
        raise HTTPException(400, "Google Calendar belum terhubung. Connect dulu lewat Settings.")

    access_token = await get_fresh_access_token(conn["refresh_token"])

    try:
        start = datetime.fromisoformat(f"{body.tanggal}T{body.jam}:00")
    except ValueError:
        raise HTTPException(422, "[GUARDRAIL] Format tanggal tidak valid. Gunakan format YYYY-MM-DD.")
    end = start + timedelta(minutes=body.durasi_menit)

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events",
            headers={"Authorization": f"Bearer {access_token}"},
            json={
                "summary": body.judul,
                "start": {"dateTime": start.isoformat(), "timeZone": "Asia/Jakarta"},
                "end": {"dateTime": end.isoformat(), "timeZone": "Asia/Jakarta"},
            },
        )
    if resp.status_code not in (200, 201):
        raise HTTPException(502, f"Gagal membuat event di Google Calendar: {resp.text}")

    data = resp.json()
    return {"success": True, "event_id": data.get("id"), "event_link": data.get("htmlLink")}


class CalendarDeleteIn(BaseModel):
    event_id: str = Field(min_length=1, max_length=500)


@app.post("/api/calendar/delete-event")
async def calendar_delete_event(body: CalendarDeleteIn, user: dict = Depends(require_supabase_user)):
    conn = await get_calendar_connection(user["id"])
    if not conn:
        raise HTTPException(400, "Google Calendar belum terhubung.")

    access_token = await get_fresh_access_token(conn["refresh_token"])

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.delete(
            f"https://www.googleapis.com/calendar/v3/calendars/primary/events/{body.event_id}",
            headers={"Authorization": f"Bearer {access_token}"},
        )
    # Google balas 204 kalau sukses, 410 kalau event itu sudah dihapus
    # sebelumnya - dua-duanya dianggap "sudah tidak ada di Calendar", jadi
    # sukses dari sudut pandang user.
    if resp.status_code not in (204, 410):
        raise HTTPException(502, f"Gagal menghapus event di Google Calendar: {resp.text}")
    return {"success": True}


# ============================================================
# Voucher promo: upgrade instan ke Agency 1 bulan, dibatasi total
# VOUCHER_MAX_REDEMPTIONS penukaran (bukan per user).
# ============================================================

class VoucherRedeemIn(BaseModel):
    code: str = Field(min_length=1, max_length=50)


@app.post("/api/voucher/redeem")
async def voucher_redeem(body: VoucherRedeemIn, user: dict = Depends(require_supabase_user)):
    code = body.code.strip().upper()
    if code != VOUCHER_CODE:
        raise HTTPException(422, "Kode voucher tidak valid.")

    already_redeemed = await has_redeemed_voucher(user["id"], code)
    if not already_redeemed:
        total = await count_voucher_redemptions(code)
        if total >= VOUCHER_MAX_REDEMPTIONS:
            raise HTTPException(409, f"Voucher ini sudah mencapai batas maksimal {VOUCHER_MAX_REDEMPTIONS} pengguna.")

    now = datetime.utcnow()
    end_date = now + timedelta(days=30)

    require_service_role()
    async with httpx.AsyncClient(timeout=15) as client:
        if not already_redeemed:
            await client.post(
                f"{SUPABASE_URL}/rest/v1/voucher_redemptions",
                headers={
                    "apikey": SUPABASE_SERVICE_ROLE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal",
                },
                json={"user_id": user["id"], "code": code},
            )

        resp = await client.patch(
            f"{SUPABASE_URL}/rest/v1/profiles",
            headers={
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            params={"id": f"eq.{user['id']}"},
            json={
                "subscription_tier": "agency",
                "subscription_status": "active",
                "subscription_start": now.isoformat(),
                "subscription_end": end_date.isoformat(),
            },
        )
    if resp.status_code not in (200, 204):
        raise HTTPException(502, "Gagal update paket langganan. Coba lagi.")

    return {
        "success": True,
        "subscription_tier": "agency",
        "subscription_end": end_date.isoformat(),
    }
