from dotenv import load_dotenv
import os
import asyncio
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


async def main():
    firecrawl_key = os.getenv("FIRECRAWL_API_KEY")
    print(f"[DEBUG] Firecrawl key kebaca: {bool(firecrawl_key)}")

    firecrawl_mcp = MCPTools(
        transport="streamable-http",
        url=f"https://mcp.firecrawl.dev/{firecrawl_key}/v2/mcp",
    )

    print("[DEBUG] Mencoba connect ke Firecrawl MCP...")
    await firecrawl_mcp.connect()
    print("[DEBUG] Connect berhasil (tidak ada error)")

    # Cek tool apa aja yang berhasil di-load dari MCP server
    print(f"[DEBUG] Functions terdaftar: {list(firecrawl_mcp.functions.keys()) if hasattr(firecrawl_mcp, 'functions') else 'atribut functions tidak ditemukan'}")

    trend_scout = Agent(
        name="Trend Scout",
        role="Mencari topik dan tren konten terbaru sesuai niche yang diminta user",
        model=get_model(),
        tools=[firecrawl_mcp],
        instructions=[
            "WAJIB gunakan tool search dari Firecrawl untuk mencari topik yang benar-benar sedang dibahas di web sebelum menjawab.",
            "Jangan menjawab dari asumsi/pengetahuan umum.",
            "Sebutkan sumber (URL) dari mana topik itu kamu temukan.",
        ],
    )

    await trend_scout.aprint_response(
        "Cari 3 topik trending tentang produktivitas untuk mahasiswa"
    )

    await firecrawl_mcp.close()


if __name__ == "__main__":
    asyncio.run(main())