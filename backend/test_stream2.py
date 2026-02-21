import asyncio
import os
import httpx
from dotenv import load_dotenv

load_dotenv()
HF_TOKEN = os.getenv("HF_TOKEN")
MEDGEMMA_ENDPOINT = os.getenv("MEDGEMMA_ENDPOINT")

async def test_stream():
    headers = {
        "Authorization": f"Bearer {HF_TOKEN}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream"
    }
    payload = {
        "inputs": {
            "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
            "text": "What is this image? Keep it short."
        },
        "parameters": {"max_new_tokens": 50},
        "stream": True
    }
    async with httpx.AsyncClient() as client:
        # Some HF TGI endpoints support /generate_stream
        url = MEDGEMMA_ENDPOINT
        async with client.stream("POST", url, json=payload, headers=headers) as resp:
            print("Status:", resp.status_code)
            async for chunk in resp.aiter_text():
                print("Chunk:", repr(chunk))

asyncio.run(test_stream())
