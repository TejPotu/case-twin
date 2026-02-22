import os
import json
from qdrant_client import QdrantClient

# Hardcode the Qdrant DB connection to ensure it connects correctly without weird env var issues
QDRANT_URL="https://eaec41e9-ed78-48b6-b742-166e1c6aec31.us-east4-0.gcp.cloud.qdrant.io"
QDRANT_API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.6EEOhjosd_gJ6bYuhl_Mp_6GDVMfhvxyjJDAYMNc-KQ"

client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)

try:
    results, _ = client.scroll(
        collection_name="chest_xrays",
        limit=1,
        with_payload=True,
        with_vectors=False
    )
    if results:
        print(json.dumps(results[0].payload, indent=2))
    else:
        print("No results found.")
except Exception as e:
    print(f"Error: {e}")
