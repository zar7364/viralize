from dotenv import load_dotenv
import os
import asyncio
import platform
load_dotenv()

from agno.tools.mcp import MCPTools


async def main():
    gcal_credentials_path = os.path.join(os.getcwd(), "gcp-oauth-keys.json")
    print(f"[DEBUG] OS: {platform.system()}")
    print(f"[DEBUG] Path credentials: {gcal_credentials_path}")
    print(f"[DEBUG] File credentials ada?: {os.path.exists(gcal_credentials_path)}")

    # Di Windows, npx kadang perlu dipanggil sebagai npx.cmd
    npx_command = "npx.cmd" if platform.system() == "Windows" else "npx"

    gcal_mcp = MCPTools(
        command=f"{npx_command} @cocal/google-calendar-mcp",
        env={**os.environ, "GOOGLE_OAUTH_CREDENTIALS": gcal_credentials_path},
    )

    print("[DEBUG] Mencoba connect...")
    try:
        await gcal_mcp.connect()
        print("[DEBUG] Connect berhasil!")
        print(f"[DEBUG] Functions: {list(gcal_mcp.functions.keys()) if hasattr(gcal_mcp, 'functions') else 'tidak ditemukan'}")
        await gcal_mcp.close()
    except Exception as e:
        print(f"[DEBUG] GAGAL dengan error: {type(e).__name__}: {e}")


if __name__ == "__main__":
    asyncio.run(main())