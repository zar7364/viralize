from dotenv import load_dotenv
import os
import re
import asyncio
import platform
from datetime import datetime
load_dotenv()

from agno.agent import Agent
from agno.models.openai.like import OpenAILike
from agno.tools.mcp import MCPTools


def get_model():
    return OpenAILike(
        id="gpt-4o-mini",
        api_key=os.getenv("SUMOPOD_API_KEY"),
        base_url="https://ai.sumopod.com/v1",
    )


# ============================================================
# GUARDRAIL 1: Validasi input di level kode (bukan cuma prompt)
# ============================================================

def validasi_pilihan_topik(pilihan_str: str) -> int | None:
    """Pastikan pilihan user adalah angka 1-10. Return None jika tidak valid."""
    if not pilihan_str.isdigit():
        return None
    pilihan = int(pilihan_str)
    if pilihan < 1 or pilihan > 10:
        return None
    return pilihan


def validasi_jam(jam_str: str) -> bool:
    """Pastikan format jam HH:MM dan valid (00:00 - 23:59)."""
    if not re.match(r"^\d{2}:\d{2}$", jam_str):
        return False
    try:
        datetime.strptime(jam_str, "%H:%M")
        return True
    except ValueError:
        return False


TOPIK_TERLARANG = ["bunuh diri", "narkoba", "judi", "pornografi", "kekerasan"]


def validasi_konten_topik(topik: str) -> bool:
    """Content filter dasar: tolak topik yang mengandung kata terlarang."""
    topik_lower = topik.lower()
    return not any(kata in topik_lower for kata in TOPIK_TERLARANG)


async def main():
    firecrawl_key = os.getenv("FIRECRAWL_API_KEY")
    firecrawl_mcp = MCPTools(
        transport="streamable-http",
        url=f"https://mcp.firecrawl.dev/{firecrawl_key}/v2/mcp",
    )
    await firecrawl_mcp.connect()

    gcal_credentials_path = os.path.join(os.getcwd(), "gcp-oauth-keys.json")
    npx_command = "npx.cmd" if platform.system() == "Windows" else "npx"

    # ============================================================
    # GUARDRAIL 2: Pembatasan scope tool di level kode.
    # Scheduler HANYA diizinkan memanggil 'create-event'.
    # Ini ditegakkan oleh MCPTools (include_tools), bukan cuma
    # instruksi teks yang bisa diabaikan model.
    # ============================================================
    gcal_mcp = MCPTools(
        command=f"{npx_command} @cocal/google-calendar-mcp",
        env={**os.environ, "GOOGLE_OAUTH_CREDENTIALS": gcal_credentials_path},
        include_tools=["create-event"],
    )
    await gcal_mcp.connect()

    trend_scout = Agent(
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

    script_writer = Agent(
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

    scheduler = Agent(
        name="Scheduler",
        model=get_model(),
        tools=[gcal_mcp],
        instructions=[
            "Tugasmu HANYA membuat event di Google Calendar sesuai judul, tanggal, dan jam yang diberikan.",
            "WAJIB panggil tool 'create-event' saat ini juga, jangan hanya menjelaskan rencana.",
            "Setelah tool dipanggil, laporkan hasil APA ADANYA: jika sukses sebutkan detail event, jika gagal sebutkan pesan error persis dari tool.",
            "DILARANG KERAS mengklaim 'berhasil dibuat' kecuali tool benar-benar mengembalikan hasil sukses.",
        ],
    )

    print("\n=== Mencari 10 topik trending... ===\n")
    scout_result = await trend_scout.arun(
        "Cari topik trending untuk niche 'produktivitas untuk mahasiswa'"
    )
    print(scout_result.content)

    # --- Guardrail 1 diterapkan: validasi pilihan topik ---
    pilihan = None
    while pilihan is None:
        pilihan_str = input("\nPilih nomor topik (1-10): ").strip()
        pilihan = validasi_pilihan_topik(pilihan_str)
        if pilihan is None:
            print("[GUARDRAIL] Input tidak valid. Masukkan angka 1-10 saja.")

    print("\n=== Menulis full script... ===\n")
    writer_result = await script_writer.arun(
        f"Berikut daftar topik:\n{scout_result.content}\n\nTulis full script untuk topik nomor {pilihan}."
    )

    # --- Guardrail: content filter pada hasil script ---
    if not validasi_konten_topik(writer_result.content):
        print("[GUARDRAIL] Script mengandung konten yang tidak diizinkan. Proses dihentikan.")
        await firecrawl_mcp.close()
        await gcal_mcp.close()
        return

    print(writer_result.content)

    # --- Guardrail 1 diterapkan: validasi tanggal & jam ---
    tanggal = input("\nMau dijadwalkan tanggal berapa? (format: DD Bulan YYYY): ").strip()
    jam = None
    while jam is None:
        jam_str = input("Jam berapa? (format: HH:MM, contoh 15:00): ").strip()
        if validasi_jam(jam_str):
            jam = jam_str
        else:
            print("[GUARDRAIL] Format jam tidak valid. Gunakan format HH:MM (contoh: 15:00).")

    print(f"\nRingkasan jadwal:\n- Tanggal: {tanggal}\n- Jam: {jam}")
    konfirmasi = input("Konfirmasi jadwal ini? (ya/tidak): ").strip().lower()

    if konfirmasi in ["ya", "y", "setuju", "approve"]:
        print("\n=== Membuat event di Google Calendar... ===\n")
        scheduler_result = await scheduler.arun(
            f"Buat event Google Calendar dengan judul 'Publikasi Konten: Topik #{pilihan}', "
            f"tanggal {tanggal}, jam mulai {jam}, durasi 1 jam, timezone Asia/Jakarta, calendarId primary."
        )
        print(scheduler_result.content)

        tool_dipanggil = any(
            "create-event" in str(getattr(msg, "tool_calls", "") or "")
            for msg in (scheduler_result.messages or [])
        )
        if tool_dipanggil:
            print("\n[OK] Jadwal sudah di-set, silakan cek di Google Calendar.")
        else:
            print("\n[WARNING] Tool create-event sepertinya tidak terpanggil. Cek pesan error di atas.")
    else:
        print("\nDibatalkan, tidak ada event yang dibuat.")

    await firecrawl_mcp.close()
    await gcal_mcp.close()


if __name__ == "__main__":
    asyncio.run(main())