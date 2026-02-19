import httpx
import os

ENDPOINT = "http://localhost:8000/extract"
IMAGE_PATH = "../PMC10034413_gr5_undivided_1_1.webp"

def test_integration():
    if not os.path.exists(IMAGE_PATH):
        print(f"❌ Image not found at {IMAGE_PATH}")
        return

    files = [
        ("images", ("image.webp", open(IMAGE_PATH, "rb"), "image/webp"))
    ]
    data = {
        "notes": "Patient presents with cough and fever. Possible pneumonia."
    }

    print(f"Testing {ENDPOINT}...")
    try:
        # We need to make sure the backend is running at :8000
        # If not, this will fail.
        with httpx.Client(timeout=30.0) as client:
            r = client.post(ENDPOINT, data=data, files=files)
            
        if r.status_code == 200:
            print("✅ Success!")
            profile = r.json().get("profile", {})
            summary = profile.get("summary", {}).get("one_liner", "No summary")
            findings = profile.get("findings", {})
            print(f"Summary: {summary}")
            print(f"Findings: {findings}")
        else:
            print(f"❌ Failed with status {r.status_code}: {r.text}")
    except Exception as e:
        print(f"❌ Connection error (is backend running on :8000?): {e}")

if __name__ == "__main__":
    test_integration()
