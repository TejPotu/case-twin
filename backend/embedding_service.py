"""
MedSiglip-448 embedding service.
Loads the model once on startup and exposes generate_embedding().
"""

import os
import threading
import torch
from PIL import Image
from transformers import SiglipImageProcessor, SiglipModel
from dotenv import load_dotenv

load_dotenv()

# Log in to HuggingFace Hub if a token is provided (required for gated models like MedSiglip)
_hf_token = os.getenv("HF_TOKEN")
if _hf_token and _hf_token != "YOUR_HF_TOKEN_HERE":
    try:
        from huggingface_hub import login
        login(token=_hf_token, add_to_git_credential=False)
        print("[EmbeddingService] HuggingFace login successful.")
    except Exception as e:
        print(f"[EmbeddingService] HuggingFace login failed: {e}")

MODEL_NAME = "google/medsiglip-448"

_processor = None
_model = None
_device = None
_load_lock = threading.Lock()


def _load_model():
    global _processor, _model, _device
    if _model is not None:
        return

    with _load_lock:
        # Double-checked locking: another thread may have loaded while we waited
        if _model is not None:
            return

        _device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"[EmbeddingService] Loading {MODEL_NAME} on {_device}...")

        _processor = SiglipImageProcessor.from_pretrained(MODEL_NAME)
        _model = SiglipModel.from_pretrained(
            MODEL_NAME,
            torch_dtype=torch.float16 if _device == "cuda" else torch.float32,
        ).to(_device)
        _model.eval()

        print(f"[EmbeddingService] Model ready on {_device}.")


# Eagerly load on import so the first request doesn't pay the cold-start cost
_load_model()


def generate_embedding(image: Image.Image) -> list[float]:
    """Generate a normalized 1152-dim MedSiglip embedding for a PIL image."""
    _load_model()

    inputs = _processor(images=image.convert("RGB"), return_tensors="pt")
    # Pass only pixel_values — SiglipModel.get_image_features returns a raw tensor
    pixel_values = inputs["pixel_values"].to(_device)

    with torch.no_grad():
        embedding = _model.get_image_features(pixel_values=pixel_values)  # (1, 1152)
        embedding = embedding / embedding.norm(dim=-1, keepdim=True)

    return embedding.cpu().float().numpy().squeeze().tolist()
