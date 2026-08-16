"""
Builds/refreshes the perceptual-hash index over every image in IMAGE_STORE_PATH.
Run this whenever new stock photos are added to the store; main.py loads the
resulting index.json at startup and on-demand via /reindex.

Pragmatic choice: perceptual hashing (ImageHash) instead of a deep embedding
model. It is fast, has zero GPU/model-download dependency, and is genuinely
effective for "does this stock photo look like one we already have" — which
is closer to a duplicate/near-duplicate search than open-ended similarity
search. If matching quality turns out to need real embeddings later, swap
the hash_image() function for a CNN feature extractor without touching the
API shape.
"""
import json
import os
from pathlib import Path

import imagehash
from PIL import Image

IMAGE_STORE_PATH = Path(os.environ.get("IMAGE_STORE_PATH", "./image-store"))
INDEX_PATH = Path(os.environ.get("EMBEDDING_INDEX_PATH", "./index.json"))
VALID_EXT = {".jpg", ".jpeg", ".png", ".webp"}


def hash_image(path: Path) -> str:
    with Image.open(path) as img:
        return str(imagehash.phash(img.convert("RGB")))


def build_index() -> dict:
    IMAGE_STORE_PATH.mkdir(parents=True, exist_ok=True)
    index = {}
    for path in IMAGE_STORE_PATH.iterdir():
        if path.suffix.lower() in VALID_EXT:
            if path.stat().st_size == 0:
                continue
            try:
                index[path.name] = hash_image(path)
            except Exception as e:  # noqa: BLE001 - a broken/corrupt image shouldn't kill the whole index
                print(f"skipping {path.name}: {e}")
    INDEX_PATH.write_text(json.dumps(index))
    print(f"Indexed {len(index)} images -> {INDEX_PATH}")
    return index


if __name__ == "__main__":
    build_index()
