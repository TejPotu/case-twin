
# Folder highlights
# Content describes two medical case reports: pulmonary mucormycosis in a 65-year-old man and COVID-19-induced dermatitis herpetiformis in a 74-year-old woman.

import base64
from io import BytesIO
from typing import Any, Dict, List, Union

import torch
from PIL import Image
from transformers import AutoModel, AutoProcessor


class EndpointHandler:
    def __init__(self, path: str = "") -> None:
        target_model = "google/medsiglip-448"
        try:
            # Try loading from the local path first (standard HF Endpoint behavior)
            self.processor = AutoProcessor.from_pretrained(path, use_fast=True)
            self.model = AutoModel.from_pretrained(path, torch_dtype=torch.float16)
        except Exception as e:
            # Fallback to downloading the original model if local weights are missing
            print(f"Failed to load from {path}, falling back to {target_model}. Error: {e}")
            self.processor = AutoProcessor.from_pretrained(target_model, use_fast=True)
            self.model = AutoModel.from_pretrained(target_model, torch_dtype=torch.float16)

        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model = self.model.to(self.device)
        self.model.eval()

    def __call__(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Accepts:
          - image (base64 string) + texts (list of strings) → image embedding + text embeddings
          - image only                                       → image embedding
          - texts only                                       → text embeddings
        """

        inputs = data.get("inputs", data)
        image_b64: Union[str, None] = inputs.get("image")
        texts: Union[List[str], None] = inputs.get("texts")

        image: Union[Image.Image, None] = None
        if image_b64:
            image_bytes = base64.b64decode(image_b64)
            image = Image.open(BytesIO(image_bytes)).convert("RGB")

        if image is None and not texts:
            return {"error": "Provide at least 'image' (base64 string) or 'texts' (list of strings)."}

        result: Dict[str, Any] = {"image_embedding": None, "text_embeddings": None}

        with torch.no_grad():
            if image is not None:
                inputs = self.processor(images=image, return_tensors="pt").to(self.device)
                image_features = self.model.get_image_features(**inputs)
                # Normalize image embeddings
                image_features = image_features / image_features.norm(dim=-1, keepdim=True)
                result["image_embedding"] = image_features.squeeze().tolist()

            if texts:
                inputs = self.processor(
                    text=texts,
                    return_tensors="pt",
                    padding="max_length",
                    truncation=True,
                ).to(self.device)
                text_features = self.model.get_text_features(**inputs)
                # Normalize text embeddings
                text_features = text_features / text_features.norm(dim=-1, keepdim=True)
                result["text_embeddings"] = text_features.tolist()

        return result
