"""
Image vector-search microservice (FastAPI).

Single responsibility: given a captured photo, return the top-10 closest
matches from the configured image store, by filename. Node proxies to this
service and never calls it from the browser directly (see docs/02-System-Design.md).
"""
import io
import json
import os
from pathlib import Path

import imagehash
from fastapi import FastAPI, File, UploadFile
from PIL import Image

from build_index import build_index, hash_image, IMAGE_STORE_PATH, INDEX_PATH

app = FastAPI(title="Inventory ERP - Image Search Service")

_index_cache: dict = {}
_hash_cache: dict = {}


def load_index() -> dict:
    global _index_cache, _hash_cache
    if INDEX_PATH.exists():
        _index_cache = json.loads(INDEX_PATH.read_text())
    else:
        _index_cache = build_index()
    _hash_cache = {fname: imagehash.hex_to_hash(h_str) for fname, h_str in _index_cache.items()}
    return _index_cache


@app.on_event("startup")
def startup():
    load_index()


@app.post("/reindex")
def reindex():
    index = build_index()
    global _index_cache, _hash_cache
    _index_cache = index
    _hash_cache = {fname: imagehash.hex_to_hash(h_str) for fname, h_str in index.items()}
    return {"indexed": len(index)}


@app.post("/search")
async def search(file: UploadFile = File(...)):
    contents = await file.read()
    if not contents:
        return []

    query_img = Image.open(io.BytesIO(contents)).convert("RGB")
    query_hash = imagehash.phash(query_img)

    if not _hash_cache:
        load_index()

    scored = []
    for filename, h_obj in _hash_cache.items():
        distance = query_hash - h_obj
        # Convert hamming distance (0 = identical, higher = more different)
        # into a 0-1 similarity score.
        score = max(0.0, 1 - distance / 64)
        if score >= 0.40:  # Return matches with 40%+ similarity so candidate cards display properly
            scored.append({"filename": filename, "score": round(score, 4)})

    scored.sort(key=lambda m: m["score"], reverse=True)
    return scored[:10]


@app.get("/health")
def health():
    return {"ok": True, "indexed_images": len(_index_cache)}
